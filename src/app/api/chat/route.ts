import { createDeepAgent, LocalSandbox } from "deepagentsdk";
import { createFullEventsHandler } from "@/lib/create-full-events-handler";
import { anthropic } from "@ai-sdk/anthropic";
import * as fs from "fs";
import * as path from "path";

// Create a workspace directory for the sandbox
const workspaceDir = path.join(process.cwd(), ".sandbox-workspace");

// Ensure workspace exists
if (!fs.existsSync(workspaceDir)) {
  fs.mkdirSync(workspaceDir, { recursive: true });
}

// Create a LocalSandbox with the workspace directory
// The execute tool is AUTOMATICALLY added when using a SandboxBackendProtocol!
const sandbox = new LocalSandbox({
  cwd: workspaceDir,
  timeout: 60000, // 60 second timeout for commands
  env: {
    NODE_ENV: "development",
  },
});

// Create the DeepAgent with your desired configuration
const agent = createDeepAgent({
  model: anthropic("claude-haiku-4-5-20251001"),
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

// Export the route handler - creates Elements-compatible streaming endpoint with all 26 events
export const POST = createFullEventsHandler({
  agent,

  // Optional: Hook for authentication, logging, rate limiting
  onRequest: async () => {
    // Log incoming requests for debugging
    console.log(`[Chat] Request received at ${new Date().toISOString()}`);
    console.log(`[Chat] Workspace: ${workspaceDir}`);
  },

  // Optional: Initial state for the agent
  initialState: {
    todos: [],
    files: {},
  },
});

// Optional: Increase timeout for longer agent runs
export const maxDuration = 60;
