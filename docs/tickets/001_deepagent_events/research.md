---
date: 2026-01-09 09:21:05 AEDT
researcher: claude-sonnet-4-5
git_commit: d9e0a5211749d188c67b24e8f4024bde2d478b27
branch: main
repository: deepagentsdk-demo
topic: "DeepAgentSDK events and Vercel AI SDK elements integration"
tags: [research, deepagentsdk, events, elements, ui-components, vercel-ai-sdk, stream-protocol]
status: complete
last_updated: 2026-01-09
last_updated_by: claude-sonnet-4-5
last_updated_note: Added stream protocol compatibility analysis and custom handler examples
---

# Research

## Research Question

Review the deepagentsdk package and understand what DeepAgentEvents it provides. Explore how to create custom UI components for different events or tool calls. Evaluate whether to use `createElementsRouteHandler` or create a custom handler to handle all event types.

## Summary

The deepagentsdk package (v0.13.0) provides **26 different event types** that cover agent lifecycle, tool execution, file operations, web requests, and subagent management. The current codebase uses `createElementsRouteHandler` which adapts DeepAgent events to the Vercel AI SDK's UI Message Stream Protocol, enabling compatibility with AI SDK UI components. However, the current implementation only handles a limited subset of events (3 streaming event types), leaving many valuable events unutilized.

## Detailed Findings

### 1. DeepAgentEvent Types Available (26 Total)

**Source:** `node_modules/deepagentsdk/dist/agent-BDM-PIu8.d.mts:774-1074`

The SDK provides events organized into these categories:

#### Text & Flow Events (7 types)

- `TextEvent` - Text streamed from the agent
- `TextSegmentEvent` - Text segments for CLI display (flushed before tool events)
- `UserMessageEvent` - User messages for CLI history
- `StepStartEvent` - Emitted when an agent step starts (includes `stepNumber`)
- `StepFinishEvent` - Emitted when a step finishes (includes `stepNumber`, `toolCalls` array)
- `DoneEvent` - Emitted when the agent completes execution (includes `state`, optional `output`)
- `ErrorEvent` - Emitted when an error occurs

#### Tool Events (2 types)

- `ToolCallEvent` - Tool call initiated (includes `toolName`, `toolCallId`, `args`)
- `ToolResultEvent` - Tool returned result (includes `toolName`, `toolCallId`, `result`, optional `isError`)

#### Todo & Planning Events (1 type)

- `TodosChangedEvent` - Todo list changes (includes `todos: TodoItem[]`)

#### File System Events (6 types)

- `FileWriteStartEvent` - File write starts (includes `path`, `content`)
- `FileWrittenEvent` - File written (includes `path`, `content`)
- `FileEditedEvent` - File edited (includes `path`, `occurrences`)
- `FileReadEvent` - File read (includes `path`, `lines`)
- `LsEvent` - Directory listing (includes `path`, `count`)
- `GlobEvent` - Glob pattern search (includes `pattern`, `count`)
- `GrepEvent` - Grep search (includes `pattern`, `count`)

#### Execution Events (2 types)

- `ExecuteStartEvent` - Command execution starts (includes `command`, `sandboxId`)
- `ExecuteFinishEvent` - Command execution finishes (includes `command`, `exitCode`, `truncated`, `sandboxId`)

#### Web Events (4 types)

- `WebSearchStartEvent` - Web search starts (includes `query`)
- `WebSearchFinishEvent` - Web search finishes (includes `query`, `resultCount`)
- `HttpRequestStartEvent` - HTTP request starts (includes `url`, `method`)
- `HttpRequestFinishEvent` - HTTP request finishes (includes `url`, `statusCode`)
- `FetchUrlStartEvent` - URL fetch starts (includes `url`)
- `FetchUrlFinishEvent` - URL fetch finishes (includes `url`, `success`)

#### Subagent Events (3 types)

- `SubagentStartEvent` - Subagent starts (includes `name`, `task`)
- `SubagentFinishEvent` - Subagent finishes (includes `name`, `result`)
- `SubagentStepEvent` - Subagent step completes (includes `stepIndex`, `toolCalls` array)

#### Approval & Checkpoint Events (4 types)

