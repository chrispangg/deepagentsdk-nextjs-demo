---
date: 2026-01-09 10:30:00 AEDT
researcher: claude-sonnet-4-5
git_commit: d9e0a5211749d188c67b24e8f4024bde2d478b27
branch: main
repository: deepagentsdk-demo
topic: "Implementation Plan: Full Event Handler & UI Components for DeepAgentSDK"
tags: [implementation, plan, deepagentsdk, events, ui-components, custom-handler]
status: draft
last_updated: 2026-01-09
last_updated_by: claude-sonnet-4-5
---

# Implementation Plan: Full Event Handler & UI Components

## Overview

Create a production-ready custom route handler that replaces `createElementsRouteHandler` and streams all 26 DeepAgent event types to the client, along with a comprehensive UI component library for displaying each event category. The implementation will be structured as a drop-in replacement for the current adapter, designed for portability back to the deepagentsdk library.

**Key Goals:**

- Handle all 26 DeepAgent event types (currently only 8)
- Display events in real-time AND persist them in message history
- Create specific UI components for each event category
- Maintain full compatibility with `useChat` and AI SDK UI components
- Design for contribution to deepagentsdk library

## Current State Analysis

### Existing Implementation

**Source:** `node_modules/deepagentsdk/dist/adapters/elements/index.mjs:39-176`

The current `createElementsRouteHandler`:

- ✅ Maps 8 event types (text, tools, steps, todos, errors)
- ❌ Ignores 18 event types (file operations, execute, web, subagent, approvals, checkpoints)
- ✅ Fully compatible with AI SDK UI protocol
- ✅ Simple drop-in integration

**Client-side:** `src/lib/use-chat-api.ts:149-167`

- Only handles 3 streaming event types (text-delta, tool-input-available, tool-output-available)
- Tool data logged to console but not integrated into UI
- No real-time event display

### What's Missing

1. **File System Events** (6 types): File write, edit, read, ls, glob, grep operations not visible
2. **Execution Events** (2 types): Command start/finish not displayed
3. **Web Events** (6 types): Web searches, HTTP requests, URL fetching not shown
4. **Subagent Events** (3 types): Subagent lifecycle not visualized
5. **Event Persistence**: Custom events not stored in message parts
6. **UI Components**: No components for custom event types

## Desired End State

### Server-Side

**File:** `src/lib/create-full-events-handler.ts` (new)

```typescript
import { createDeepAgent } from 'deepagentsdk';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';

interface CreateFullEventsHandlerOptions {
  agent: DeepAgent;
  onRequest?: (req: Request) => Promise<void> | void;
  initialState?: DeepAgentState;
  threadId?: string;
  maxSteps?: number;
  generateId?: () => string;
}

export function createFullEventsHandler(
  options: CreateFullEventsHandlerOptions
): (req: Request) => Promise<Response> {
  // Implementation that handles all 26 event types
}
```

**Capabilities:**

- Maps all 26 DeepAgent events to UI protocol events
- Standard events (text, tools) → protocol events
- Custom events → `data-{name}` pattern
- Drop-in replacement for `createElementsRouteHandler`

### Client-Side

**File:** `src/lib/use-chat-full-events.ts` (new)

```typescript
export function useChatFullEvents(): UseChatFullEventsReturn {
  // Extends useChat with custom event handling
  // Maintains state for all event types
  // Persists events to message parts
}
```

**State Management:**

- Real-time event display via `onData` callback
- Event state for each category (files, commands, web, subagents)
- Message part persistence for history

### UI Components

**Files:** `src/components/events/` (new directory)

```
src/components/events/
├── index.ts                          # Export all components
├── file-event.tsx                    # File operations (6 types)
├── command-event.tsx                 # Command execution (2 types)
├── web-event.tsx                     # Web operations (3 types)
├── subagent-event.tsx                # Subagent lifecycle (3 types)
├── step-indicator.tsx                # Step progress
└── event-timeline.tsx                # Optional: Combined timeline view
```

**Component Features:**

- Real-time streaming updates
- Collapsible sections
- Status indicators (working, completed, error)
- Theme-aware (light/dark)
- Accessible (ARIA labels, keyboard nav)

## What We're NOT Doing

