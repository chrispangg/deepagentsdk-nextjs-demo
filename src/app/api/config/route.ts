import { NextResponse } from "next/server";

export async function GET() {
  // Check which environment variables are configured
  const config = {
    hasAnthropicApiKey: !!process.env.ANTHROPIC_API_KEY,
    anthropicBaseUrl: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1",
    hasTavilyApiKey: !!process.env.TAVILY_API_KEY,
    hasOpenaiApiKey: !!process.env.OPENAI_API_KEY,
  };

  return NextResponse.json(config);
}
