import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

// Get the workspace directory - same as used in chat route
const workspaceDir = path.join(process.cwd(), ".sandbox-workspace");

// Ensure workspace exists
if (!fs.existsSync(workspaceDir)) {
  fs.mkdirSync(workspaceDir, { recursive: true });
}

// GET /api/sandboxes/[sandboxId]/files - Read file content or list files
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sandboxId: string }> }
) {
  const { sandboxId } = await params;
  const searchParams = req.nextUrl.searchParams;
  const filePath = searchParams.get("path");

  // If no path provided, list all files in the sandbox
  if (!filePath) {
    try {
      const files = listFilesRecursively(workspaceDir);
      return NextResponse.json({ files, sandboxId });
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
    const { path: filePath, content } = body;

    if (!filePath || content === undefined) {
      return NextResponse.json(
        { error: "Missing path or content" },
        { status: 400 }
      );
    }

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