- `ApprovalRequestedEvent` - Tool approval requested (includes `approvalId`, `toolCallId`, `toolName`, `args`)
- `ApprovalResponseEvent` - User responded to approval (includes `approvalId`, `approved`)
- `CheckpointSavedEvent` - Checkpoint saved (includes `threadId`, `step`)
- `CheckpointLoadedEvent` - Checkpoint loaded (includes `threadId`, `step`, `messagesCount`)

### 2. Current Implementation Analysis

**Source:** `src/app/api/chat/route.ts`, `src/lib/use-chat-api.ts`

The current implementation uses `createElementsRouteHandler` from `deepagentsdk/elements` which:

1. **Accepts**: POST requests with `{ messages: UIMessage[] }` body
2. **Converts**: UI messages to model messages internally
3. **Streams**: Responses in AI SDK UI Message Stream Protocol (SSE format)
4. **Maps**: DeepAgent events to UI protocol events

#### Currently Handled Event Types (3 out of 26)

**Source:** `src/lib/use-chat-api.ts:151-167`

| Event Type | Handler | What Happens |
|------------|----------|--------------|
| `text-delta` / `text` | Accumulates text chunks | Text added to `accumulatedChunks` array |
| `tool-input-available` | Console log only | Logs `"Tool called:" + toolName` |
| `tool-output-available` | Console log + file refresh | Logs `"Tool result:" + toolName`, triggers `refreshFiles()` |

#### Event Mapping in createElementsRouteHandler

**Source:** `node_modules/deepagentsdk/dist/adapters/elements/index.mjs:39-176`

The adapter maps DeepAgent events to UI protocol events:

```typescript
// DeepAgent Event → UI Protocol Event
TextEvent → text-start, text-delta, text-end
ToolCallEvent → tool-input-available
ToolResultEvent → tool-output-available or tool-output-error
TodosChangedEvent → data event with name "todos-changed"
StepStartEvent → start-step
StepFinishEvent → finish-step
ErrorEvent → error
DoneEvent → [DONE] sentinel
```

**Key Limitation**: Only standard DeepAgent events are mapped. Custom event types beyond these 26 are not supported without modifying the library.

### 3. UI Message Stream Protocol

The protocol uses Server-Sent Events (SSE) with `data:` prefixed JSON:

**Event Format:**

```
data: {"type":"text-start","id":"msg-123"}
data: {"type":"text-delta","id":"msg-123","delta":"Hello"}
data: {"type":"tool-input-available","toolCallId":"tc-1","toolName":"execute","input":{...}}
data: {"type":"tool-output-available","toolCallId":"tc-1","output":{...}}
data: {"type":"data","name":"todos-changed","data":{"todos":[...]}}
data: [DONE]
```

**Custom Data Events:**

```typescript
writer.write({
  type: "data",
  name: "custom-event-name",
  data: { /* any JSON-serializable data */ }
});
```

### 4. Current Message Structure

**Source:** `src/lib/use-chat-api.ts:86-95, 173-193`

```typescript
interface UIMessage {
  id: string;
  role: "user" | "assistant";
  parts: UIMessagePart[];
}

type UIMessagePart =
  | { type: "text"; text: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; args: unknown }
  | { type: "tool-result"; toolCallId: string; result: unknown; isError?: boolean };
```

**Critical Gap**: Tool call/result data received during streaming is logged but not integrated into message parts. Only pre-existing tool-call/tool-result parts in message history are displayed in the UI.

### 5. Existing UI Components

**Source:** `src/components/ai-elements/`, `src/app/page.tsx`

#### Tool Component (`src/components/ai-elements/tool.tsx`)

- Designed for AI SDK v6 `ToolUIPart`
- Handles 7 states: `input-streaming`, `input-available`, `approval-requested`, `approval-responded`, `output-available`, `output-error`, `output-denied`
- **Status not currently used** - app uses simpler `<Task>` component instead

#### Task Component (`src/components/ai-elements/task.tsx`)

- Simpler collapsible component used in the app
- Renders in `src/app/page.tsx:176-232` for tool calls
- Shows status icons (pending/in_progress: Loader, completed: CheckIcon, error: XCircleIcon)

#### Confirmation Component (`src/components/ai-elements/confirmation.tsx`)

- For tool approval workflows
- **Component exists but no approval workflow is implemented** - all tool calls execute automatically

#### Chain of Thought Component (`src/components/ai-elements/chain-of-thought.tsx`)

