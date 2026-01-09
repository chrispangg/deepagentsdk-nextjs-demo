/**
 * Client-side hook for calling the deepagentsdk API
 *
 * This hook directly calls the /api/chat endpoint and processes the streaming events.
 * The server-side uses createElementsRouteHandler from deepagentsdk/elements which
 * streams responses in the AI SDK UI Message Stream Protocol with full event visibility.
 */

import { useState, useCallback, useRef, useEffect } from "react";

// Re-export UIMessage and UIMessagePart from deepagentsdk/elements
export type { UIMessage, UIMessagePart } from "deepagentsdk/elements";

// QueueTodo type for Queue component (matching queue.tsx)
export type QueueTodo = {
  id: string;
  title: string;
  description?: string;
  status?: "pending" | "completed";
};

// UI status based on chat state
type UIStatusState = "submitted" | "streaming" | "ready" | "error";

export interface UseChatAPIReturn {
  uiMessages: any[];
  uiStatus: UIStatusState;
  taskParts: any[];
  todos: QueueTodo[];
  sandboxId: string;
  filePaths: string[];
  sendMessage: (message: { text: string }) => Promise<void>;
  abort: () => void;
  clear: () => void;
  refreshFiles: () => Promise<void>;
}

/**
 * Hook that calls the deepagentsdk API via /api/chat endpoint
 *
 * The server-side route uses createElementsRouteHandler from deepagentsdk/elements
 * which streams responses in the AI SDK UI Message Stream Protocol with full event visibility.
 */
export function useChatAPI(): UseChatAPIReturn {
  // Use a constant sandbox ID for the local sandbox
  const sandboxId = "local";
  const [filePaths, setFilePaths] = useState<string[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [status, setStatus] = useState<UIStatusState>("ready");
  const [todos, setTodos] = useState<QueueTodo[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Function to refresh file list from sandbox
  const refreshFiles = useCallback(async () => {
    try {
      const response = await fetch(`/api/sandboxes/${sandboxId}/files`);
      if (response.ok) {
        const data = await response.json();
        if (data.files && Array.isArray(data.files)) {
          setFilePaths(data.files);
        }
      }
    } catch (error) {
      console.error("Failed to refresh files:", error);
    }
  }, [sandboxId]);

  // Refresh files on mount
  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  // Send message to the API
  const sendMessage = useCallback(async (message: { text: string }) => {
    if (!message.text.trim()) {
      return;
    }

    // Reset for new generation
    setStatus("streaming");
    abortControllerRef.current = new AbortController();

    // Convert messages to AI SDK UI Message format
    // The createElementsRouteHandler expects messages with 'parts' array
    const uiMessages = messages.map((msg) => ({
      id: msg.id || `msg-${Date.now()}-${Math.random()}`,
      role: msg.role,
      parts: msg.parts || [
        {
          type: "text",
          text: msg.content || "",
        },
      ],
    }));

    // Add the new user message
    uiMessages.push({
      id: `msg-${Date.now()}-new`,
      role: "user",
      parts: [
        {
          type: "text",
          text: message.text,
        },
      ],
    });

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: uiMessages,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No reader available");
      }

      const decoder = new TextDecoder();
      const accumulatedChunks: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              setStatus("ready");
              break;
            }

            try {
              const event = JSON.parse(data);

              // Handle different event types from the Elements adapter
              // The protocol uses text-delta, tool-input-available, etc.
              if (event.type === "text-delta" || event.type === "text") {
                accumulatedChunks.push(event.text || event.delta || "");
              } else if (event.type === "tool-input-available") {
                // Tool call
                console.log("Tool called:", event.toolName);
              } else if (event.type === "tool-output-available") {
                // Tool result
                console.log("Tool result:", event.toolName);
                // Refresh files after tool results (file operations may have occurred)
                refreshFiles();
              }
            } catch (e) {
              console.error("Failed to parse SSE data:", data, e);
            }
          }
        }
      }

      // Add the complete response to messages in UI Message format
      const timestamp = Date.now();
      const userMessage = {
        id: `msg-${timestamp}-user`,
        role: "user" as const,
        parts: [
          {
            type: "text" as const,
            text: message.text,
          },
        ],
      };

      const assistantMessage = {
        id: `msg-${timestamp}-assistant`,
        role: "assistant" as const,
        parts: [
          {
            type: "text" as const,
            text: accumulatedChunks.join(""),
          },
        ],
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);

      setStatus("ready");
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setStatus("ready");
      } else {
        console.error("Error sending message:", err);
        setStatus("error");
      }
    } finally {
      abortControllerRef.current = null;
    }
  }, [messages, refreshFiles]);

  // Abort the current request
  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setStatus("ready");
    }
  }, []);

  // Clear all messages
  const clear = useCallback(() => {
    setMessages([]);
    setTodos([]);
    setStatus("ready");
    // Refresh files on clear to show current state
    refreshFiles();
  }, [refreshFiles]);

  // Extract task parts from tool calls in the messages
  const taskParts = extractTaskPartsFromMessages(messages);

  return {
    uiMessages: messages,
    uiStatus: status,
    taskParts,
    todos,
    sandboxId,
    filePaths,
    sendMessage,
    abort,
    clear,
    refreshFiles,
  };
}

/**
 * Extract task parts from UI messages by grouping tool calls with their results
 */
function extractTaskPartsFromMessages(messages: any[]): any[] {
  const toolMap = new Map<any, any>();

  // Group tool calls and results
  for (const msg of messages) {
    if (msg.role === "assistant" && msg.parts) {
      for (const part of msg.parts) {
        if (part.type === "tool-call") {
          toolMap.set(part.toolCallId, {
            call: {
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              args: part.args,
            },
          });
        } else if (part.type === "tool-result") {
          const existing = toolMap.get(part.toolCallId);
          if (existing) {
            existing.result = {
              result: part.result,
              isError: part.isError,
            };
          }
        }
      }
    }
  }

  // Convert to task parts
  return Array.from(toolMap.values()).map(({ call, result }) => {
    const items: any[] = [];

    // Input item
    if (call.args) {
      items.push({
        type: "input",
        content: formatToolInput(call.toolName, call.args),
        data: call.args,
      });
    }

    // Determine status and add result item
    let taskStatus: "pending" | "in_progress" | "completed" | "error" = "pending";
    if (result) {
      if (result.isError) {
        taskStatus = "error";
        items.push({
          type: "error",
          content: String(result.result),
          data: result.result,
        });
      } else {
        taskStatus = "completed";
        items.push({
          type: "result",
          content: formatToolResult(result.result),
          data: result.result,
        });
      }
    } else {
      taskStatus = "in_progress";
      items.push({
        type: "processing",
        content: "Running...",
      });
    }

    return {
      toolCallId: call.toolCallId,
      toolName: call.toolName,
      status: taskStatus,
      items,
    };
  });
}

function formatToolInput(_toolName: string, args: unknown): string {
  if (typeof args === "object" && args !== null) {
    const entries = Object.entries(args as Record<string, unknown>);
    if (entries.length === 1) {
      const [key, value] = entries[0];
      return `Running with ${key}: ${JSON.stringify(value)}`;
    }
    return `Running with parameters`;
  }
  return `Running with: ${JSON.stringify(args)}`;
}

function formatToolResult(result: unknown): string {
  if (typeof result === "object" && result !== null) {
    return "Completed";
  }
  return `Completed: ${String(result)}`;
}
