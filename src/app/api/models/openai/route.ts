import { NextRequest, NextResponse } from "next/server";

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { data: any; timestamp: number }>();

function getCachedModels(provider: string) {
  const cached = cache.get(provider);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCachedModels(provider: string, data: any) {
  cache.set(provider, { data, timestamp: Date.now() });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientApiKey = searchParams.get("apiKey");

    // Use client-provided key, or fall back to server env var
    const apiKey = clientApiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { models: [], error: "No OpenAI API key available (not in .env or provided by client)" },
        { status: 400 }
      );
    }

    // Check cache first
    const cached = getCachedModels("openai");
    if (cached) {
      return NextResponse.json({ models: cached });
    }

    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401) {
        return NextResponse.json(
          { models: [], error: "Invalid OpenAI API key" },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { models: [], error: `OpenAI API error: ${response.status} ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Filter only chat models and transform to include provider prefix
    const chatModels = data.data
      .filter((model: any) => model.id.includes("gpt"))
      .map((model: any) => ({
        id: `openai/${model.id}`,
        name: model.id,
        provider: "openai" as const,
      }));

    // Cache the results
    setCachedModels("openai", chatModels);

    return NextResponse.json({ models: chatModels });
  } catch (error) {
    console.error("Error fetching OpenAI models:", error);
    return NextResponse.json(
      { models: [], error: "Failed to fetch OpenAI models" },
      { status: 500 }
    );
  }
}