- Complex collapsible component pattern with React context
- Good example for building custom event display components

### 6. createElementsRouteHandler vs Custom Handler

#### Use `createElementsRouteHandler` when

- ✅ You need quick integration with standard DeepAgent features
- ✅ You want compatibility with `useChat` hook from `@ai-sdk/react`
- ✅ You don't need custom event types beyond what DeepAgent provides
- ✅ You want automatic conversion between UIMessage and ModelMessage formats
- ✅ You need basic authentication/logging via `onRequest` hook

**Current Usage:**

```typescript
// src/app/api/chat/route.ts:48-63
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
```

#### Build a custom handler when

- ✅ You need to support custom event types not in DeepAgent
- ✅ You want to filter or transform events before sending to client
- ✅ You need complex middleware logic (multiple processors, auth steps, etc.)
- ✅ You want to integrate with non-DeepAgent backends
- ✅ You need custom state management or persistence strategies

**Custom Handler Example:**

```typescript
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      originalMessages: messages,
      generateId: () => crypto.randomUUID(),
      execute: async ({ writer }) => {
        for await (const event of agent.streamWithEvents(messages)) {
          switch (event.type) {
            case 'file-written':
              // Send custom data event
              writer.write({
                type: 'data',
                name: 'file-written',
                data: { path: event.path, content: event.content }
              });
              break;
            case 'execute-start':
              writer.write({
                type: 'data',
                name: 'command-start',
                data: { command: event.command, sandboxId: event.sandboxId }
              });
              break;
            // ... handle all 26 event types
          }
        }
      }
    })
  });
}
```

**Comparison:**

| Feature | createElementsRouteHandler | Custom Handler |
|---------|---------------------------|----------------|
| Setup time | Minutes | Hours |
| DeepAgent integration | Built-in | Manual |
| Custom events | Limited | Full control |
| Middleware | Basic (onRequest only) | Unlimited |
| Type safety | High | Manual |
| Maintenance | Low (library updates) | High (you maintain it) |

### 7. Recommendations for Custom UI Components

#### Strategy 1: Extend Event Handling (Keep createElementsRouteHandler)

**Approach**: Handle more events on the client-side by extending the SSE parsing logic.

**Implementation:**

1. **Extend client-side event handling** in `src/lib/use-chat-api.ts`:

```typescript
// Add more event type handlers
if (event.type === "data") {
  if (event.name === "todos-changed") {
    setTodos(event.data.todos);
  } else if (event.name === "file-written") {
    // Handle file written event
    addFileEvent({ type: 'file-written', ...event.data });
    refreshFiles();
  } else if (event.name === "execute-start") {
    // Handle command execution start
    addCommandEvent({ type: 'start', ...event.data });
  }
  // ... handle more custom data events
}
```

1. **Create custom UI components** for each event type:

```typescript
// FileEventDisplay.tsx
interface FileEventProps {
  type: 'file-write-start' | 'file-written' | 'file-edited' | 'file-read';
  path: string;
  content?: string;
  lines?: number;
  occurrences?: number;
}

export function FileEventDisplay({ type, path, content, lines, occurrences }: FileEventProps) {
  const [expanded, setExpanded] = useState(false);

  const icons = {
    'file-write-start': '✏️',
    'file-written': '📄',
    'file-edited': '✏️',
    'file-read': '📖'
  };

  return (
    <div className="file-event">
      <div className="file-header">
        <span>{icons[type]}</span>
        <span className="file-path">{path}</span>
        {lines && <span className="file-lines">{lines} lines</span>}
        {occurrences && <span className="file-occurrences">{occurrences} edits</span>}
        {content && <button onClick={() => setExpanded(!expanded)}>Toggle</button>}
      </div>
      {expanded && content && <pre className="file-content">{content}</pre>}
    </div>
  );
}

// CommandEventDisplay.tsx
interface CommandEventProps {
  type: 'start' | 'finish';
  command: string;
  sandboxId: string;
  exitCode?: number | null;
  truncated?: boolean;
}

export function CommandEventDisplay({ type, command, sandboxId, exitCode, truncated }: CommandEventProps) {
  return (
    <div className="command-event">
      <div className="command-header">
        <span>{type === 'start' ? '💻' : (exitCode === 0 ? '✅' : '❌')}</span>
        <span className="command-text">{command}</span>
        <span className="sandbox-id">{sandboxId}</span>
      </div>
      {type === 'finish' && (
        <div className="command-result">
          Exit code: {exitCode}
          {truncated && <span className="truncated-badge">Output truncated</span>}
        </div>
      )}
    </div>
  );
}

// StepProgressDisplay.tsx
interface StepProgressProps {
  stepNumber: number;
  toolCalls?: Array<{
    toolName: string;
    args: unknown;
    result: unknown;
  }>;
}

export function StepProgressDisplay({ stepNumber, toolCalls }: StepProgressProps) {
  return (
    <div className="step-progress">
      <h4>Step {stepNumber}</h4>
      {toolCalls && toolCalls.map((call, idx) => (
        <div key={idx} className="tool-in-step">
          <ToolCallDisplay toolName={call.toolName} args={call.args} />
          <ToolResultDisplay result={call.result} />
        </div>
      ))}
    </div>
  );
}
```

