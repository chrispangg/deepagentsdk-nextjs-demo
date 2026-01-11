import { NextResponse } from "next/server";
import { getE2BSandbox, getE2BSandboxId, DEFAULT_SANDBOX_ID } from "@/lib/sandbox-manager";

// Determine if running in cloud environment
const isCloudEnvironment = 
  process.env.DEPLOY_ENV === "cloud" ||
  process.env.VERCEL === "1" ||
  process.env.RAILWAY_ENVIRONMENT !== undefined ||
  process.env.RENDER === "true" ||
  process.env.FLY_APP_NAME !== undefined ||
  process.env.HEROKU_APP_NAME !== undefined;

/**
 * GET /api/sandbox-info
 * Returns information about the current sandbox, including the E2B sandbox ID if available.
 * This is useful for serverless environments where the sandbox instance may not persist
 * between function invocations.
 */
export async function GET() {
  const e2bSandbox = getE2BSandbox(DEFAULT_SANDBOX_ID);
  const e2bSandboxId = e2bSandbox?.id || getE2BSandboxId(DEFAULT_SANDBOX_ID);
  
  return NextResponse.json({
    isCloudEnvironment,
    hasActiveSandbox: !!e2bSandbox || !!e2bSandboxId,
    e2bSandboxId: e2bSandboxId || null,
    sandboxType: isCloudEnvironment ? "e2b" : "local",
  });
}