- ❌ **Approval workflow**: Tool approval UI will be implemented in a future ticket
- ❌ **Checkpoint UI**: Checkpoint save/load events will be logged but not displayed
- ❌ **Event filtering**: All events will be streamed (filtering can be added later)
- ❌ **Custom message part types**: Events will be stored as data parts, not new part types
- ❌ **Advanced subagent features**: No nested subagent-to-subagent communication UI

## Implementation Approach

### High-Level Strategy

1. **Phase 1: Custom Handler** - Build the enhanced route handler with full event mapping
2. **Phase 2: Client Extensions** - Extend useChat to handle custom data events
3. **Phase 3: UI Components** - Build event-specific components with distinctive UX
4. **Phase 4: Integration** - Replace current implementation and test

### Design Principles

- **Backward Compatible**: Drop-in replacement, no breaking changes
- **Type Safe**: Full TypeScript support with proper types
- **Performant**: Efficient event handling, minimal re-renders
- **Maintainable**: Clear separation of concerns, reusable components
- **Library Ready**: Structured for easy extraction to deepagentsdk

## Phase 1: Custom Handler Implementation

### Overview

Build a production-ready route handler that maps all 26 DeepAgent events to UI protocol events.

### Changes Required

#### 1. Custom Handler Core

**File:** `src/lib/create-full-events-handler.ts` (new)

```typescript
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
              mapEventToProtocol(event, writer, genId, currentTextId);
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
 */
function mapEventToProtocol(
  event: DeepAgentEvent,
  writer: { write: (chunk: any) => void },
  genId: () => string,
  currentTextId: string | null
): void {
  switch (event.type) {
    // ============================================================================
    // TEXT & FLOW EVENTS (Required for compatibility)
    // ============================================================================

    case 'step-start':
      writer.write({ type: 'start-step' });
      break;

    case 'step-finish':
      writer.write({ type: 'finish-step' });
      break;

    case 'text':
      // Start text if not already started
      if (!currentTextId) {
        const textId = genId();
        writer.write({
          type: 'text-start',
          id: textId
        });
      }
      writer.write({
        type: 'text-delta',
        id: currentTextId || genId(),
        delta: event.text
      });
      break;

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
      break;

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
      break;

    // ============================================================================
    // TODO & PLANNING EVENTS
    // ============================================================================

    case 'todos-changed':
      writer.write({
        type: 'data',
        name: 'todos-changed',
        data: { todos: event.todos }
      });
      break;

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
      break;

    case 'file-written':
      writer.write({
        type: 'data',
        name: 'file-written',
        data: {
          path: event.path,
          content: event.content
        }
      });
      break;

    case 'file-edited':
      writer.write({
        type: 'data',
        name: 'file-edited',
        data: {
          path: event.path,
          occurrences: event.occurrences
        }
      });
      break;

    case 'file-read':
      writer.write({
        type: 'data',
        name: 'file-read',
        data: {
          path: event.path,
          lines: event.lines
        }
      });
      break;

    case 'ls':
      writer.write({
        type: 'data',
        name: 'ls',
        data: {
          path: event.path,
          count: event.count
        }
      });
      break;

    case 'glob':
      writer.write({
        type: 'data',
        name: 'glob',
        data: {
          pattern: event.pattern,
          count: event.count
        }
      });
      break;

    case 'grep':
      writer.write({
        type: 'data',
        name: 'grep',
        data: {
          pattern: event.pattern,
          count: event.count
        }
      });
      break;

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
      break;

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
      break;

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
      break;

    case 'web-search-finish':
      writer.write({
        type: 'data',
        name: 'web-search-finish',
        data: {
          query: event.query,
          resultCount: event.resultCount
        }
      });
      break;

    case 'http-request-start':
      writer.write({
        type: 'data',
        name: 'http-request-start',
        data: {
          url: event.url,
          method: event.method
        }
      });
      break;

    case 'http-request-finish':
      writer.write({
        type: 'data',
        name: 'http-request-finish',
        data: {
          url: event.url,
          statusCode: event.statusCode
        }
      });
      break;

    case 'fetch-url-start':
      writer.write({
        type: 'data',
        name: 'fetch-url-start',
        data: {
          url: event.url
        }
      });
      break;

    case 'fetch-url-finish':
      writer.write({
        type: 'data',
        name: 'fetch-url-finish',
        data: {
          url: event.url,
          success: event.success
        }
      });
      break;

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
      break;

    case 'subagent-finish':
      writer.write({
        type: 'data',
        name: 'subagent-finish',
        data: {
          name: event.name,
          result: event.result
        }
      });
      break;

    case 'subagent-step':
      writer.write({
        type: 'data',
        name: 'subagent-step',
        data: {
          stepIndex: event.stepIndex,
          toolCalls: event.toolCalls
        }
      });
      break;

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
      break;

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
      break;

    // Ignore unhandled events
    default:
      break;
  }
}
```