1. **Integrate into message parts** by creating custom part types:

```typescript
// Extend UIMessagePart type
interface FileEventPart {
  type: 'file-event';
  eventType: 'file-written' | 'file-edited' | 'file-read';
  path: string;
  content?: string;
}

interface CommandEventPart {
  type: 'command-event';
  eventType: 'execute-start' | 'execute-finish';
  command: string;
  sandboxId: string;
  exitCode?: number | null;
}

interface StepEventPart {
  type: 'step-event';
  stepNumber: number;
}

// Use in message rendering
{part.type === 'file-event' && <FileEventDisplay {...part} />}
{part.type === 'command-event' && <CommandEventDisplay {...part} />}
{part.type === 'step-event' && <StepProgressDisplay {...part} />}
```

#### Strategy 2: Custom Handler with Full Event Control

**Approach**: Build a custom route handler that maps all 26 DeepAgent event types to UI protocol events.

**Implementation:**

```typescript
// src/app/api/chat-custom/route.ts
import { createDeepAgent } from "deepagentsdk";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

const agent = createDeepAgent({
  model: anthropic("claude-haiku-4-5-20251001"),
  backend: sandbox,
  maxSteps: 15,
});

export async function POST(req: Request) {
  const { messages } = await req.json();

  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      originalMessages: messages,
      generateId: () => crypto.randomUUID(),
      execute: async ({ writer }) => {
        for await (const event of agent.streamWithEvents(messages)) {
          switch (event.type) {
            // Text events
            case "text":
              writer.write({ type: "text-delta", delta: event.text });
              break;

            // Tool events
            case "tool-call":
              writer.write({
                type: "data",
                name: "tool-call",
                data: {
                  toolName: event.toolName,
                  toolCallId: event.toolCallId,
                  args: event.args
                }
              });
              break;
            case "tool-result":
              writer.write({
                type: "data",
                name: "tool-result",
                data: {
                  toolName: event.toolName,
                  toolCallId: event.toolCallId,
                  result: event.result,
                  isError: event.isError
                }
              });
              break;

            // File events
            case "file-write-start":
              writer.write({
                type: "data",
                name: "file-write-start",
                data: { path: event.path, content: event.content }
              });
              break;
            case "file-written":
              writer.write({
                type: "data",
                name: "file-written",
                data: { path: event.path, content: event.content }
              });
              break;
            case "file-edited":
              writer.write({
                type: "data",
                name: "file-edited",
                data: { path: event.path, occurrences: event.occurrences }
              });
              break;
            case "file-read":
              writer.write({
                type: "data",
                name: "file-read",
                data: { path: event.path, lines: event.lines }
              });
              break;

            // Execute events
            case "execute-start":
              writer.write({
                type: "data",
                name: "execute-start",
                data: { command: event.command, sandboxId: event.sandboxId }
              });
              break;
            case "execute-finish":
              writer.write({
                type: "data",
                name: "execute-finish",
                data: {
                  command: event.command,
                  exitCode: event.exitCode,
                  truncated: event.truncated,
                  sandboxId: event.sandboxId
                }
              });
              break;

            // Step events
            case "step-start":
              writer.write({
                type: "data",
                name: "step-start",
                data: { stepNumber: event.stepNumber }
              });
              break;
            case "step-finish":
              writer.write({
                type: "data",
                name: "step-finish",
                data: { stepNumber: event.stepNumber, toolCalls: event.toolCalls }
              });
              break;

            // Web events
            case "web-search-start":
              writer.write({
                type: "data",
                name: "web-search-start",
                data: { query: event.query }
              });
              break;
            case "web-search-finish":
              writer.write({
                type: "data",
                name: "web-search-finish",
                data: { query: event.query, resultCount: event.resultCount }
              });
              break;

            // Subagent events
            case "subagent-start":
              writer.write({
                type: "data",
                name: "subagent-start",
                data: { name: event.name, task: event.task }
              });
              break;
            case "subagent-finish":
              writer.write({
                type: "data",
                name: "subagent-finish",
                data: { name: event.name, result: event.result }
              });
              break;

            // Approval events
            case "approval-requested":
              writer.write({
                type: "data",
                name: "approval-requested",
                data: {
                  approvalId: event.approvalId,
                  toolCallId: event.toolCallId,
                  toolName: event.toolName,
                  args: event.args
                }
              });
              break;

            // Done and error
            case "done":
              // Stream is complete
              break;
            case "error":
              writer.write({ type: "error", errorText: event.error.message });
              break;
          }
        }
      }
    })
  });
}
```

