/**
 * Utility functions for use-chat-api.ts
 *
 * These functions are adapted from deepagentsdk/src/adapters/elements
 * to work with the server-side streaming architecture.
 *
 * Original source: deepagentsdk (MIT License)
 * https://github.com/chrispangg/deepagentsdk
 */

export type UIMessagePart =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "tool-call";
      toolCallId: string;
      toolName: string;
      args: unknown;
    }
  | {
      type: "tool-result";
      toolCallId: string;
      toolName: string;
      result: unknown;
      isError?: boolean;
    };

export interface UIMessage {
  id: string;
  role: "user" | "assistant";
  parts: UIMessagePart[];
  status: "submitted" | "streaming" | "ready" | "error";
}

export type UIStatus = "submitted" | "streaming" | "ready" | "error";

export interface PromptInputMessage {
  text: string;
}

export interface ToolUIPart {
  type: "tool-call" | "tool-result";
  toolCallId: string;
  toolName: string;
  args?: unknown;
  result?: unknown;
  isError?: boolean;
}

interface AgentEventLog {
  id: string;
  type: string;
  event: any;
  timestamp: Date;
}

type AgentStatus = "idle" | "thinking" | "streaming" | "tool-call" | "done" | "error" | "subagent";

/**
 * Maps deepagentsdk AgentStatus to Elements UIStatus
 *
 * Adapted from: deepagentsdk/src/adapters/elements/statusAdapter.ts
 */
export function mapAgentStatusToUIStatus(agentStatus: AgentStatus): UIStatus {
  switch (agentStatus) {
    case "thinking":
    case "tool-call":
    case "subagent":
      return "submitted";
    case "streaming":
      return "streaming";
    case "error":
      return "error";
    case "idle":
    case "done":
    default:
      return "ready";
  }
}

/**
 * Converts agent event log to UIMessage format expected by Elements
 *
 * Adapted from: deepagentsdk/src/adapters/elements/messageAdapter.ts
 */
export function convertEventsToUIMessages(
  events: AgentEventLog[],
  streamingText: string,
  uiStatus: UIStatus
): UIMessage[] {
  const messages: UIMessage[] = [];
  let currentAssistantParts: UIMessagePart[] = [];
  let messageIdCounter = 0;

  const generateMessageId = (): string => {
    return `msg-${Date.now()}-${++messageIdCounter}`;
  };

  for (const eventLog of events) {
    const event = eventLog.event;

    switch (event.type) {
      case "user-message":
        // Flush any pending assistant parts before user message
        if (currentAssistantParts.length > 0) {
          messages.push({
            id: generateMessageId(),
            role: "assistant",
            parts: currentAssistantParts,
            status: "ready",
          });
          currentAssistantParts = [];
        }

        // Add user message
        messages.push({
          id: eventLog.id,
          role: "user",
          parts: [{ type: "text", text: event.content }],
          status: "ready",
        });
        break;

      case "text-segment":
        // Add text segment as separate text part
        currentAssistantParts.push({
          type: "text",
          text: event.text,
        });
        break;

      case "tool-call":
        // Add tool call part
        currentAssistantParts.push({
          type: "tool-call",
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          args: event.args,
        });
        break;

      case "tool-result":
        // Add tool result part
        currentAssistantParts.push({
          type: "tool-result",
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          result: event.result,
          isError: event.isError,
        });
        break;

      default:
        break;
    }
  }

  // Add streaming text as in-progress assistant message
  if (streamingText || currentAssistantParts.length > 0) {
    if (streamingText) {
      currentAssistantParts.push({ type: "text", text: streamingText });
    }

    let messageStatus: UIStatus = "ready";
    if (uiStatus === "streaming") {
      messageStatus = "streaming";
    } else if (uiStatus === "submitted") {
      messageStatus = "submitted";
    } else if (uiStatus === "error") {
      messageStatus = "error";
    }

    messages.push({
      id: generateMessageId(),
      role: "assistant",
      parts: currentAssistantParts,
      status: messageStatus,
    });
  }

  return messages;
}

/**
 * Extracts tool parts from the most recent assistant message
 *
 * Adapted from: deepagentsdk/src/adapters/elements/messageAdapter.ts
 */
export function extractToolParts(messages: UIMessage[]): ToolUIPart[] {
  const lastAssistantMessage = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");

  if (!lastAssistantMessage) {
    return [];
  }

  return lastAssistantMessage.parts
    .filter(
      (part): part is Extract<UIMessagePart, { type: "tool-call" | "tool-result" }> =>
        part.type === "tool-call" || part.type === "tool-result"
    )
    .map((part) => {
      if (part.type === "tool-call") {
        return {
          type: "tool-call" as const,
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          args: part.args,
        };
      } else {
        return {
          type: "tool-result" as const,
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          result: part.result,
          isError: part.isError,
        };
      }
    });
}
