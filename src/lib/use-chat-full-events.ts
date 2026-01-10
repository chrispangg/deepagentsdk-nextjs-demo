/**
 * Enhanced client-side hook for calling the deepagentsdk API
 *
 * This hook extends the standard useChatAPI to handle all 26 DeepAgent event types.
 * It processes the streaming events and maintains state for file operations,
 * command execution, web requests, and subagent lifecycle.
 */

import { useState, useCallback, useRef, useEffect } from "react";

// Event state types
export interface FileEvent {
  type: 'file-write-start' | 'file-written' | 'file-edited' | 'file-read' | 'ls' | 'glob' | 'grep';
  path?: string;
  content?: string;
  lines?: number;
  occurrences?: number;
  count?: number;
  pattern?: string;
  timestamp: number;
}

export interface CommandEvent {
  type: 'execute-start' | 'execute-finish';
  command: string;
  sandboxId: string;
  exitCode?: number | null;
  truncated?: boolean;
  timestamp: number;
}

export interface WebEvent {
  type: 'web-search-start' | 'web-search-finish' | 'http-request-start' | 'http-request-finish' | 'fetch-url-start' | 'fetch-url-finish';
  query?: string;
  url?: string;
  method?: string;
  statusCode?: number;
  resultCount?: number;
  success?: boolean;
  timestamp: number;
}

export interface SubagentEvent {
  type: 'subagent-start' | 'subagent-finish' | 'subagent-step';
  name: string;
  task?: string;
  result?: string;
  stepIndex?: number;
  toolCalls?: Array<{
    toolName: string;
    args: unknown;
    result: unknown;
  }>;
  timestamp: number;
}

// UI status based on chat state
type UIStatusState = "submitted" | "streaming" | "ready" | "error";

export interface UseChatFullEventsReturn {
  // Standard chat state (matching useChatAPI for compatibility)
  uiMessages: any[];
  uiStatus: UIStatusState;
  taskParts: any[];
  todos: any[];
  sandboxId: string;
  filePaths: string[];
  errorMessage: string | null;

  // Actions
  sendMessage: (message: { text: string }) => Promise<void>;
  abort: () => void;
  clear: () => void;
  clearEvents: () => void;
  refreshFiles: () => Promise<void>;
}

/**
 * Enhanced chat hook that handles all DeepAgent custom events.
 *
 * Extends useChatAPI with real-time event state management for file operations,
 * command execution, web requests, and subagent lifecycle.
 *
 * Compatible with the createFullEventsHandler server-side implementation.
 */