**Client-side handling:**

```typescript
// src/lib/use-chat-api-custom.ts
const eventData = {
  fileEvents: [],
  commandEvents: [],
  stepEvents: [],
  webSearchEvents: [],
  subagentEvents: [],
};

// Handle data events
if (event.type === "data") {
  switch (event.name) {
    case "file-written":
      eventData.fileEvents.push({ type: 'written', ...event.data });
      break;
    case "execute-start":
      eventData.commandEvents.push({ type: 'start', ...event.data });
      break;
    case "step-start":
      eventData.stepEvents.push({ ...event.data });
      break;
    // ... handle all event types
  }
}
```

## Architecture Documentation

### Current Event Flow

```
User Input
    ↓
POST /api/chat with messages[]
    ↓
createElementsRouteHandler processes with DeepAgent
    ↓
DeepAgent streams events (26 possible types)
    ↓
Adapter maps to UI protocol events
    ↓
SSE Stream: text-delta, tool-input-available, tool-output-available, data (todos-changed)
    ↓
Client parses events (handles 3 event types)
    ↓
text-delta → accumulatedChunks
tool events → console.log only
data/todos-changed → updates todos state
    ↓
[DONE] → create user+assistant messages with text parts only
    ↓
Tool data from streaming lost
    ↓
Messages stored with only text parts
    ↓
extractTaskPartsFromMessages scans for tool-call/result parts
    ↓
taskParts array generated for UI display
```

### Recommended Enhanced Event Flow

```
User Input
    ↓
POST /api/chat (custom or enhanced handler)
    ↓
for await (event of agent.streamWithEvents())
    ↓
Switch on event.type (all 26 types)
    ↓
Map to UI protocol events:
  - Standard events (text, tool) → use standard protocol
  - Custom events → use data events with name
    ↓
writer.write({ type: "data", name: "event-type", data: {...} })
    ↓
Client-side event router
    ↓
Route to appropriate handler:
  - file events → fileEvents state
  - command events → commandEvents state
  - step events → stepEvents state
  - web events → webEvents state
    ↓
UI components render events in real-time
    ↓
Complete message with all event parts preserved
```

## Stream Protocol Compatibility Analysis

### Critical Finding: Custom Handlers ARE Compatible with AI SDK UI Elements

**Source:** `node_modules/ai/dist/index.d.ts:2026-2141`, https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol

**YES - A custom handler built with `createUIMessageStream` and `createUIMessageStreamResponse` will be fully compatible with Vercel AI SDK UI elements** like `useChat`, provided it emits events matching the `UIMessageChunk` type definition.

### Required vs Optional Events

#### MUST Include (Minimum for Compatibility)

For basic text streaming compatibility with `useChat`:

```typescript
// 1. Start text response
{ type: 'text-start', id: string }

// 2. Stream text chunks
{ type: 'text-delta', id: string, delta: string }

// 3. Finish or [DONE] sentinel
{ type: 'finish', finishReason?: 'stop' | 'length' | 'error' | 'tool-calls' | 'content-filter' | 'other' }
// OR
data: [DONE]
```

