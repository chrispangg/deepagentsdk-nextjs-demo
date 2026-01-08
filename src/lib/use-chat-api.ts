/**
 * Client-side hook for calling the deepagentsdk API
 *
 * This hook calls the /api/chat endpoint and processes the streaming events,
 * converting them to UI-compatible formats for AI SDK Elements components.
 */

import { useState, useCallback, useRef, useMemo } from "react";

// Import adapter utilities (adapted from deepagentsdk/elements)
import {
  convertEventsToUIMessages,
  extractToolParts,
  mapAgentStatusToUIStatus,
  type UIMessage,
  type UIMessagePart,
  type UIStatus,
  type PromptInputMessage,
  type ToolUIPart,
} from "./use-chat-api-utils";

// Types for AI SDK Elements adapter

// Task types for displaying tool calls as workflow tasks
export interface TaskItem {
  type: "input" | "processing" | "result" | "error";
  content: string;
  data?: unknown;
}

export interface TaskUIPart {
  toolCallId: string;
  toolName: string;
  status: "pending" | "in_progress" | "completed" | "error";
  items: TaskItem[];
}

// Todo types from deepagentsdk (matching src/types/core.ts)
export interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
}

// Re-export shared types for convenience
export type { UIMessage, UIMessagePart, UIStatus, PromptInputMessage, ToolUIPart };

// QueueTodo type for Queue component (matching queue.tsx)
export type QueueTodo = {
  id: string;
  title: string;
  description?: string;
  status?: "pending" | "completed";
};

export interface UseChatAPIReturn {
  uiMessages: UIMessage[];
  uiStatus: UIStatus;
  toolParts: ToolUIPart[];
  taskParts: TaskUIPart[];
  todos: QueueTodo[];
  sandboxId: string;
  filePaths: string[];
  sendMessage: (message: PromptInputMessage) => Promise<void>;
  abort: () => void;
  clear: () => void;
  refreshFiles: () => Promise<void>;
}

// Agent status and event types
type AgentStatus = "idle" | "thinking" | "streaming" | "tool-call" | "done" | "error" | "subagent";

interface AgentEventLog {
  id: string;
  type: string;
  event: any;
  timestamp: Date;
}

let eventCounter = 0;

function createEventId(): string {
  return `event-${++eventCounter}`;
}

// Note: Core adapter utilities (mapAgentStatusToUIStatus, convertEventsToUIMessages,
// extractToolParts) are imported from ./use-chat-api-utils.ts (adapted from deepagentsdk/elements)

function convertToolPartsToTasks(
  toolParts: ToolUIPart[],
  uiStatus: UIStatus
): TaskUIPart[] {
  // Group tool-call and tool-result by toolCallId
  const toolMap = new Map<string, {
    call: ToolUIPart & { type: "tool-call" };
    result?: ToolUIPart & { type: "tool-result" };
  }>();

  for (const part of toolParts) {
    if (part.type === "tool-call") {
      toolMap.set(part.toolCallId, { call: part as ToolUIPart & { type: "tool-call" } });
    } else if (part.type === "tool-result") {
      const existing = toolMap.get(part.toolCallId);
      if (existing) {
        existing.result = part as ToolUIPart & { type: "tool-result" };
      }
    }
  }

  // Convert each tool to a task
  return Array.from(toolMap.values()).map(({ call, result }) => {
    const items: TaskItem[] = [];

    // Input item
    if (call.args) {
      items.push({
        type: "input",
        content: formatToolInput(call.toolName, call.args),
        data: call.args,
      });
    }

    // Determine status and add result item
    let status: TaskUIPart["status"] = "pending";
    if (result) {
      if (result.isError) {
        status = "error";
        items.push({
          type: "error",
          content: String(result.result),
          data: result.result,
        });
      } else {
        status = "completed";
        items.push({
          type: "result",
          content: formatToolResult(result.result),
          data: result.result,
        });
      }
    } else if (uiStatus === "submitted" || uiStatus === "streaming") {
      status = "in_progress";
      items.push({
        type: "processing",
        content: "Running...",
      });
    }

    return {
      toolCallId: call.toolCallId,
      toolName: call.toolName,
      status,
      items,
    };
  });
}

