import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { Sandbox } from "e2b";
import { getE2BSandbox, getE2BSandboxId, setE2BSandbox, DEFAULT_SANDBOX_ID } from "@/lib/sandbox-manager";
import { type E2BBackend } from "deepagentsdk";

// Determine if running in cloud environment
// This must be checked BEFORE attempting any filesystem operations
const isCloudEnvironment = 
  process.env.DEPLOY_ENV === "cloud" ||
  process.env.VERCEL === "1" ||
  process.env.RAILWAY_ENVIRONMENT !== undefined ||
  process.env.RENDER === "true" ||
  process.env.FLY_APP_NAME !== undefined ||
  process.env.HEROKU_APP_NAME !== undefined;

// Get the workspace directory - same as used in chat route
const workspaceDir = path.join(process.cwd(), ".sandbox-workspace");

// Only create workspace directory in local environments
// Cloud environments (Vercel, etc.) have read-only filesystems
if (!isCloudEnvironment) {
  try {
    if (!fs.existsSync(workspaceDir)) {
      fs.mkdirSync(workspaceDir, { recursive: true });
    }
  } catch (error) {
    console.warn("[Files] Could not create workspace directory:", error);
    // This is expected in some environments, we'll use E2B instead
  }
}

// GET /api/sandboxes/[sandboxId]/files - Read file content or list files
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sandboxId: string }> }
) {
  const { sandboxId } = await params;
  const searchParams = req.nextUrl.searchParams;
  const filePath = searchParams.get("path");
  
  // Check for sandbox type from query params or determine from environment
  const sandboxType = searchParams.get("sandboxType") || (isCloudEnvironment ? "e2b" : "local");

  // Handle E2B sandbox
  if (sandboxType === "e2b") {
    // Get E2B sandbox ID from query params (for serverless reconnection) or from cache
    const e2bSandboxIdParam = searchParams.get("e2bSandboxId");
    
    // Try to get sandbox from in-memory cache first (works locally)
    let e2bSandbox = getE2BSandbox(DEFAULT_SANDBOX_ID);
    
    // If no sandbox in cache but we have an ID, try to reconnect (serverless environments)
    if (!e2bSandbox && e2bSandboxIdParam) {
      console.log(`[Files API] Reconnecting to E2B sandbox: ${e2bSandboxIdParam}`);
      try {
        const reconnectedSandbox = await Sandbox.connect(e2bSandboxIdParam, {
          apiKey: process.env.E2B_API_KEY,
        });
        
        // Create a wrapper that matches E2BBackend interface for execute
        e2bSandbox = {
          id: reconnectedSandbox.sandboxId,
          execute: async (command: string) => {
            const result = await reconnectedSandbox.commands.run(command);
            return {
              output: result.stdout + result.stderr,
              exitCode: result.exitCode,
            };
          },
        } as unknown as E2BBackend;
        
        console.log(`[Files API] Successfully reconnected to E2B sandbox`);
      } catch (error) {
        console.error("[Files API] Error reconnecting to E2B sandbox:", error);
        return NextResponse.json({ 
          files: [], 
          sandboxId,
          error: "Failed to reconnect to E2B sandbox. It may have expired."
        });
      }
    }
    
    if (!e2bSandbox) {
      return NextResponse.json({ 
        files: [], 
        sandboxId,
        message: "No active E2B sandbox. Start a chat to create one."
      });
    }

    // If no path provided, list all files in the E2B sandbox
    if (!filePath) {
      try {
        // Use E2B's execute to list files
        const result = await e2bSandbox.execute("find /home/user -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/.next/*' 2>/dev/null | head -100");
        
        const files = result.output
          .split("\n")
          .filter((line: string) => line.trim() && line.startsWith("/home/user/"))
          .map((line: string) => line.replace("/home/user/", ""));
        
        return NextResponse.json({ files, sandboxId, sandboxType: "e2b" });
      } catch (error) {
        console.error("[Files API] Error listing E2B files:", error);
        return NextResponse.json(
          { error: "Failed to list files from E2B sandbox" },
          { status: 500 }
        );
      }
    }

    // Read specific file content from E2B
    try {
      const fullPath = `/home/user/${filePath}`;
      const result = await e2bSandbox.execute(`cat "${fullPath}"`);
      
      if (result.exitCode !== 0) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
      
      return new NextResponse(result.output, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    } catch (error) {
      console.error("[Files API] Error reading E2B file:", error);
      return NextResponse.json(
        { error: "Failed to read file from E2B sandbox" },
        { status: 500 }
      );
    }
  }

  // Handle Local sandbox (original implementation)
  // If no path provided, list all files in the sandbox
  if (!filePath) {
    try {
      const files = listFilesRecursively(workspaceDir);
      return NextResponse.json({ files, sandboxId, sandboxType: "local" });
    } catch (error) {
      console.error("[Files API] Error listing files:", error);
      return NextResponse.json(
        { error: "Failed to list files" },
        { status: 500 }
      );
    }
  }

  // Read specific file content
  const fullPath = path.join(workspaceDir, filePath);

  // Security check: ensure the path is within the workspace
  const resolvedPath = path.resolve(fullPath);
  if (!resolvedPath.startsWith(path.resolve(workspaceDir))) {
    return NextResponse.json(
      { error: "Access denied: path outside workspace" },
      { status: 403 }
    );
  }

  try {
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const content = fs.readFileSync(fullPath, "utf-8");
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("[Files API] Error reading file:", error);
    return NextResponse.json(
      { error: "Failed to read file" },
      { status: 500 }
    );
  }
}

// POST /api/sandboxes/[sandboxId]/files - Write file content
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sandboxId: string }> }
) {
  const { sandboxId } = await params;

  try {
    const body = await req.json();
    const { path: filePath, content, sandboxType: requestedSandboxType, e2bSandboxId: e2bSandboxIdParam } = body;
    
    // Determine sandbox type
    const sandboxType = requestedSandboxType || (isCloudEnvironment ? "e2b" : "local");

    if (!filePath || content === undefined) {
      return NextResponse.json(
        { error: "Missing path or content" },
        { status: 400 }
      );
    }

    // Handle E2B sandbox
    if (sandboxType === "e2b") {
      // Try to get sandbox from in-memory cache first (works locally)
      let e2bSandbox = getE2BSandbox(DEFAULT_SANDBOX_ID);
      
      // If no sandbox in cache but we have an ID, try to reconnect (serverless environments)
      if (!e2bSandbox && e2bSandboxIdParam) {
        console.log(`[Files API] Reconnecting to E2B sandbox for write: ${e2bSandboxIdParam}`);
        try {
          const reconnectedSandbox = await Sandbox.connect(e2bSandboxIdParam, {
            apiKey: process.env.E2B_API_KEY,
          });
          
          // Create a wrapper that matches E2BBackend interface for execute
          e2bSandbox = {
            id: reconnectedSandbox.sandboxId,
            execute: async (command: string) => {
              const result = await reconnectedSandbox.commands.run(command);
              return {
                output: result.stdout + result.stderr,
                exitCode: result.exitCode,
              };
            },
          } as unknown as E2BBackend;
          
          console.log(`[Files API] Successfully reconnected to E2B sandbox for write`);
        } catch (error) {
          console.error("[Files API] Error reconnecting to E2B sandbox:", error);
          return NextResponse.json(
            { error: "Failed to reconnect to E2B sandbox. It may have expired." },
            { status: 400 }
          );
        }
      }
      
      if (!e2bSandbox) {
        return NextResponse.json(
          { error: "No active E2B sandbox. Start a chat to create one." },
          { status: 400 }
        );
      }

      try {
        const fullPath = `/home/user/${filePath}`;
        
        // Ensure directory exists
        const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
        if (dir) {
          await e2bSandbox.execute(`mkdir -p "${dir}"`);
        }
        
        // Write file content using heredoc
        // Escape content for shell
        const escapedContent = content.replace(/'/g, "'\\''");
        await e2bSandbox.execute(`cat > "${fullPath}" << 'EOFMARKER'\n${escapedContent}\nEOFMARKER`);
        
        return NextResponse.json({
          success: true,
          sandboxId,
          sandboxType: "e2b",
          path: filePath,
        });
      } catch (error) {
        console.error("[Files API] Error writing E2B file:", error);
        return NextResponse.json(
          { error: "Failed to write file to E2B sandbox" },
          { status: 500 }
        );
      }
    }

    // Handle Local sandbox (original implementation)
    const fullPath = path.join(workspaceDir, filePath);

    // Security check: ensure the path is within the workspace
    const resolvedPath = path.resolve(fullPath);
    if (!resolvedPath.startsWith(path.resolve(workspaceDir))) {
      return NextResponse.json(
        { error: "Access denied: path outside workspace" },
        { status: 403 }
      );
    }

    // Ensure directory exists
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content, "utf-8");

    return NextResponse.json({
      success: true,
      sandboxId,
      sandboxType: "local",
      path: filePath,
    });
  } catch (error) {
    console.error("[Files API] Error writing file:", error);
    return NextResponse.json(
      { error: "Failed to write file" },
      { status: 500 }
    );
  }
}

// Helper function to list files recursively
function listFilesRecursively(
  dir: string,
  baseDir: string = dir,
  ignorePatterns: string[] = ["node_modules", ".git", ".next"]
): string[] {
  const files: string[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      // Skip ignored directories
      if (ignorePatterns.includes(entry.name)) {
        continue;
      }

      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);

      if (entry.isDirectory()) {
        // Recursively list files in subdirectories
        files.push(...listFilesRecursively(fullPath, baseDir, ignorePatterns));
      } else {
        files.push(relativePath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }

  return files;
}
