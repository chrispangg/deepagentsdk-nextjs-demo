import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import type { DeepAgent, DeepAgentState, DeepAgentEvent } from 'deepagentsdk';

export interface CreateFullEventsHandlerOptions {
  /**
   * The DeepAgent instance to use for handling requests
   */
  agent: DeepAgent;

  /**
   * Optional callback before processing a request.
   * Use for authentication, logging, rate limiting, etc.
   */
  onRequest?: (req: Request) => Promise<void> | void;

  /**
   * Optional initial state to provide to the agent.
   * If not provided, uses empty state { todos: [], files: {} }
   */
  initialState?: DeepAgentState;

  /**
   * Optional thread ID for checkpointing.
   * If provided, enables conversation persistence.
   */
  threadId?: string;

  /**
   * Optional maximum number of steps for the agent loop.
   */
  maxSteps?: number;

  /**
   * Custom ID generator for message IDs.
   * Defaults to crypto.randomUUID if available.
   */
  generateId?: () => string;
}

/**
 * Creates a route handler that processes chat requests using DeepAgent
 * and streams all 26 event types in UI Message Stream Protocol format.
 *
 * This is a drop-in replacement for createElementsRouteHandler that
 * provides full event visibility including file operations, command
 * execution, web requests, and subagent lifecycle.
 *
 * @example
 * ```typescript
 * import { createDeepAgent, LocalSandbox } from 'deepagentsdk';
 * import { createFullEventsHandler } from '@/lib/create-full-events-handler';
 * import { anthropic } from '@ai-sdk/anthropic';
 *
 * const sandbox = new LocalSandbox({ cwd: './workspace' });
 * const agent = createDeepAgent({
 *   model: anthropic('claude-haiku-4-5-20251001'),
 *   backend: sandbox,
 * });
 *
 * export const POST = createFullEventsHandler({ agent });
 * ```
 */
