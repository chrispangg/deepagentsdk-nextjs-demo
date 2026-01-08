import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { NextRequest } from "next/server";

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
  baseURL: process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com/v1",
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { message } = body as { message: string };

  console.log("[Generate] Message:", message);
  console.log("[Generate] ANTHROPIC_BASE_URL env:", process.env.ANTHROPIC_BASE_URL);
  console.log("[Generate] baseURL fallback:", "https://api.anthropic.com/v1");

  try {
    // Use generateText instead of streamText for better error handling
    const result = await generateText({
      model: anthropic("claude-3-haiku-20240307"), // Use model we confirmed works
      prompt: message,
    });

    console.log("[Generate] Success:", result);
    console.log("[Generate] Text length:", result.text.length);

    return Response.json({
      success: true,
      text: result.text,
      length: result.text.length,
    });
  } catch (error) {
    console.error("[Generate] Error:", error);
    console.error("[Generate] Error name:", (error as Error).name);
    console.error("[Generate] Error message:", (error as Error).message);
    console.error("[Generate] Error stack:", (error as Error).stack);

    return Response.json({
      success: false,
      error: String(error),
      name: (error as Error).name,
      message: (error as Error).message,
    }, { status: 500 });
  }
}
