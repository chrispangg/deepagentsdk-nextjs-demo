/**
 * TEST: Can we use useElementsAdapter with LocalSandbox?
 *
 * This will fail in the browser because LocalSandbox needs Node.js APIs
 */

"use client";

import { useElementsAdapter } from "deepagentsdk/elements";
import { LocalSandbox } from "deepagentsdk";
import { createAnthropic } from "@ai-sdk/anthropic";

export function TestElementsAdapterWithLocalSandbox() {
  try {
    // This will FAIL at runtime in the browser
    const sandbox = new LocalSandbox({
      cwd: "./test-workspace"
    });

    const anthropic = createAnthropic({
      apiKey: process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || "", // Exposed client-side!
    });

    const { uiMessages, sendMessage } = useElementsAdapter({
      model: anthropic("claude-haiku-4-5-20251001"),
      backend: sandbox, // ❌ Will fail - sandbox uses child_process
    });

    return <div>Success!</div>;
  } catch (error) {
    return <div>Error: {String(error)}</div>;
  }
}

/**
 * TEST: Can we use useElementsAdapter with StateBackend?
 *
 * This WILL work because StateBackend is pure JavaScript
 */

import { StateBackend } from "deepagentsdk";

export function TestElementsAdapterWithStateBackend() {
  const backend = new StateBackend({ todos: [], files: {} });

  const anthropic = createAnthropic({
    apiKey: process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || "", // Still exposed!
  });

  const { uiMessages, sendMessage } = useElementsAdapter({
    model: anthropic("claude-haiku-4-5-20251001"),
    backend, // ✅ Works - StateBackend is browser-compatible
  });

  return <div>StateBackend works!</div>;
}
