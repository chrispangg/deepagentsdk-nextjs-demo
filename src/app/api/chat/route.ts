import { createDeepAgent, LocalSandbox, createE2BBackend, createWebTools, type E2BBackend, type DeepAgentState } from "deepagentsdk";
import { createElementsRouteHandler } from "deepagentsdk/elements";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import * as fs from "fs";
import * as path from "path";
import { NextRequest } from "next/server";
import { setE2BSandbox, getE2BSandbox, DEFAULT_SANDBOX_ID } from "@/lib/sandbox-manager";

// Create a workspace directory for the local sandbox
const workspaceDir = path.join(process.cwd(), ".sandbox-workspace");

// Ensure workspace exists (for local sandbox)
if (!fs.existsSync(workspaceDir)) {
  fs.mkdirSync(workspaceDir, { recursive: true });
}

// Determine if running in cloud environment
const isCloudEnvironment = 
  process.env.DEPLOY_ENV === "cloud" ||
  process.env.VERCEL === "1" ||
  process.env.RAILWAY_ENVIRONMENT !== undefined ||
  process.env.RENDER === "true" ||
  process.env.FLY_APP_NAME !== undefined ||
  process.env.HEROKU_APP_NAME !== undefined;

// Cache for agents to reuse them when settings haven't changed
const agentCache = new Map<string, any>();

function getCacheKey(settings: any): string {
  // Include all keys that affect agent behavior in the cache key
  // This ensures a new agent is created when any of these change
  const tavilyKey = settings.tavilyApiKey && settings.tavilyApiKey !== "[FROM_SERVER]" 
    ? settings.tavilyApiKey 
    : (process.env.TAVILY_API_KEY || "");
  const e2bKey = settings.e2bApiKey && settings.e2bApiKey !== "[FROM_SERVER]"
    ? settings.e2bApiKey
    : (process.env.E2B_API_KEY || "");
  
  // Hash the keys to avoid exposing them in logs
  const tavilyHash = tavilyKey ? "tavily-" + tavilyKey.substring(0, 8) : "no-tavily";
  const e2bHash = e2bKey ? "e2b-" + e2bKey.substring(0, 8) : "no-e2b";
  
  return `${settings.selectedProvider}-${settings.selectedModel}-${settings.anthropicBaseUrl || 'default'}-${settings.sandboxType || 'local'}-${tavilyHash}-${e2bHash}`;
}