### Success Criteria

#### Automated Verification

- [ ] TypeScript compiles without errors: `npx tsc --noEmit`
- [ ] No eslint errors: `npm run lint`
- [ ] Test passes: Create test that verifies all 26 event types are mapped

#### Manual Verification

- [ ] Handler can be imported and used like `createElementsRouteHandler`
- [ ] All event types stream to client
- [ ] SSE protocol is valid
- [ ] Error handling works correctly

---

## Phase 2: Client-Side Event Processing

### Overview

Extend the chat API hook to handle all custom data events and maintain state for each event category.

### Changes Required

#### 1. Enhanced Chat Hook

**File:** `src/lib/use-chat-full-events.ts` (new)

```typescript
import { useChat } from '@ai-sdk/react';
import { useState, useCallback } from 'react';

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

export interface UseChatFullEventsReturn {
  // useChat returns
  messages: any[];
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (e: React.FormEvent) => void;
  status: 'pending' | 'streaming' | 'error' | 'ready';

  // Custom event state
  fileEvents: FileEvent[];
  commandEvents: CommandEvent[];
  webEvents: WebEvent[];
  subagentEvents: SubagentEvent[];

  // Actions
  sendMessage: (content: string) => void;
  clearEvents: () => void;
}

/**
 * Enhanced chat hook that handles all DeepAgent custom events.
 *
 * Extends useChat with real-time event state management for file operations,
 * command execution, web requests, and subagent lifecycle.
 */
export function useChatFullEvents({
  api = '/api/chat'
}: {
  api?: string;
} = {}): UseChatFullEventsReturn {
  // Standard useChat state
  const chat = useChat({
    api,
    // Handle custom data events
    onData: (event) => {
      if (event.type === 'data') {
        handleDataEvent(event);
      }
    }
  });

  // Custom event state
  const [fileEvents, setFileEvents] = useState<FileEvent[]>([]);
  const [commandEvents, setCommandEvents] = useState<CommandEvent[]>([]);
  const [webEvents, setWebEvents] = useState<WebEvent[]>([]);
  const [subagentEvents, setSubagentEvents] = useState<SubagentEvent[]>([]);

  /**
   * Route custom data events to appropriate state
   */
  const handleDataEvent = useCallback((event: any) => {
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
    ].includes(event.name)) {
      setFileEvents(prev => [...prev, {
        type: event.name,
        ...event.data,
        timestamp
      }]);
      return;
    }

    // Command events
    if (['execute-start', 'execute-finish'].includes(event.name)) {
      setCommandEvents(prev => [...prev, {
        type: event.name,
        ...event.data,
        timestamp
      }]);
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
    ].includes(event.name)) {
      setWebEvents(prev => [...prev, {
        type: event.name,
        ...event.data,
        timestamp
      }]);
      return;
    }

    // Subagent events
    if (['subagent-start', 'subagent-finish', 'subagent-step'].includes(event.name)) {
      setSubagentEvents(prev => [...prev, {
        type: event.name,
        ...event.data,
        timestamp
      }]);
      return;
    }

    // Todos event (existing)
    if (event.name === 'todos-changed') {
      // Handle via existing todos state if needed
      console.log('Todos changed:', event.data.todos);
      return;
    }
  }, []);

  /**
   * Clear all event state
   */
  const clearEvents = useCallback(() => {
    setFileEvents([]);
    setCommandEvents([]);
    setWebEvents([]);
    setSubagentEvents([]);
  }, []);

  return {
    ...chat,
    fileEvents,
    commandEvents,
    webEvents,
    subagentEvents,
    clearEvents
  };
}
```

