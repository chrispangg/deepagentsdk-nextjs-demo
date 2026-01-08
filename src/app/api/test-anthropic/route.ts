import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  console.log("[Raw Test] API Key present:", !!apiKey);
  console.log("[Raw Test] API Key length:", apiKey?.length);
  console.log("[Raw Test] API Key prefix:", apiKey?.substring(0, 10));

  // Direct fetch to Anthropic API
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey ?? "",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 100,
      messages: [{ role: "user", content: "Hello" }],
    }),
  });

  console.log("[Raw Test] Status:", response.status);
  console.log("[Raw Test] Status text:", response.statusText);

  const responseText = await response.text();
  console.log("[Raw Test] Response body:", responseText);
  console.log("[Raw Test] Response length:", responseText.length);

  let responseJson;
  try {
    responseJson = JSON.parse(responseText);
  } catch {
    responseJson = { raw: responseText };
  }

  return Response.json({
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    body: responseJson,
    bodyLength: responseText.length,
  });
}