function formatToolInput(toolName: string, args: unknown): string {
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

/**
 * Convert deepagentsdk TodoItem to QueueTodo format for Queue component
 * Maps status: "pending"|"in_progress" → "pending", "completed"|"cancelled" → "completed"
 */
function convertToQueueTodos(todos: TodoItem[]): QueueTodo[] {
  return todos
    .filter((todo) => todo.status !== "cancelled") // Don't show cancelled todos
    .map((todo) => ({
      id: todo.id,
      title: todo.content,
      status: todo.status === "completed" ? "completed" : "pending",
    }));
}

/**
 * Hook that calls the deepagentsdk API and adapts the response
 * to work with AI SDK Elements UI components
 */
export function useChatAPI(): UseChatAPIReturn {
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [streamingText, setStreamingText] = useState("");
  const [events, setEvents] = useState<AgentEventLog[]>([]);
  const [todos, setTodos] = useState<QueueTodo[]>([]);
  const [filePaths, setFilePaths] = useState<string[]>([]);

  // Use a constant sandbox ID for the local sandbox
  const sandboxId = "local";

  const abortControllerRef = useRef<AbortController | null>(null);
  const accumulatedTextRef = useRef("");

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

  const addEvent = useCallback(
    (event: any) => {
      setEvents((prev) => [
        ...prev,
        {
          id: createEventId(),
          type: event.type,
          event,
          timestamp: new Date(),
        },
      ]);
    },
    []
  );

  // Flush accumulated text as a text-segment event
  const flushTextSegment = useCallback(() => {
    if (accumulatedTextRef.current.trim()) {
      addEvent({
        type: "text-segment",
        text: accumulatedTextRef.current,
      });
      accumulatedTextRef.current = "";
      setStreamingText("");
    }
  }, [addEvent]);

  const sendMessage = async (message: PromptInputMessage): Promise<void> => {
    if (!message.text.trim()) {
      return;
    }

    // Reset for new generation
    setStatus("thinking");
    setStreamingText("");
    accumulatedTextRef.current = "";

    // Add user message to events
    addEvent({ type: "user-message", content: message.text });

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: message.text }),
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              setStatus("idle");
              break;
            }

            try {
              const event = JSON.parse(data);

              switch (event.type) {
                case "text":
                  setStatus("streaming");
                  accumulatedTextRef.current += event.text;
                  setStreamingText(accumulatedTextRef.current);
                  break;

                case "step-start":
                  if (event.stepNumber > 1) {
                    addEvent(event);
                  }
                  break;

                case "tool-call":
                  flushTextSegment();
                  setStatus("tool-call");
                  addEvent(event);
                  break;

                case "tool-result":
                  addEvent(event);
                  // Refresh files after tool results (file operations may have occurred)
                  refreshFiles();
                  break;

                case "todos-changed":
                  flushTextSegment();
                  setStatus("tool-call");
                  addEvent(event);
                  // Update todos state for Queue component
                  if (event.todos && Array.isArray(event.todos)) {
                    setTodos(convertToQueueTodos(event.todos));
                  }
                  break;

                case "done":
                  flushTextSegment();
                  setStatus("done");
                  addEvent(event);
                  break;

                case "error":
                  flushTextSegment();
                  setStatus("error");
                  addEvent(event);
                  break;

                default:
                  addEvent(event);
                  break;
              }
            } catch (e) {
              console.error("Failed to parse SSE data:", data, e);
            }
          }
        }

        setStatus("idle");
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        flushTextSegment();
        setStatus("idle");
      } else {
        flushTextSegment();
        setStatus("error");
        addEvent({ type: "error", error: String(err) });
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setStatus("idle");
    }
  }, []);

  const clear = useCallback(() => {
    setEvents([]);
    setStreamingText("");
    setTodos([]);
    setStatus("idle");
    // Refresh files on clear to show current state
    refreshFiles();
  }, [refreshFiles]);

  // Convert agent status to UI status
  const uiStatus = useMemo(() => mapAgentStatusToUIStatus(status), [status]);

  // Convert events to UI messages
  const uiMessages = useMemo(
    () => convertEventsToUIMessages(events, streamingText, uiStatus),
    [events, streamingText, uiStatus]
  );

  // Extract tool parts from current message
  const toolParts = useMemo(() => extractToolParts(uiMessages), [uiMessages]);

  // Convert tool parts to task parts
  const taskParts = useMemo(
    () => convertToolPartsToTasks(toolParts, uiStatus),
    [toolParts, uiStatus]
  );

  return {
    uiMessages,
    uiStatus,
    toolParts, // Keep for backward compatibility
    taskParts,  // New: Task parts for Task component
    todos,  // Todos for Queue component
    sandboxId,  // Sandbox identifier for file explorer
    filePaths,  // File paths in sandbox
    sendMessage,
    abort,
    clear,
    refreshFiles,  // Function to manually refresh files
  };
}