### Success Criteria

#### Automated Verification

- [ ] TypeScript compiles without errors
- [ ] Hook can be imported and used
- [ ] State updates correctly for each event type

#### Manual Verification

- [ ] Events are captured and stored in state
- [ ] Events persist across message sends
- [ ] Clear events function works
- [ ] Compatible with existing useChat features

---

## Phase 3: UI Component Library

### Overview

Build distinctive, production-grade UI components for displaying each event category with a cohesive design system.

### Design Direction

**Aesthetic:** "Process Flow Visualization"

- Visual hierarchy with nested indentation
- Status indicators with smooth animations
- Collapsible sections with progressive disclosure
- Distinctive typography and color palette
- Performance-optimized for rapid updates

### Changes Required

#### 1. Event Component Library

**File:** `src/components/events/file-event.tsx` (new)

```typescript
/**
 * FileEvent component - Displays file system operations
 *
 * Shows file write, edit, read, and search operations with status
 * indicators and expandable content preview.
 */

import React, { useState } from 'react';
import { File, FileEdit, FileSearch, Loader2, CheckCircle, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import type { FileEvent } from '@/lib/use-chat-full-events';

interface FileEventProps {
  event: FileEvent;
}

export function FileEventDisplay({ event }: FileEventProps) {
  const [expanded, setExpanded] = useState(false);

  // Map event types to icons and labels
  const config = {
    'file-write-start': { icon: Loader2, label: 'Writing', color: 'text-blue-500', spin: true },
    'file-written': { icon: File, label: 'Wrote', color: 'text-green-500', spin: false },
    'file-edited': { icon: FileEdit, label: 'Edited', color: 'text-yellow-500', spin: false },
    'file-read': { icon: File, label: 'Read', color: 'text-purple-500', spin: false },
    'ls': { icon: FileSearch, label: 'Listed', color: 'text-blue-500', spin: false },
    'glob': { icon: FileSearch, label: 'Found', color: 'text-blue-500', spin: false },
    'grep': { icon: FileSearch, label: 'Matched', color: 'text-blue-500', spin: false },
  }[event.type];

  const Icon = config.icon;

  return (
    <div className="group relative flex items-start gap-2 py-2">
      {/* Visual indicator line */}
      <div className="absolute left-[7px] top-8 bottom-0 w-px bg-gradient-to-b from-gray-300 to-transparent dark:from-gray-700" />

      {/* Icon */}
      <div className={`relative z-10 flex-shrink-0 ${config.color} ${config.spin ? 'animate-spin' : ''}`}>
        <Icon size={16} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="font-medium">{config.label}</span>
          {event.path && (
            <span className="text-gray-600 dark:text-gray-400 font-mono text-xs">
              {event.path}
            </span>
          )}
          {event.lines !== undefined && (
            <span className="text-gray-500 dark:text-gray-500 text-xs">
              ({event.lines} lines)
            </span>
          )}
          {event.occurrences !== undefined && (
            <span className="text-gray-500 dark:text-gray-500 text-xs">
              ({event.occurrences} edits)
            </span>
          )}
          {event.count !== undefined && (
            <span className="text-gray-500 dark:text-gray-500 text-xs">
              ({event.count} items)
            </span>
          )}
        </button>

        {expanded && event.content && (
          <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-md overflow-x-auto text-xs font-mono">
            {event.content}
          </pre>
        )}
      </div>
    </div>
  );
}
```

**File:** `src/components/events/command-event.tsx` (new)