export function createFullEventsHandler(
  options: CreateFullEventsHandlerOptions
): (req: Request) => Promise<Response> {
  const {
    agent,
    onRequest,
    initialState = {
      todos: [],
      files: {}
    },
    threadId,
    maxSteps,
    generateId
  } = options;

  return async (req: Request) => {
    // 1. Handle onRequest hook (auth, logging, rate limiting)
    if (onRequest) {
      try {
        await onRequest(req);
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: error instanceof Error ? error.message : 'Request rejected'
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // 2. Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const { messages } = requestBody;
    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'messages array is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 3. Convert UI messages to model messages
    const modelMessages = await convertToModelMessages(messages);

    // 4. Setup ID generator
    const genId = generateId || (() => crypto.randomUUID());

    // 5. Track current text ID for text-start/text-end
    let currentTextId: string | null = null;

    // 6. Create UI message stream response
    return createUIMessageStreamResponse({
      stream: createUIMessageStream({
        originalMessages: messages,
        generateId: genId,
        execute: async ({ writer }) => {
          try {
            // Stream all events from DeepAgent
            for await (const event of agent.streamWithEvents({
              messages: modelMessages,
              state: initialState,
              threadId,
              maxSteps
            })) {
              // Update currentTextId from the returned value
              const result = mapEventToProtocol(event, writer, genId, currentTextId);
              if (typeof result === 'string') {
                currentTextId = result;
              } else if (result === null) {
                currentTextId = null;
              }
            }

            // Ensure text is properly closed
            if (currentTextId) {
              writer.write({
                type: 'text-end',
                id: currentTextId
              });
            }
          } catch (error) {
            // Close text if error occurs mid-stream
            if (currentTextId) {
              writer.write({
                type: 'text-end',
                id: currentTextId
              });
            }
            throw error;
          }
        },
        onError: (error) => {
          return error instanceof Error ? error.message : 'Unknown error';
        }
      })
    });
  };
}

/**
 * Maps a DeepAgent event to a UI protocol event.
 * Returns the new currentTextId value (string | null).
 */
function mapEventToProtocol(
  event: DeepAgentEvent,
  writer: { write: (chunk: any) => void },
  genId: () => string,
  currentTextId: string | null
): string | null {
  switch (event.type) {
    // ============================================================================
    // TEXT & FLOW EVENTS (Required for compatibility)
    // ============================================================================

    case 'step-start':
      writer.write({ type: 'start-step' });
      return currentTextId;

    case 'step-finish':
      writer.write({ type: 'finish-step' });
      return currentTextId;

    case 'text':
      // Start text if not already started
      if (!currentTextId) {
        const textId = genId();
        writer.write({
          type: 'text-start',
          id: textId
        });
        return textId;
      }
      writer.write({
        type: 'text-delta',
        id: currentTextId,
        delta: event.text
      });
      return currentTextId;

    // ============================================================================
    // TOOL EVENTS (Standard protocol events)
    // ============================================================================

    case 'tool-call':
      // End text before tool call
      if (currentTextId) {
        writer.write({
          type: 'text-end',
          id: currentTextId
        });
        currentTextId = null;
      }
      writer.write({
        type: 'tool-input-available',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        input: event.args
      });
      return null;

    case 'tool-result':
      if (event.isError) {
        writer.write({
          type: 'tool-output-error',
          toolCallId: event.toolCallId,
          errorText: String(event.result)
        });
      } else {
        writer.write({
          type: 'tool-output-available',
          toolCallId: event.toolCallId,
          output: event.result
        });
      }
      return currentTextId;

    // ============================================================================
    // TODO & PLANNING EVENTS
    // ============================================================================

    case 'todos-changed':
      writer.write({
        type: 'data',
        name: 'todos-changed',
        data: { todos: event.todos }
      });
      return currentTextId;

    // ============================================================================
    // FILE SYSTEM EVENTS (Custom data events)
    // ============================================================================

    case 'file-write-start':
      writer.write({
        type: 'data',
        name: 'file-write-start',
        data: {
          path: event.path,
          content: event.content
        }
      });
      return currentTextId;

    case 'file-written':
      writer.write({
        type: 'data',
        name: 'file-written',
        data: {
          path: event.path,
          content: event.content
        }
      });
      return currentTextId;

    case 'file-edited':
      writer.write({
        type: 'data',
        name: 'file-edited',
        data: {
          path: event.path,
          occurrences: event.occurrences
        }
      });
      return currentTextId;

    case 'file-read':
      writer.write({
        type: 'data',
        name: 'file-read',
        data: {
          path: event.path,
          lines: event.lines
        }
      });
      return currentTextId;

    case 'ls':
      writer.write({
        type: 'data',
        name: 'ls',
        data: {
          path: event.path,
          count: event.count
        }
      });
      return currentTextId;

    case 'glob':
      writer.write({
        type: 'data',
        name: 'glob',
        data: {
          pattern: event.pattern,
          count: event.count
        }
      });
      return currentTextId;

    case 'grep':
      writer.write({
        type: 'data',
        name: 'grep',
        data: {
          pattern: event.pattern,
          count: event.count
        }
      });
      return currentTextId;

    // ============================================================================
    // EXECUTION EVENTS (Custom data events)
    // ============================================================================

    case 'execute-start':
      writer.write({
        type: 'data',
        name: 'execute-start',
        data: {
          command: event.command,
          sandboxId: event.sandboxId
        }
      });
      return currentTextId;

    case 'execute-finish':
      writer.write({
        type: 'data',
        name: 'execute-finish',
        data: {
          command: event.command,
          exitCode: event.exitCode,
          truncated: event.truncated,
          sandboxId: event.sandboxId
        }
      });
      return currentTextId;

    // ============================================================================
    // WEB EVENTS (Custom data events)
    // ============================================================================

    case 'web-search-start':
      writer.write({
        type: 'data',
        name: 'web-search-start',
        data: {
          query: event.query
        }
      });
      return currentTextId;

    case 'web-search-finish':
      writer.write({
        type: 'data',
        name: 'web-search-finish',
        data: {
          query: event.query,
          resultCount: event.resultCount
        }
      });
      return currentTextId;

    case 'http-request-start':
      writer.write({
        type: 'data',
        name: 'http-request-start',
        data: {
          url: event.url,
          method: event.method
        }
      });
      return currentTextId;

    case 'http-request-finish':
      writer.write({
        type: 'data',
        name: 'http-request-finish',
        data: {
          url: event.url,
          statusCode: event.statusCode
        }
      });
      return currentTextId;

    case 'fetch-url-start':
      writer.write({
        type: 'data',
        name: 'fetch-url-start',
        data: {
          url: event.url
        }
      });
      return currentTextId;

    case 'fetch-url-finish':
      writer.write({
        type: 'data',
        name: 'fetch-url-finish',
        data: {
          url: event.url,
          success: event.success
        }
      });
      return currentTextId;

    // ============================================================================
    // SUBAGENT EVENTS (Custom data events)
    // ============================================================================

    case 'subagent-start':
      writer.write({
        type: 'data',
        name: 'subagent-start',
        data: {
          name: event.name,
          task: event.task
        }
      });
      return currentTextId;

    case 'subagent-finish':
      writer.write({
        type: 'data',
        name: 'subagent-finish',
        data: {
          name: event.name,
          result: event.result
        }
      });
      return currentTextId;

    case 'subagent-step':
      writer.write({
        type: 'data',
        name: 'subagent-step',
        data: {
          stepIndex: event.stepIndex,
          toolCalls: event.toolCalls
        }
      });
      return currentTextId;

    // ============================================================================
    // CONTROL EVENTS
    // ============================================================================

    case 'error':
      // End text before error
      if (currentTextId) {
        writer.write({
          type: 'text-end',
          id: currentTextId
        });
        currentTextId = null;
      }
      writer.write({
        type: 'error',
        errorText: event.error.message
      });
      return null;

    case 'done':
      // End text before completion
      if (currentTextId) {
        writer.write({
          type: 'text-end',
          id: currentTextId
        });
        currentTextId = null;
      }
      // Send finish event
      writer.write({
        type: 'finish',
        finishReason: 'stop'
      });
      return null;

    // Ignore unhandled events (text-segment, user-message, approval events, checkpoint events)
    default:
      return currentTextId;
  }
}