#### OPTIONAL (Enhanced Functionality)

These events add features but are NOT required:

- `start` - Marks stream start (optional but recommended)
- `tool-input-available` / `tool-output-available` - Tool call display
- `data-{name}` - Custom events with any JSON payload
- `start-step` / `finish-step` - Multi-step processes
- `reasoning-start` / `reasoning-delta` / `reasoning-end` - Model reasoning
- `source-url` / `source-document` / `file` - Source citations
- `tool-approval-request` - Approval workflows
- `error` - Error handling
- `abort` - Stream abortion

### Custom Data Events Pattern

**Key for DeepAgent Events:** Use the `data-{name}` pattern for custom events:

```typescript
// DeepAgent file events → UI protocol
writer.write({
  type: 'data-file-written',
  data: { path: '/tmp/file.txt', content: '...' }
});

// DeepAgent execute events → UI protocol
writer.write({
  type: 'data-execute-start',
  data: { command: 'npm install', sandboxId: 'local' }
});

// DeepAgent web search → UI protocol
writer.write({
  type: 'data-web-search-finish',
  data: { query: 'AI news', resultCount: 10 }
});
```

### Required HTTP Headers

**Source:** `node_modules/ai/dist/index.d.ts:3738-3744`

```typescript
const UI_MESSAGE_STREAM_HEADERS = {
  'content-type': 'text/event-stream',
  'cache-control': 'no-cache, no-transform',
  'connection': 'keep-alive',
  'x-vercel-ai-ui-message-stream': 'v1',
  'x-accel-buffering': 'no' // Prevents nginx buffering
};
```

### Complete Custom Handler Example (Compatible with useChat)

```typescript
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { createDeepAgent } from 'deepagentsdk';

const agent = createDeepAgent({
  model: anthropic('claude-haiku-4-5-20251001'),
  backend: sandbox,
  maxSteps: 15,
});

export async function POST(req: Request) {
  const { messages } = await req.json();

  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      originalMessages: messages,
      generateId: () => crypto.randomUUID(),
      execute: async ({ writer }) => {
        for await (const event of agent.streamWithEvents(messages)) {
          switch (event.type) {
            // REQUIRED: Text events for compatibility
            case 'text':
              writer.write({
                type: 'text-delta',
                delta: event.text,
                id: getCurrentMessageId()
              });
              break;

            // OPTIONAL: Tool events (already compatible)
            case 'tool-call':
              writer.write({
                type: 'tool-input-available',
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                input: event.args
              });
              break;
            case 'tool-result':
              writer.write({
                type: event.isError ? 'tool-output-error' : 'tool-output-available',
                toolCallId: event.toolCallId,
                ...(event.isError
                  ? { errorText: String(event.result) }
                  : { output: event.result }
                )
              });
              break;

            // CUSTOM: File events using data pattern
            case 'file-written':
              writer.write({
                type: 'data-file-written',
                data: { path: event.path, content: event.content }
              });
              break;
            case 'file-edited':
              writer.write({
                type: 'data-file-edited',
                data: { path: event.path, occurrences: event.occurrences }
              });
              break;
            case 'file-read':
              writer.write({
                type: 'data-file-read',
                data: { path: event.path, lines: event.lines }
              });
              break;

            // CUSTOM: Execute events
            case 'execute-start':
              writer.write({
                type: 'data-execute-start',
                data: { command: event.command, sandboxId: event.sandboxId }
              });
              break;
            case 'execute-finish':
              writer.write({
                type: 'data-execute-finish',
                data: {
                  command: event.command,
                  exitCode: event.exitCode,
                  truncated: event.truncated,
                  sandboxId: event.sandboxId
                }
              });
              break;

            // CUSTOM: Step events
            case 'step-start':
              writer.write({
                type: 'start-step'
              });
              break;
            case 'step-finish':
              writer.write({
                type: 'finish-step'
              });
              break;

            // CUSTOM: Web events
            case 'web-search-start':
              writer.write({
                type: 'data-web-search-start',
                data: { query: event.query }
              });
              break;
            case 'web-search-finish':
              writer.write({
                type: 'data-web-search-finish',
                data: { query: event.query, resultCount: event.resultCount }
              });
              break;

            // CUSTOM: Subagent events
            case 'subagent-start':
              writer.write({
                type: 'data-subagent-start',
                data: { name: event.name, task: event.task }
              });
              break;
            case 'subagent-finish':
              writer.write({
                type: 'data-subagent-finish',
                data: { name: event.name, result: event.result }
              });
              break;

            // REQUIRED: Finish event
            case 'done':
              writer.write({
                type: 'finish',
                finishReason: 'stop'
              });
              break;

            // OPTIONAL: Error handling
            case 'error':
              writer.write({
                type: 'error',
                errorText: event.error.message
              });
              break;
          }
        }
      },
      onFinish: ({ messages, finishReason }) => {
        console.log('Stream completed:', { finishReason, messageCount: messages.length });
      }
    })
  });
}
```