```typescript
/**
 * CommandEvent component - Displays command execution
 *
 * Shows shell command execution with start/finish status,
 * exit codes, and truncation warnings.
 */

import React from 'react';
import { Terminal, Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import type { CommandEvent } from '@/lib/use-chat-full-events';

interface CommandEventProps {
  event: CommandEvent;
}

export function CommandEventDisplay({ event }: CommandEventProps) {
  const isStart = event.type === 'execute-start';
  const isFinish = event.type === 'execute-finish';
  const isSuccess = isFinish && event.exitCode === 0;
  const isError = isFinish && event.exitCode !== 0;

  return (
    <div className="group relative flex items-start gap-2 py-2">
      {/* Visual indicator line */}
      <div className="absolute left-[7px] top-8 bottom-0 w-px bg-gradient-to-b from-gray-300 to-transparent dark:from-gray-700" />

      {/* Icon */}
      <div className="relative z-10 flex-shrink-0">
        {isStart && <Loader2 size={16} className="text-blue-500 animate-spin" />}
        {isSuccess && <CheckCircle size={16} className="text-green-500" />}
        {isError && <XCircle size={16} className="text-red-500" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <Terminal size={14} className="text-gray-500 dark:text-gray-400" />
          <span className="font-mono text-xs">{event.command}</span>
          {isError && (
            <span className="text-red-500 dark:text-red-400 text-xs">
              (exit: {event.exitCode})
            </span>
          )}
          {event.truncated && (
            <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400 text-xs" title="Output truncated">
              <AlertTriangle size={12} />
              truncated
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
```

**File:** `src/components/events/web-event.tsx` (new)