async function createAgentForSettings(settings: any): Promise<any> {
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
  const e2bApiKey = (settings.e2bApiKey && settings.e2bApiKey !== "[FROM_SERVER]" && settings.e2bApiKey !== "")
    ? settings.e2bApiKey
    : (process.env.E2B_API_KEY || "");
  const anthropicBaseUrl = settings.anthropicBaseUrl || process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1";

  // Determine sandbox type
  // In cloud environment, only E2B is allowed
  // In local environment, default to local unless E2B is explicitly selected
  let sandboxType = settings.sandboxType || "local";
  if (isCloudEnvironment) {
    sandboxType = "e2b"; // Force E2B in cloud
  }

  // Validate E2B API key if E2B sandbox is required
  if (sandboxType === "e2b" && !e2bApiKey) {
    console.error("[Chat] Error: No E2B API key available");
    return new Response(JSON.stringify({
      error: isCloudEnvironment 
        ? "E2B API key is required in cloud environment. Please add E2B_API_KEY to your .env file or configure it in settings."
        : "E2B API key is required for cloud sandbox. Please configure it in settings or switch to local sandbox."
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

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

  // Create the appropriate sandbox based on type
  let sandbox: LocalSandbox | E2BBackend;
  let systemPrompt: string;

  if (sandboxType === "e2b") {
    // Check if we already have an E2B sandbox cached
    const existingSandbox = getE2BSandbox(DEFAULT_SANDBOX_ID);
    if (existingSandbox) {
      console.log(`[Chat] Reusing existing E2B sandbox with ID: ${existingSandbox.id}`);
      sandbox = existingSandbox;
    } else {
      // Create new E2B sandbox
      console.log("[Chat] Creating E2B sandbox...");
      try {
        sandbox = await createE2BBackend({
          apiKey: e2bApiKey,
          template: "base", // Node.js, Python, Bun pre-installed
          timeout: 2 * 60 * 1000, // 2 minute timeout for commands
        });
        console.log(`[Chat] E2B sandbox created with ID: ${sandbox.id}`);
        
        // Cache the E2B sandbox in the shared manager
        setE2BSandbox(DEFAULT_SANDBOX_ID, sandbox);
      } catch (error) {
        console.error("[Chat] Error creating E2B sandbox:", error);
        return new Response(JSON.stringify({
          error: `Failed to create E2B sandbox: ${error instanceof Error ? error.message : 'Unknown error'}`
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    systemPrompt = `You are a helpful AI assistant with access to a secure E2B cloud sandbox environment.

You can:
1. Create and edit files in /home/user
2. Execute shell commands using the 'execute' tool (automatically available)
3. Plan your work using todos
4. Run Python, Node.js, and other interpreted languages

Available tools in the sandbox:
- Node.js (node, npm, bun)
- Python (python3, pip)
- Git

When creating projects:
- Always create a package.json first if needed
- Use appropriate commands for the runtime
- Check command output for errors and fix them

Be efficient and avoid unnecessary commands.`;
  } else {
    // Create LocalSandbox with the workspace directory
    sandbox = new LocalSandbox({
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

    systemPrompt = `You are a helpful AI assistant with access to a local sandbox environment.

You can:
1. Create and edit files in the workspace
2. Execute shell commands using the 'execute' tool (automatically available)
3. Plan your work using todos

The workspace is a real directory on the local filesystem at: ${workspaceDir}

When creating projects:
- Always create a package.json first if needed
- Use appropriate commands for the runtime (bun or node)
- Check command output for errors and fix them

Be helpful and concise. Demonstrate tool usage when appropriate.`;
  }

  // Create web tools if Tavily API key is available
  // We need to pass an initial state for the tools
  const initialState: DeepAgentState = {
    todos: [],
    files: {},
  };
  
  let webTools: Record<string, any> = {};
  if (tavilyApiKey) {
    console.log("[Chat] Tavily API key available, adding web tools");
    webTools = createWebTools(initialState, {
      backend: sandbox,
      tavilyApiKey,
    });
  } else {
    console.log("[Chat] No Tavily API key, web tools not available");
  }

  // Create the DeepAgent with dynamic configuration
  const agent = createDeepAgent({
    model,
    backend: sandbox,
    maxSteps: 15,
    systemPrompt,
    tools: Object.keys(webTools).length > 0 ? webTools : undefined,
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
      sandboxType: isCloudEnvironment ? "e2b" : "local",
    };

    // Determine effective sandbox type
    const effectiveSandboxType = isCloudEnvironment ? "e2b" : (settings.sandboxType || "local");

    // Log incoming requests for debugging (without logging sensitive data)
    console.log(`[Chat] Request received at ${new Date().toISOString()}`);
    console.log(`[Chat] Environment: ${isCloudEnvironment ? "cloud" : "local"}`);
    console.log(`[Chat] Sandbox: ${effectiveSandboxType}`);
    console.log(`[Chat] Provider: ${settings.selectedProvider}, Model: ${settings.selectedModel}`);

    // Create agent for these settings (now async due to E2B)
    const agentOrError = await createAgentForSettings(settings);

    // Check if createAgentForSettings returned an error Response
    if (agentOrError instanceof Response) {
      console.log("[Chat] Agent creation returned error response");
      return agentOrError;
    }

    const agent = agentOrError;

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
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Optional: Increase timeout for longer agent runs
export const maxDuration = 60;
