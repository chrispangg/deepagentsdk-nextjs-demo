import { NextResponse } from "next/server";

export async function GET() {
  // Determine if running in cloud environment
  // Cloud environments typically set NODE_ENV=production or have specific env vars
  // DEPLOY_ENV can be explicitly set to "cloud" to force cloud mode
  const isCloudEnvironment = 
    process.env.DEPLOY_ENV === "cloud" ||
    process.env.VERCEL === "1" ||
    process.env.RAILWAY_ENVIRONMENT !== undefined ||
    process.env.RENDER === "true" ||
    process.env.FLY_APP_NAME !== undefined ||
    process.env.HEROKU_APP_NAME !== undefined;

  // Check which environment variables are configured
  const config = {
    hasAnthropicApiKey: !!process.env.ANTHROPIC_API_KEY,
    anthropicBaseUrl: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1",
    hasTavilyApiKey: !!process.env.TAVILY_API_KEY,
    hasOpenaiApiKey: !!process.env.OPENAI_API_KEY,
    hasE2bApiKey: !!process.env.E2B_API_KEY,
    isCloudEnvironment,
  };

  return NextResponse.json(config);
}