### Client-Side Compatibility

**The custom handler above works seamlessly with `useChat`:**

```typescript
import { useChat } from '@ai-sdk/react';

function ChatComponent() {
  const { messages, sendMessage, status } = useChat({
    api: '/api/chat', // Your custom handler endpoint
    // Custom data event handling
    onData: (event) => {
      if (event.type === 'data-file-written') {
        console.log('File written:', event.data);
        // Update file explorer, etc.
      } else if (event.type === 'data-execute-finish') {
        console.log('Command finished:', event.data);
        // Update command logs, etc.
      }
    }
  });

  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id}>
          {/* Standard UI components work! */}
          {msg.content}
        </div>
      ))}
      <button onClick={() => sendMessage('Hello')}>Send</button>
    </div>
  );
}
```

### createElementsRouteHandler vs Custom Handler: Compatibility Comparison

| Feature | createElementsRouteHandler | Custom Handler |
|---------|---------------------------|----------------|
| **AI SDK UI Compatibility** | ✅ Fully compatible | ✅ Fully compatible |
| **useChat Hook** | ✅ Works out of box | ✅ Works with custom handler |
| **Standard Events** | ✅ Auto-mapped | ✅ Manual mapping required |
| **Text Streaming** | ✅ Automatic | ✅ Must implement |
| **Tool Events** | ✅ Auto-mapped | ✅ Must implement |
| **Custom Data Events** | ⚠️ Limited to todos-changed | ✅ Full control |
| **All 26 DeepAgent Events** | ❌ Only 8 event types | ✅ All event types |
| **Event Filtering** | ❌ Not possible | ✅ Full control |
| **TypeScript Safety** | ✅ Built-in | ✅ Available |
| **Maintenance** | ✅ Library updates | ❌ Manual maintenance |

### Key Insight

**You can have BOTH compatibility AND full event control:**

1. **Keep `createElementsRouteHandler`** if you only need standard events (text, tools, steps)
2. **Build a custom handler** if you want all 26 DeepAgent events exposed as custom `data-{name}` events
3. **Both approaches are fully compatible** with `useChat` and other AI SDK UI components

The custom handler approach requires more code but gives you:
- Access to file events (write, edit, read)
- Command execution events (start, finish with exit codes)
- Web search events
- Subagent events
- Full control over event filtering and transformation

### Protocol Format Reference

**SSE Event Format:**
```
data: {"type":"text-start","id":"msg-123"}
data: {"type":"text-delta","id":"msg-123","delta":"Hello"}
data: {"type":"data-file-written","data":{"path":"/tmp/file.txt","content":"..."}}
data: {"type":"finish","finishReason":"stop"}
data: [DONE]
```

**Complete UIMessageChunk Type:**
```typescript
type UIMessageChunk =
  // Required for basic compatibility
  | { type: 'text-start'; id: string }
  | { type: 'text-delta'; id: string; delta: string }
  | { type: 'finish'; finishReason?: FinishReason }

  // Tool events (optional)
  | { type: 'tool-input-available'; toolCallId: string; toolName: string; input: unknown }
  | { type: 'tool-output-available'; toolCallId: string; output: unknown }
  | { type: 'tool-output-error'; toolCallId: string; errorText: string }

  // Custom data events (pattern)
  | { type: `data-${string}`; id?: string; data: unknown; transient?: boolean }

  // Step events (optional)
  | { type: 'start-step' }
  | { type: 'finish-step' }

  // Control events (optional)
  | { type: 'start'; messageId?: string }
  | { type: 'error'; errorText: string }
  | { type: 'abort'; reason?: string };
```