```typescript
/**
 * WebEvent component - Displays web operations
 *
 * Shows web searches, HTTP requests, and URL fetching with
 * status indicators and response information.
 */

import React from 'react';
import { Globe, Loader2, CheckCircle, XCircle, Search } from 'lucide-react';
import type { WebEvent } from '@/lib/use-chat-full-events';

interface WebEventProps {
  event: WebEvent;
}

export function WebEventDisplay({ event }: WebEventProps) {
  const isStart = event.type.includes('start');
  const isFinish = event.type.includes('finish');
  const isSuccess = isFinish && (
    event.type === 'web-search-finish' ||
    (event.statusCode !== undefined && event.statusCode >= 200 && event.statusCode < 300) ||
    event.success === true
  );

  return (
    <div className="group relative flex items-start gap-2 py-2">
      {/* Visual indicator line */}
      <div className="absolute left-[7px] top-8 bottom-0 w-px bg-gradient-to-b from-gray-300 to-transparent dark:from-gray-700" />

      {/* Icon */}
      <div className="relative z-10 flex-shrink-0">
        {isStart && <Loader2 size={16} className="text-blue-500 animate-spin" />}
        {isSuccess && <CheckCircle size={16} className="text-green-500" />}
        {!isSuccess && isFinish && <XCircle size={16} className="text-red-500" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          {event.type.includes('web-search') ? (
            <Search size={14} className="text-gray-500 dark:text-gray-400" />
          ) : (
            <Globe size={14} className="text-gray-500 dark:text-gray-400" />
          )}

          {event.query && (
            <span className="text-gray-700 dark:text-gray-300">
              Search: <span className="font-medium">{event.query}</span>
            </span>
          )}

          {event.url && (
            <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
              {event.method && `${event.method} `}{event.url}
            </span>
          )}

          {event.statusCode && (
            <span className={`text-xs ${
              event.statusCode >= 200 && event.statusCode < 300
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {event.statusCode}
            </span>
          )}

          {event.resultCount !== undefined && (
            <span className="text-gray-500 dark:text-gray-500 text-xs">
              ({event.resultCount} results)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
```

**File:** `src/components/events/subagent-event.tsx` (new)

```typescript
/**
 * SubagentEvent component - Displays subagent lifecycle
 *
 * Shows subagent spawning, progress, and completion with a distinctive
 * "branch" visualization inspired by git branch diagrams.
 *
 * Design: Process Flow Visualization
 * - Visual connection lines show parent-child relationships
 * - Status animations (pulse when working, smooth transitions)
 * - Collapsible with progressive disclosure
 * - Nested indentation for sub-subagents
 */

import React, { useState } from 'react';
import { Bot, Loader2, CheckCircle, XCircle, ChevronDown, ChevronRight, GitBranch } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { SubagentEvent } from '@/lib/use-chat-full-events';

interface SubagentEventProps {
  event: SubagentEvent;
  depth?: number; // For nested subagents
}

export function SubagentEventDisplay({ event, depth = 0 }: SubagentEventProps) {
  const [expanded, setExpanded] = useState(true);

  const isStart = event.type === 'subagent-start';
  const isFinish = event.type === 'subagent-finish';
  const isStep = event.type === 'subagent-step';

  // Determine status
  const status = isStart ? 'working' : isFinish ? 'completed' : 'stepping';

  return (
    <div
      className="relative"
      style={{ marginLeft: `${depth * 16}px` }}
    >
      {/* Branch connection line */}
      <div className="absolute left-0 top-6 bottom-0 w-px bg-gradient-to-b from-blue-400 to-blue-200 dark:from-blue-500 dark:to-blue-400" />

      {/* Branch dot indicator */}
      <motion.div
        className="absolute left-[-3px] top-2 w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400"
        animate={{
          scale: status === 'working' ? [1, 1.2, 1] : 1,
          opacity: status === 'working' ? [1, 0.7, 1] : 1
        }}
        transition={{
          duration: 2,
          repeat: status === 'working' ? Infinity : 0,
          ease: 'easeInOut'
        }}
      />

      {/* Content */}
      <div className="ml-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 py-2 hover:opacity-80 transition-opacity"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}

          {/* Status icon */}
          <div className="flex-shrink-0">
            {status === 'working' && <Loader2 size={16} className="text-blue-500 animate-spin" />}
            {status === 'completed' && <CheckCircle size={16} className="text-green-500" />}
            {status === 'stepping' && <GitBranch size={16} className="text-purple-500" />}
          </div>

          {/* Subagent info */}
          <div className="flex items-center gap-2 text-sm">
            <Bot size={14} className="text-gray-500 dark:text-gray-400" />
            <span className="font-medium">{event.name}</span>

            {event.task && isStart && (
              <span className="text-gray-600 dark:text-gray-400">
                task: {event.task}
              </span>
            )}

            {event.stepIndex !== undefined && (
              <span className="text-xs text-gray-500 dark:text-gray-500">
                step {event.stepIndex}
              </span>
            )}
          </div>
        </button>

        {/* Expanded content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              {/* Task details (start) */}
              {event.task && (
                <div className="ml-6 text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {event.task}
                </div>
              )}

              {/* Result details (finish) */}
              {event.result && isFinish && (
                <div className="ml-6 p-3 bg-green-50 dark:bg-green-900/20 rounded-md text-sm">
                  <div className="text-green-700 dark:text-green-300 font-medium mb-1">Result</div>
                  <div className="text-gray-700 dark:text-gray-300">{event.result}</div>
                </div>
              )}

              {/* Tool calls (step) */}
              {event.toolCalls && event.toolCalls.length > 0 && (
                <div className="ml-6 space-y-1">
                  {event.toolCalls.map((call, idx) => (
                    <div key={idx} className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                      → {call.toolName}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
```

**File:** `src/components/events/index.ts` (new)

```typescript
/**
 * Event component library exports
 */

export { FileEventDisplay } from './file-event';
export { CommandEventDisplay } from './command-event';
export { WebEventDisplay } from './web-event';
export { SubagentEventDisplay } from './subagent-event';
```

### Success Criteria

#### Automated Verification

- [ ] All components compile without TypeScript errors
- [ ] Components can be imported
- [ ] No console errors or warnings

#### Manual Verification

- [ ] All event types display correctly
- [ ] Expand/collapse animations are smooth
- [ ] Status indicators update in real-time
- [ ] Works in both light and dark themes
- [ ] Performance acceptable with many events
- [ ] Keyboard navigation works

---

## Phase 4: Integration & Testing

### Overview

Replace current implementation with new handler, integrate components into the chat UI, and thoroughly test all functionality.

### Changes Required

#### 1. Update Chat Route

**File:** `src/app/api/chat/route.ts` (modify)

```typescript
// OLD:
import { createDeepAgent, LocalSandbox } from "deepagentsdk";
import { createElementsRouteHandler } from "deepagentsdk/elements";

// NEW:
import { createDeepAgent, LocalSandbox } from "deepagentsdk";
import { createFullEventsHandler } from "@/lib/create-full-events-handler";

// ... rest of file same ...

// OLD:
export const POST = createElementsRouteHandler({
  agent,
  onRequest: async () => {
    console.log(`[Chat] Request received at ${new Date().toISOString()}`);
  },
  initialState: {
    todos: [],
    files: {},
  },
});

// NEW:
export const POST = createFullEventsHandler({
  agent,
  onRequest: async () => {
    console.log(`[Chat] Request received at ${new Date().toISOString()}`);
  },
  initialState: {
    todos: [],
    files: {},
  },
});
```

#### 2. Update Chat Page

**File:** `src/app/page.tsx` (modify)

```typescript
// OLD:
import { useChatAPI } from "@/lib/use-chat-api";

// NEW:
import { useChatFullEvents } from "@/lib/use-chat-full-events";
import { FileEventDisplay, CommandEventDisplay, WebEventDisplay, SubagentEventDisplay } from "@/components/events";

// In component:
// OLD:
const {
  uiMessages,
  uiStatus,
  taskParts,
  todos,
  sandboxId,
  filePaths,
  sendMessage,
  abort,
  clear,
  refreshFiles,
} = useChatAPI();

// NEW:
const {
  messages,
  input,
  handleInputChange,
  handleSubmit,
  status,
  fileEvents,
  commandEvents,
  webEvents,
  subagentEvents,
  clearEvents,
} = useChatFullEvents();

// Add event display sections to UI:

// After message rendering:
{fileEvents.length > 0 && (
  <div className="mt-4">
    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
      File Operations
    </h3>
    <div className="space-y-0">
      {fileEvents.map((event, idx) => (
        <FileEventDisplay key={idx} event={event} />
      ))}
    </div>
  </div>
)}

{commandEvents.length > 0 && (
  <div className="mt-4">
    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
      Commands
    </h3>
    <div className="space-y-0">
      {commandEvents.map((event, idx) => (
        <CommandEventDisplay key={idx} event={event} />
      ))}
    </div>
  </div>
)}

{webEvents.length > 0 && (
  <div className="mt-4">
    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
      Web Activity
    </h3>
    <div className="space-y-0">
      {webEvents.map((event, idx) => (
        <WebEventDisplay key={idx} event={event} />
      ))}
    </div>
  </div>
)}

{subagentEvents.length > 0 && (
  <div className="mt-4">
    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
      Subagents
    </h3>
    <div>
      {subagentEvents.map((event, idx) => (
        <SubagentEventDisplay key={idx} event={event} />
      ))}
    </div>
  </div>
)}
```

#### 3. Add Clear Events Button

**File:** `src/app/page.tsx` (modify)

```typescript
// Add to toolbar or chat controls:
<button
  onClick={clearEvents}
  className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
>
  Clear Events
</button>
```

### Success Criteria

#### Automated Verification

- [ ] TypeScript compiles: `npm run build`
- [ ] No lint errors: `npm run lint`
- [ ] Type checking passes: `npx tsc --noEmit`

#### Manual Verification

- [ ] Chat interface works with new handler
- [ ] All event types display correctly
- [ ] Real-time streaming works
- [ ] Events persist between messages
- [ ] Clear events button works
- [ ] No performance issues
- [ ] Compatible with existing features (file explorer, todos, etc.)

## Testing Strategy

### Unit Tests

**File:** `src/lib/__tests__/create-full-events-handler.test.ts` (new)

- Test event mapping for all 26 event types
- Test error handling
- Test onRequest hook
- Test message conversion

**File:** `src/lib/__tests__/use-chat-full-events.test.ts` (new)

- Test event routing to state
- Test state updates
- Test clearEvents function

### Integration Tests

**File:** `src/app/__tests__/integration/chat-full-events.test.ts` (new)

- Test end-to-end flow from user message to event display
- Test all event types stream correctly
- Test component rendering with events
- Test event persistence

### Manual Testing Steps

1. **Basic Chat Flow**
   - [ ] Send message: "Create a file named test.txt with content 'Hello World'"
   - [ ] Verify file-write-start event displays
   - [ ] Verify file-written event displays
   - [ ] Verify event shows path and content

2. **Command Execution**
   - [ ] Send message: "Run npm install"
   - [ ] Verify execute-start event displays
   - [ ] Verify execute-finish event displays
   - [ ] Verify exit code shows correctly

3. **Web Search**
   - [ ] Send message: "Search for latest AI news"
   - [ ] Verify web-search-start event displays
   - [ ] Verify web-search-finish event displays
   - [ ] Verify result count shows

4. **Subagent**
   - [ ] Trigger a subagent (depends on your agent setup)
   - [ ] Verify subagent-start event displays with branch visualization
   - [ ] Verify subagent-step events display
   - [ ] Verify subagent-finish event displays

5. **Performance**
   - [ ] Send message that generates 50+ events
   - [ ] Verify UI remains responsive
   - [ ] Verify animations are smooth
   - [ ] Verify no memory leaks

6. **Error Handling**
   - [ ] Trigger an error (e.g., invalid command)
   - [ ] Verify error displays correctly
   - [ ] Verify app doesn't crash

## Performance Considerations

1. **Event State Management**
   - Limit event history to last 100 events per category
   - Use `useMemo` for expensive computations
   - Virtualize event lists if they grow very large

2. **Component Rendering**
   - Use `React.memo` for event components
   - Avoid unnecessary re-renders with proper keys
   - Lazy load event components if needed

3. **Animation Performance**
   - Use CSS transforms instead of layout changes
   - Limit concurrent animations
   - Use `will-change` sparingly

4. **Network Efficiency**
   - Batch multiple events into single writes where possible
   - Consider compression for large event payloads
   - Implement event throttling if needed

## Migration Notes

### For Existing Code

The new `createFullEventsHandler` is a **drop-in replacement** for `createElementsRouteHandler`:

**Before:**

```typescript
import { createElementsRouteHandler } from 'deepagentsdk/elements';
export const POST = createElementsRouteHandler({ agent });
```

**After:**

```typescript
import { createFullEventsHandler } from '@/lib/create-full-events-handler';
export const POST = createFullEventsHandler({ agent });
```

### Breaking Changes

**None** - The new handler maintains the same API and behavior as the original, with additional functionality.

### Optional Migration

Users can choose to:

1. **Keep using `createElementsRouteHandler`** - No changes required
2. **Migrate to `createFullEventsHandler`** - Get all 26 event types
3. **Use both in different routes** - Flexibility for different use cases

## Library Contribution

### Structure for deepagentsdk

The implementation is structured for easy contribution back to deepagentsdk:

**Proposed file structure in library:**

```
deepagentsdk/
├── src/
│   └── adapters/
│       └── elements/
│           ├── index.ts              # Existing exports
│           ├── createElementsRouteHandler.ts  # Existing handler
│           ├── createFullEventsHandler.ts     # NEW: Full event handler
│           └── messageConverters.ts   # Existing utilities
```

**Proposed exports:**

```typescript
export { createElementsRouteHandler } from './createElementsRouteHandler';
export { createFullEventsHandler } from './createFullEventsHandler'; // NEW
export { convertUIMessagesToModelMessages } from './messageConverters';
```

### Documentation for Library

Add to library README:

```markdown
### Route Handlers

#### `createElementsRouteHandler`

Basic handler that maps standard DeepAgent events (text, tools, steps, todos).

#### `createFullEventsHandler` (New!)

Advanced handler that maps all 26 DeepAgent event types including file operations,
command execution, web requests, and subagent lifecycle. Use this for complete
visibility into agent behavior.

**Example:**
```typescript
import { createFullEventsHandler } from 'deepagentsdk/adapters/elements';

export const POST = createFullEventsHandler({ agent });
```

**Custom Event Types:**

- `data-file-write-start`, `data-file-written`, `data-file-edited`, `data-file-read`
- `data-ls`, `data-glob`, `data-grep`
- `data-execute-start`, `data-execute-finish`
- `data-web-search-start`, `data-web-search-finish`
- `data-http-request-start`, `data-http-request-finish`
- `data-fetch-url-start`, `data-fetch-url-finish`
- `data-subagent-start`, `data-subagent-finish`, `data-subagent-step`

```

## Timeline Estimate

- **Phase 1 (Custom Handler)**: 2-3 hours
- **Phase 2 (Client Extensions)**: 2-3 hours
- **Phase 3 (UI Components)**: 4-6 hours
- **Phase 4 (Integration & Testing)**: 2-3 hours

**Total**: 10-15 hours

## Success Metrics

1. **All 26 event types** stream from server to client
2. **Real-time display** of all event categories
3. **Event persistence** in message history
4. **Drop-in replacement** for existing handler
5. **Performance acceptable** with 50+ events
6. **Ready for library contribution** with proper structure and documentation
