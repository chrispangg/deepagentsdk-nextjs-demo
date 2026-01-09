"use client";

import { useEffect } from "react";

// Import the new full-events chat hook
import { useChatFullEvents } from "@/lib/use-chat-full-events";

// Import FileExplorer for sandbox files
import { FileExplorer } from "@/components/file-explorer/file-explorer";

// Import event display components
import {
  FileEventDisplay,
  CommandEventDisplay,
  WebEventDisplay,
  SubagentEventDisplay,
} from "@/components/events";

// Import ALL AI Elements components
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";

import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
  MessageToolbar,
} from "@/components/ai-elements/message";

import {
  PromptInput,
  PromptInputProvider,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputFooter,
  PromptInputAttachments,
  PromptInputAttachment,
  type PromptInputMessage as InputMessage,
} from "@/components/ai-elements/prompt-input";

import {
  Tool as ToolComponent,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";


import {
  Task,
  TaskTrigger,
  TaskContent,
  TaskItem,
  TaskItemFile,
} from "@/components/ai-elements/task";

import {
  Queue,
  QueueItem,
  QueueItemAction,
  QueueItemActions,
  QueueItemContent,
  QueueItemDescription,
  QueueItemIndicator,
  QueueSection,
  QueueSectionContent,
} from "@/components/ai-elements/queue";

import { Loader } from "@/components/ai-elements/loader";
import { CodeBlock } from "@/components/ai-elements/code-block";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  CheckIcon,
  CopyIcon,
  RotateCcwIcon,
  Trash2,
  MessageSquareIcon,
  SearchIcon,
  XCircleIcon,
} from "lucide-react";

