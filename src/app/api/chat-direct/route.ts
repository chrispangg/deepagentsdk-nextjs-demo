import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { NextRequest } from "next/server";

// Create the Anthropic provider
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
  baseURL: process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com/v1",
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { message } = body as { message: string };

  console.log("[Direct] Message:", message);
  console.log("[Direct] API Key present:", !!process.env.ANTHROPIC_API_KEY);

  // Use AI SDK streamText directly (no deepagentsdk)
  const result = streamText({
    model: anthropic("claude-3-haiku-20240307"),
    prompt: message,
  });

  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  let chunkCount = 0;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        console.log("[Direct] Starting fullStream iteration...");

        // Also try textStream to see if that works
        console.log("[Direct] Testing textStream...");
        const textStreamAsync = (async () => {
          const chunks: string[] = [];
          for await (const text of result.textStream) {
            console.log("[Direct] textStream chunk:", text);
            chunks.push(text);
          }
          return chunks.join("");
        })();

        for await (const chunk of result.fullStream) {
          chunkCount++;
          console.log("[Direct] Chunk type:", chunk.type, "count:", chunkCount);

          // Log chunk details for debugging
          if (chunk.type === "text-delta") {
            console.log("[Direct] Text delta:", chunk.text);
          } else if (chunk.type === "finish-step") {
            console.log("[Direct] Finish step - keys:", Object.keys(chunk));
            if ("response" in chunk) {
              console.log("[Direct] Response:", JSON.stringify(chunk.response, null, 2));
            }
          } else if (chunk.type === "finish") {
            console.log("[Direct] Finish - keys:", Object.keys(chunk));
          }

          const sseChunk = `data: ${JSON.stringify(chunk)}\n\n`;
          controller.enqueue(encoder.encode(sseChunk));
        }

        // Check textStream result
        const textStreamResult = await textStreamAsync;
        console.log("[Direct] textStream total:", textStreamResult.length, "chars");

        console.log("[Direct] Total chunks:", chunkCount);

        // Get final text
        const finalText = await result.text;
        console.log("[Direct] Final text:", finalText);
        console.log("[Direct] Final text length:", finalText?.length);

        controller.enqueue(encoder.encode(`data: {"type":"done","text":"${finalText}"}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        console.error("[Direct] Error:", error);
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
