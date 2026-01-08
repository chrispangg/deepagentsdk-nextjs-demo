import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepAgent, LocalSandbox, isSandboxBackend } from "deepagentsdk";
import type { NextRequest } from "next/server";
import * as fs from "fs";
import * as path from "path";

// Create the Anthropic provider
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
  baseURL: process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com/v1",
});

// Create a workspace directory for the sandbox
const workspaceDir = path.join(process.cwd(), ".sandbox-workspace");

// Ensure workspace exists
if (!fs.existsSync(workspaceDir)) {
  fs.mkdirSync(workspaceDir, { recursive: true });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { message, state } = body as { message: string; state?: { todos: any[]; files: any } };

  // Create a LocalSandbox with the workspace directory
  // The execute tool is AUTOMATICALLY added when using a SandboxBackendProtocol!
  const sandbox = new LocalSandbox({
    cwd: workspaceDir,
    timeout: 60000, // 60 second timeout for commands
    env: {
      NODE_ENV: "development",
    },
  });

  const model = anthropic("claude-haiku-4-5-20251001");
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

  // Log sandbox info
  if (isSandboxBackend(sandbox)) {
    console.log("[API] Backend supports command execution");
    console.log(`[API] Sandbox ID: ${sandbox.id}`);
    console.log(`[API] Workspace: ${workspaceDir}`);
  }

  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of agent.streamWithEvents({
          messages: [{ role: "user", content: message }],
          state: state ?? { todos: [], files: {} },
        })) {
          const chunk = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        console.error("[API] Error:", error);
        const errorChunk = `data: ${JSON.stringify({ type: "error", error: String(error) })}\n\n`;
        controller.enqueue(encoder.encode(errorChunk));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