export default function ValidationPage() {

  // Use the new full-events chat hook (deepagentsdk runs server-side in /api/chat)
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
  } = useChatFullEvents();

  // Refresh files on initial load
  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  // Handle message submission
  const handleSubmitMessage = async (message: InputMessage) => {
    await sendMessage({ text: message.text });
  };

  return (
    <TooltipProvider>
      <PromptInputProvider>
        <div className="flex h-screen flex-col bg-background">
          {/* Header */}
          <header className="border-b p-4">
            <div className="mx-auto flex max-w-4xl items-center justify-between">
              <h1 className="text-xl font-semibold">
                deepagentsdk demo
              </h1>
            </div>
          </header>

          <div className="flex flex-1 overflow-hidden">
            {/* Main chat area - constrained to 1/3 of screen */}
            <main className="flex w-full max-w-[33.333%] flex-col border-r">
              <Conversation className="flex-1">
                <ConversationContent className="mx-auto max-w-4xl">
                  {uiMessages.length === 0 ? (
                    <ConversationEmptyState
                      title="deepagentsdk demo"
                      description="This app validates the deepagentsdk full-events handler with all 26 event types. Try asking to create files, run commands, search the web, or use subagents."
                      icon={<MessageSquareIcon className="size-8" />}
                    />
                  ) : (
                    <>
                      {uiMessages.map((msg, msgIndex) => (
                        <Message key={msg.id} from={msg.role}>
                          <MessageContent>
                            {msg.parts.map((part: any, idx: number) => {
                              if (part.type === "text") {
                                return (
                                  <MessageResponse key={idx}>
                                    {part.text}
                                  </MessageResponse>
                                );
                              }

                              if (part.type === "tool-call") {
                                // Find matching task
                                const task = taskParts.find((t) => t.toolCallId === part.toolCallId);
                                if (!task) return null;

                                // Status icon mapping
                                const getStatusIcon = () => {
                                  switch (task.status) {
                                    case "pending":
                                    case "in_progress":
                                      return <Loader size={14} />;
                                    case "completed":
                                      return <CheckIcon className="size-4 text-green-600" />;
                                    case "error":
                                      return <XCircleIcon className="size-4 text-red-600" />;
                                  }
                                };

                                return (
                                  <Task key={idx} defaultOpen>
                                    <TaskTrigger title={task.toolName}>
                                      <div className="flex items-center gap-2">
                                        <SearchIcon className="size-4" />
                                        <p className="text-sm">{task.toolName}</p>
                                        {getStatusIcon()}
                                      </div>
                                    </TaskTrigger>
                                    <TaskContent>
                                      {task.items.map((item: any, itemIdx: number) => (
                                        <TaskItem key={itemIdx}>
                                          {item.type === "input" && (
                                            <span className="text-muted-foreground">{item.content}</span>
                                          )}
                                          {item.type === "processing" && (
                                            <span className="flex items-center gap-2 text-muted-foreground">
                                              <Loader size={12} />
                                              {item.content}
                                            </span>
                                          )}
                                          {item.type === "result" && (
                                            <span className="flex items-center gap-2 text-green-600">
                                              <CheckIcon className="size-3" />
                                              {item.content}
                                            </span>
                                          )}
                                          {item.type === "error" && (
                                            <span className="flex items-center gap-2 text-red-600">
                                              <XCircleIcon className="size-3" />
                                              {item.content}
                                            </span>
                                          )}
                                        </TaskItem>
                                      ))}
                                    </TaskContent>
                                  </Task>
                                );
                              }

                              // File events (actual event types)
                              if ([
                                'file-write-start',
                                'file-written',
                                'file-edited',
                                'file-read',
                                'ls',
                                'glob',
                                'grep'
                              ].includes(part.type)) {
                                return <FileEventDisplay key={idx} event={part} />;
                              }

                              // Command events
                              if (['execute-start', 'execute-finish'].includes(part.type)) {
                                return <CommandEventDisplay key={idx} event={part} />;
                              }

                              // Web events
                              if ([
                                'web-search-start',
                                'web-search-finish',
                                'http-request-start',
                                'http-request-finish',
                                'fetch-url-start',
                                'fetch-url-finish'
                              ].includes(part.type)) {
                                return <WebEventDisplay key={idx} event={part} />;
                              }

                              // Subagent events
                              if (['subagent-start', 'subagent-finish', 'subagent-step'].includes(part.type)) {
                                return <SubagentEventDisplay key={idx} event={part} />;
                              }

                              return null;
                            })}

                            {/* Show loader at the end of the last assistant message when processing */}
                            {msg.role === "assistant" &&
                             msgIndex === uiMessages.length - 1 &&
                             (uiStatus === "streaming" || uiStatus === "submitted") && (
                              <div className="flex items-center gap-2 text-muted-foreground mt-2">
                                <Loader size={16} />
                                <span className="text-sm">
                                  {uiStatus === "submitted" ? "Thinking..." : "Generating response..."}
                                </span>
                              </div>
                            )}
                          </MessageContent>

                          {msg.role === "assistant" && (
                            <MessageToolbar>
                              <MessageActions>
                                <MessageAction
                                  tooltip="Copy"
                                  onClick={() => {
                                    const text = msg.parts
                                      .filter((p: any) => p.type === "text")
                                      .map((p: any) => (p as { text: string }).text)
                                      .join("\n");
                                    navigator.clipboard.writeText(text);
                                  }}
                                >
                                  <CopyIcon className="size-4" />
                                </MessageAction>
                                <MessageAction tooltip="Regenerate">
                                  <RotateCcwIcon className="size-4" />
                                </MessageAction>
                              </MessageActions>
                            </MessageToolbar>
                          )}
                        </Message>
                      ))}
                    </>
                  )}
                </ConversationContent>
                <ConversationScrollButton />
              </Conversation>

              {/* Prompt input area */}
              <div className="border-t p-4">
                <div className="mx-auto max-w-4xl">
                  {/* Queue component for displaying todos */}
                  {todos.length > 0 && (
                    <Queue className="mb-2 max-h-[150px] overflow-y-auto rounded-b-none border-input border-b-0">
                      <QueueSection>
                        <QueueSectionContent>
                          <div>
                            {todos.map((todo) => {
                              const isCompleted = todo.status === "completed";

                              return (
                                <QueueItem key={todo.id}>
                                  <div className="flex items-center gap-2">
                                    <QueueItemIndicator completed={isCompleted} />
                                    <QueueItemContent completed={isCompleted}>
                                      {todo.title}
                                    </QueueItemContent>
                                    <QueueItemActions>
                                      <QueueItemAction
                                        aria-label="Remove todo"
                                        onClick={() => {
                                          // Local UI-only removal - doesn't affect agent state
                                          // The agent manages its own todos via write_todos tool
                                        }}
                                      >
                                        <Trash2 size={12} />
                                      </QueueItemAction>
                                    </QueueItemActions>
                                  </div>
                                </QueueItem>
                              );
                            })}
                          </div>
                        </QueueSectionContent>
                      </QueueSection>
                    </Queue>
                  )}

                  <PromptInput
                    onSubmit={handleSubmitMessage}
                    accept="image/*"
                    multiple
                  >
                    <PromptInputAttachments>
                      {(attachment) => (
                        <PromptInputAttachment data={attachment} />
                      )}
                    </PromptInputAttachments>
                    <PromptInputTextarea
                      placeholder="Create files, run commands, search the web, or use subagents..."
                      disabled={uiStatus === "streaming" || uiStatus === "submitted"}
                    />
                    <PromptInputFooter>
                      <PromptInputSubmit
                        status={uiStatus}
                        disabled={uiStatus === "streaming" || uiStatus === "submitted"}
                        onClick={
                          uiStatus === "streaming" ? abort : undefined
                        }
                      />
                    </PromptInputFooter>
                  </PromptInput>
                </div>
              </div>
            </main>

            {/* File Explorer Panel - takes remaining 2/3 of screen */}
            <aside className="flex flex-1 flex-col bg-background">
              <FileExplorer
                className="flex-1"
                paths={filePaths}
                sandboxId={sandboxId}
              />
            </aside>
          </div>
        </div>
      </PromptInputProvider>
    </TooltipProvider>
  );
}
