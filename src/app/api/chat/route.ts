import { createDeepAgent, LocalSandbox } from "deepagentsdk";
import { createElementsRouteHandler } from "deepagentsdk/elements";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import * as fs from "fs";
import * as path from "path";
import { NextRequest } from "next/server";

// Create a workspace directory for the sandbox
const workspaceDir = path.join(process.cwd(), ".sandbox-workspace");

// Ensure workspace exists
if (!fs.existsSync(workspaceDir)) {
  fs.mkdirSync(workspaceDir, { recursive: true });
}

// Cache for agents to reuse them when settings haven't changed
const agentCache = new Map<string, any>();

function getCacheKey(settings: any): string {
  return `${settings.selectedProvider}-${settings.selectedModel}-${settings.anthropicBaseUrl || 'default'}`;
}

function createAgentForSettings(settings: any) {
  const cacheKey = getCacheKey(settings);

  // Check cache first
  if (agentCache.has(cacheKey)) {
    return agentCache.get(cacheKey);
  }

  // Determine which API keys to use (from settings or fallback to env vars)
  // Treat "[FROM_SERVER]" as a signal to use environment variables
  // Also treat empty strings as a signal to use env vars
  const anthropicApiKey = (settings.anthropicApiKey && settings.anthropicApiKey !== "[FROM_SERVER]" && settings.anthropicApiKey !== "")
    ? settings.anthropicApiKey
    : (process.env.ANTHROPIC_API_KEY || "");
  const openaiApiKey = (settings.openaiApiKey && settings.openaiApiKey !== "[FROM_SERVER]" && settings.openaiApiKey !== "")
    ? settings.openaiApiKey
    : (process.env.OPENAI_API_KEY || "");
  const tavilyApiKey = (settings.tavilyApiKey && settings.tavilyApiKey !== "[FROM_SERVER]" && settings.tavilyApiKey !== "")
    ? settings.tavilyApiKey
    : (process.env.TAVILY_API_KEY || "");
  const anthropicBaseUrl = settings.anthropicBaseUrl || process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1";

  // Validate that we have the required API key for the selected provider
  if (settings.selectedProvider === "anthropic" && !anthropicApiKey) {
    console.error("[Chat] Error: No Anthropic API key available");
    return new Response(JSON.stringify({
      error: "No Anthropic API key configured. Please add ANTHROPIC_API_KEY to your .env file or configure it in settings."
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (settings.selectedProvider === "openai" && !openaiApiKey) {
    console.error("[Chat] Error: No OpenAI API key available");
    return new Response(JSON.stringify({
      error: "No OpenAI API key configured. Please add OPENAI_API_KEY to your .env file or configure it in settings."
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Create the appropriate model based on provider
  let model;
  try {
    if (settings.selectedProvider === "anthropic") {
      const anthropicProvider = createAnthropic({
        baseURL: anthropicBaseUrl,
        apiKey: anthropicApiKey,
      });
      model = anthropicProvider(settings.selectedModel.replace("anthropic/", ""));
    } else if (settings.selectedProvider === "openai") {
      const openai = createOpenAI({
        apiKey: openaiApiKey,
      });
      model = openai(settings.selectedModel.replace("openai/", ""));
    } else {
      // Fallback to default
      if (!anthropicApiKey) {
        console.error("[Chat] Error: No API key for fallback model");
        return new Response(JSON.stringify({
          error: "No API key configured for the default model. Please configure your API keys."
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      const anthropicProvider = createAnthropic({
        baseURL: "https://api.anthropic.com/v1",
        apiKey: anthropicApiKey,
      });
      model = anthropicProvider("claude-haiku-4-5-20251001");
    }
  } catch (error) {
    console.error("[Chat] Error creating model provider:", error);
    return new Response(JSON.stringify({
      error: `Failed to create model provider: ${error instanceof Error ? error.message : 'Unknown error'}`
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Create a LocalSandbox with the workspace directory
  const sandbox = new LocalSandbox({
    cwd: workspaceDir,
    timeout: 60000, // 60 second timeout for commands
    env: {
      NODE_ENV: "development",
      ANTHROPIC_API_KEY: anthropicApiKey,
      ANTHROPIC_BASE_URL: anthropicBaseUrl,
      TAVILY_API_KEY: tavilyApiKey,
      OPENAI_API_KEY: openaiApiKey,
    },
  });

  // Create the DeepAgent with dynamic configuration
  const agent = createDeepAgent({
    model,
    backend: sandbox,
    maxSteps: 15,
    systemPrompt: `You are a helpful AI assistant with access to a local sandbox environment.

You can:
1. Create and edit files in the workspace
2. Execute shell commands using the 'execute' tool (automatically available)
3. Plan your work using todos

The workspace is a real directory on the local filesystem at: ${workspaceDir}

When creating projects:
- Always create a package.json first if needed
- Use appropriate commands for the runtime (bun or node)
- Check command output for errors and fix them

Be helpful and concise. Demonstrate tool usage when appropriate.`,
  });

  // Cache the agent
  agentCache.set(cacheKey, agent);

  return agent;
}

// Export the route handler - uses built-in Elements adapter with full event streaming
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const settings = body.settings || {
      selectedProvider: "anthropic",
      selectedModel: "anthropic/claude-sonnet-4-5-20250929",
      anthropicBaseUrl: "https://api.anthropic.com/v1",
    };

    // Log incoming requests for debugging (without logging sensitive data)
    console.log(`[Chat] Request received at ${new Date().toISOString()}`);
    console.log(`[Chat] Workspace: ${workspaceDir}`);
    console.log(`[Chat] Provider: ${settings.selectedProvider}, Model: ${settings.selectedModel}`);

    // Create agent for these settings
    const agent = createAgentForSettings(settings);

    // Create the route handler with the agent
    const handler = createElementsRouteHandler({
      agent,

      // Optional: Hook for authentication, logging, rate limiting
      onRequest: async () => {
        // Additional logging can go here
      },

      // Optional: Initial state for the agent
      initialState: {
        todos: [],
        files: {},
      },
    });

    // Create a new Request with the original body (since we consumed it)
    // The handler needs to read the messages from the body
    const newRequest = new NextRequest(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(body),
    });

    // Call the handler with the reconstructed request
    return handler(newRequest);
  } catch (error) {
    console.error("[Chat] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Optional: Increase timeout for longer agent runs
export const maxDuration = 60;
