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
    const baseUrl = "https://api.anthropic.com/v1";

    // Use client-provided key, or fall back to server env var
    const apiKey = clientApiKey || process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { models: [], error: "No Anthropic API key available (not in .env or provided by client)" },
        { status: 400 }
      );
    }

    // Check cache first
    const cached = getCachedModels("anthropic");
    if (cached) {
      return NextResponse.json({ models: cached });
    }

    const response = await fetch(`${baseUrl}/v1/models?limit=100`, {
      method: "GET",
      headers: {
        "X-Api-Key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401) {
        return NextResponse.json(
          { models: [], error: "Invalid Anthropic API key" },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { models: [], error: `Anthropic API error: ${response.status} ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Transform models to include provider prefix
    const models = data.data.map((model: any) => ({
      id: `anthropic/${model.id}`,
      name: model.display_name || model.id,
      provider: "anthropic" as const,
    }));

    // Cache the results
    setCachedModels("anthropic", models);

    return NextResponse.json({ models });
  } catch (error) {
    console.error("Error fetching Anthropic models:", error);
    return NextResponse.json(
      { models: [], error: "Failed to fetch Anthropic models" },
      { status: 500 }
    );
  }
}