export function useChatFullEvents(): UseChatFullEventsReturn {
  // Use a constant sandbox ID for the local sandbox
  const sandboxId = "local";
  const [filePaths, setFilePaths] = useState<string[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [status, setStatus] = useState<UIStatusState>("ready");
  const [todos, setTodos] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const currentMessageIdRef = useRef<string | null>(null);

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

  /**
   * Append a part to the current message being streamed
   */
  const appendPartToCurrentMessage = useCallback((part: any) => {
    if (!currentMessageIdRef.current) return;

    setMessages(prev => prev.map(msg => {
      if (msg.id === currentMessageIdRef.current) {
        return {
          ...msg,
          parts: [...msg.parts, part]
        };
      }
      return msg;
    }));
  }, []);

  /**
   * Route custom data events and append as parts to current message
   */
  const handleDataEvent = useCallback((name: string, data: any) => {
    const timestamp = Date.now();

    // File events
    if ([
      'file-write-start',
      'file-written',
      'file-edited',
      'file-read',
      'ls',
      'glob',
      'grep'
    ].includes(name)) {
      const eventPart = {
        type: name,  // Use actual event type directly
        ...data,
        timestamp
      };
      appendPartToCurrentMessage(eventPart);
      return;
    }

    // Command events
    if (['execute-start', 'execute-finish'].includes(name)) {
      const eventPart = {
        type: name,  // Use actual event type directly
        ...data,
        timestamp
      };
      appendPartToCurrentMessage(eventPart);
      return;
    }

    // Web events
    if ([
      'web-search-start',
      'web-search-finish',
      'http-request-start',
      'http-request-finish',
      'fetch-url-start',
      'fetch-url-finish'
    ].includes(name)) {
      const eventPart = {
        type: name,  // Use actual event type directly
        ...data,
        timestamp
      };
      appendPartToCurrentMessage(eventPart);
      return;
    }

    // Subagent events
    if (['subagent-start', 'subagent-finish', 'subagent-step'].includes(name)) {
      const eventPart = {
        type: name,  // Use actual event type directly
        ...data,
        timestamp
      };
      appendPartToCurrentMessage(eventPart);
      return;
    }

    // Todos event (existing)
    if (name === 'todos-changed') {
      // Transform DeepAgent todos to UI format
      // DeepAgent TodoItem has: id, content, status
      // UI QueueTodo expects: id, title, status
      const transformedTodos = (data.todos || []).map((todo: any) => ({
        id: todo.id,
        title: todo.content,  // Map content to title
        status: todo.status === 'completed' ? 'completed' : 'pending',
      }));
      setTodos(transformedTodos);
      return;
    }
  }, [appendPartToCurrentMessage]);

  // Send message to the API
  const sendMessage = useCallback(async (message: { text: string }) => {
    if (!message.text.trim()) {
      return;
    }

    // Reset for new generation
    setStatus("streaming");
    setErrorMessage(null); // Clear any previous errors
    abortControllerRef.current = new AbortController();

    // Convert messages to AI SDK UI Message format
    // The createFullEventsHandler expects messages with 'parts' array
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
    const userMessageId = `msg-${Date.now()}-user`;
    uiMessages.push({
      id: userMessageId,
      role: "user",
      parts: [
        {
          type: "text",
          text: message.text,
        },
      ],
    });

    // Create an empty assistant message immediately that will be populated as events stream in
    const assistantMessageId = `msg-${Date.now()}-assistant`;
    const assistantMessage = {
      id: assistantMessageId,
      role: "assistant" as const,
      parts: [] as any[],
    };
    currentMessageIdRef.current = assistantMessageId;

    // Add user message to state
    setMessages(prev => [...prev,
      {
        id: userMessageId,
        role: "user",
        parts: [{ type: "text", text: message.text }],
      },
      assistantMessage
    ]);

    try {
      // Import settings dynamically to avoid circular dependencies
      const { useSettings } = await import("@/components/settings/use-settings");
      const settings = useSettings.getState();

      // Helper function to convert [FROM_SERVER] markers to empty strings for the server
      const prepareKeyForServer = (key: string) => {
        return key === "[FROM_SERVER]" ? "" : key;
      };

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: uiMessages,
          settings: {
            anthropicApiKey: prepareKeyForServer(settings.anthropicApiKey),
            anthropicBaseUrl: settings.anthropicBaseUrl,
            tavilyApiKey: prepareKeyForServer(settings.tavilyApiKey),
            openaiApiKey: prepareKeyForServer(settings.openaiApiKey),
            selectedProvider: settings.selectedProvider,
            selectedModel: settings.selectedModel,
            useServerDefaults: settings.useServerDefaults,
          },
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // If we can't parse the error, use the default message
        }
        throw new Error(errorMessage);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No reader available");
      }

      const decoder = new TextDecoder();
      let currentText = "";

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
              currentMessageIdRef.current = null;
              break;
            }

            try {
              const event = JSON.parse(data);

              // Handle different event types from the Elements adapter
              if (event.type === "text-delta" || event.type === "text") {
                const text = event.text || event.delta || "";
                currentText += text;

                // Update the current text part in the message
                setMessages(prev => prev.map(msg => {
                  if (msg.id === assistantMessageId) {
                    // Check if there's already a text part at the end
                    const newParts = [...msg.parts];
                    const lastPart = newParts[newParts.length - 1];

                    if (lastPart && lastPart.type === "text") {
                      // Update existing text part
                      newParts[newParts.length - 1] = {
                        ...lastPart,
                        text: currentText
                      };
                    } else {
                      // Add new text part
                      newParts.push({
                        type: "text",
                        text: currentText
                      });
                    }

                    return { ...msg, parts: newParts };
                  }
                  return msg;
                }));
              } else if (event.type === "tool-input-available") {
                console.log("Tool called:", event.toolName);
              } else if (event.type === "tool-output-available") {
                console.log("Tool result:", event.toolName);
                // Refresh files after tool results (file operations may have occurred)
                refreshFiles();
              } else if (event.type === "data") {
                // Handle custom data events
                handleDataEvent(event.name, event.data);
              }
            } catch (e) {
              console.error("Failed to parse SSE data:", data, e);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error("Chat error:", error);
        setStatus("error");
        setErrorMessage(error.message || "An unexpected error occurred");
      } else {
        setStatus("ready");
      }
      currentMessageIdRef.current = null;
    }
  }, [messages, refreshFiles, handleDataEvent]);

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
    refreshFiles();
  }, [refreshFiles]);

  // Clear only custom events from messages
  const clearEvents = useCallback(() => {
    // Remove event-type parts from all messages
    const eventTypes = [
      // File events
      'file-write-start', 'file-written', 'file-edited', 'file-read', 'ls', 'glob', 'grep',
      // Command events
      'execute-start', 'execute-finish',
      // Web events
      'web-search-start', 'web-search-finish', 'http-request-start', 'http-request-finish', 'fetch-url-start', 'fetch-url-finish',
      // Subagent events
      'subagent-start', 'subagent-finish', 'subagent-step'
    ];

    setMessages(prev => prev.map(msg => ({
      ...msg,
      parts: msg.parts.filter((part: any) => !eventTypes.includes(part.type))
    })));
  }, []);

  // Extract task parts from tool calls in the messages
  const extractTaskParts = useCallback(() => {
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
        const argsStr = typeof call.args === 'string' ? call.args : JSON.stringify(call.args, null, 2);
        items.push({
          type: "input",
          content: argsStr,
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
          const resultStr = typeof result.result === 'string' ? result.result : JSON.stringify(result.result, null, 2);
          items.push({
            type: "result",
            content: resultStr,
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
  }, [messages]);

  const taskParts = extractTaskParts();

  return {
    uiMessages: messages,
    uiStatus: status,
    taskParts,
    todos,
    sandboxId,
    filePaths,
    errorMessage,
    sendMessage,
    abort,
    clear,
    clearEvents,
    refreshFiles,
  };
}