## Code References

### DeepAgentSDK Source Files

- `node_modules/deepagentsdk/dist/agent-BDM-PIu8.d.mts:774-1074` - All 26 DeepAgentEvent type definitions
- `node_modules/deepagentsdk/dist/adapters/elements/index.mjs:39-176` - createElementsRouteHandler implementation
- `node_modules/deepagentsdk/dist/adapters/elements/index.mjs:179-267` - Message conversion utilities

### Current Implementation

- `src/app/api/chat/route.ts:1-67` - Current chat route using createElementsRouteHandler
- `src/lib/use-chat-api.ts:1-341` - Client-side event handling (3 event types)
- `src/lib/use-chat-api.ts:149-169` - SSE event parsing logic
- `src/lib/use-chat-api.ts:247-321` - Task part extraction from messages
- `src/app/page.tsx:168-232` - Message and tool call rendering
- `src/app/page.tsx:281-315` - Queue component for todos

### UI Components

- `src/components/ai-elements/tool.tsx:1-120` - Tool component (not currently used)
- `src/components/ai-elements/task.tsx:1-80` - Task component (currently used for tools)
- `src/components/ai-elements/confirmation.tsx:1-100` - Approval component (no workflow implemented)
- `src/components/ai-elements/chain-of-thought.tsx:1-150` - Complex collapsible component pattern

### Supporting Code

- `src/app/api/sandboxes/[sandboxId]/files/route.ts:1-117` - File explorer API
- `src/components/commands-logs/commands-logs-stream.tsx:1-98` - Streaming logs pattern example

## Open Questions

1. **Event Storage**: Should events be stored in the message parts for history, or kept separate in state?

2. **Real-time vs Post-Processing**: Should events be displayed as they stream in, or only after the agent completes?

3. **Event Filtering**: Should users be able to filter which event types they want to see?

4. **Performance**: What's the performance impact of handling all 26 event types in real-time?

5. **Backward Compatibility**: How will custom event handlers work with existing messages that only have text parts?

6. **Approval Workflow**: Should the approval workflow be implemented using the existing `Confirmation` component?

## Related Research

None yet - this is the first research document for this codebase.

## Additional Resources

### Official Documentation

- **DeepAgent SDK**: <https://deepagentsdk.vercel.app/docs>
- **DeepAgent SDK GitHub**: <https://github.com/chrispangg/deepagentsdk>
- **Vercel AI SDK**: <https://ai-sdk.dev/docs>
- **Vercel AI SDK GitHub**: <https://github.com/vercel/ai>

### Key Types

```typescript
// DeepAgentEvent union (26 types)
type DeepAgentEvent =
  | TextEvent
  | TextSegmentEvent
  | UserMessageEvent
  | StepStartEvent
  | StepFinishEvent
  | DoneEvent
  | ErrorEvent
  | ToolCallEvent
  | ToolResultEvent
  | TodosChangedEvent
  | FileWriteStartEvent
  | FileWrittenEvent
  | FileEditedEvent
  | FileReadEvent
  | LsEvent
  | GlobEvent
  | GrepEvent
  | ExecuteStartEvent
  | ExecuteFinishEvent
  | WebSearchStartEvent
  | WebSearchFinishEvent
  | HttpRequestStartEvent
  | HttpRequestFinishEvent
  | FetchUrlStartEvent
  | FetchUrlFinishEvent
  | SubagentStartEvent
  | SubagentFinishEvent
  | SubagentStepEvent
  | ApprovalRequestedEvent
  | ApprovalResponseEvent
  | CheckpointSavedEvent
  | CheckpointLoadedEvent;

// UI Message types
interface UIMessage {
  id: string;
  role: "user" | "assistant";
  parts: UIMessagePart[];
}

// UI Protocol event types
type UIProtocolEvent =
  | { type: "text-delta"; delta: string }
  | { type: "text-start"; id: string }
  | { type: "text-end"; id: string }
  | { type: "tool-input-available"; toolCallId: string; toolName: string; input: any }
  | { type: "tool-output-available"; toolCallId: string; output: any }
  | { type: "tool-output-error"; toolCallId: string; errorText: string }
  | { type: "data"; name: string; data: any }
  | { type: "error"; errorText: string };
```
