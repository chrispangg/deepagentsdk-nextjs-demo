"use client";

import { useEffect, useState } from "react";

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
} from "@/components/ai-elements/task";

import {
  Queue,
  QueueItem,
  QueueItemAction,
  QueueItemActions,
  QueueItemContent,
  QueueItemIndicator,
  QueueSection,
  QueueSectionContent,
} from "@/components/ai-elements/queue";

import { Loader } from "@/components/ai-elements/loader";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  CheckIcon,
  CopyIcon,
  RotateCcwIcon,
  Trash2,
  MessageSquareIcon,
  SearchIcon,
  XCircleIcon,
  Settings as SettingsIcon,
  X,
  Lock as LockIcon,
  Monitor,
  Cloud,
  AlertTriangle,
} from "lucide-react";
import { ApiSettings } from "@/components/settings/api-settings";
import { ModelSelector } from "@/components/settings/model-selector";
import { useSettings, type SandboxType } from "@/components/settings/use-settings";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export default function ValidationPage() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showSandboxSwitchDialog, setShowSandboxSwitchDialog] = useState(false);
  const [pendingSandboxType, setPendingSandboxType] = useState<SandboxType | null>(null);
  const settingsStore = useSettings();

  // Use the new full-events chat hook (deepagentsdk runs server-side in /api/chat)
  const {
    uiMessages,
    uiStatus,
    taskParts,
    todos,
    sandboxId,
    filePaths,
    errorMessage,
    sendMessage,
    abort,
    clear,
    refreshFiles,
  } = useChatFullEvents();

  // Refresh files on initial load
  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  // Initialize server config and auto-open settings if no keys
  useEffect(() => {
    const initAndCheck = async () => {
      await settingsStore.initializeFromServer();
      setIsInitialized(true);
      // Auto-open settings panel if no API keys are configured
      if (!settingsStore.hasAnyApiKey()) {
        setIsSettingsOpen(true);
      }
    };
    initAndCheck();
  }, []); // Run only once on mount

  // Handle message submission with validation
  const handleSubmitMessage = async (message: InputMessage) => {
    // Validate model is selected
    if (!settingsStore.selectedModel) {
      toast.error("Please select a model before sending a message");
      return;
    }
    
    // Validate API key for selected provider
    if (!settingsStore.hasApiKey(settingsStore.selectedProvider)) {
      toast.error(`Please configure an API key for ${settingsStore.selectedProvider}`);
      setIsSettingsOpen(true);
      return;
    }
    
    // Validate E2B key if using E2B sandbox
    if (settingsStore.sandboxType === "e2b" && !settingsStore.hasE2bApiKey()) {
      toast.error("E2B API key is required for cloud sandbox");
      setIsSettingsOpen(true);
      return;
    }
    
    await sendMessage({ text: message.text });
  };

  // Handle sandbox type switch with confirmation
  const handleSandboxSwitch = (newType: SandboxType) => {
    if (newType === settingsStore.sandboxType) return;
    
    // If there are messages, show confirmation dialog
    if (uiMessages.length > 0) {
      setPendingSandboxType(newType);
      setShowSandboxSwitchDialog(true);
    } else {
      // No messages, switch directly
      settingsStore.setSandboxType(newType);
      refreshFiles();
      toast.success(`Switched to ${newType === "e2b" ? "E2B Cloud" : "Local"} Sandbox`);
    }
  };

  // Confirm sandbox switch
  const confirmSandboxSwitch = () => {
    if (pendingSandboxType) {
      settingsStore.setSandboxType(pendingSandboxType);
      clear(); // Clear chat history
      refreshFiles();
      toast.success(`Switched to ${pendingSandboxType === "e2b" ? "E2B Cloud" : "Local"} Sandbox. Chat history cleared.`);
    }
    setShowSandboxSwitchDialog(false);
    setPendingSandboxType(null);
  };

  // Check if sandbox toggle should be enabled
  const canToggleSandbox = !settingsStore.isCloudEnvironment && settingsStore.hasE2bApiKey();

  return (
    <TooltipProvider>
      <PromptInputProvider>
        <div className="flex h-screen flex-col bg-background">
          {/* Header */}
          <header className="border-b border-[var(--home-border-secondary)] bg-[var(--home-bg-elevated)] backdrop-blur-sm p-6">
            <div className="mx-auto flex max-w-4xl items-center gap-4">
              <h1 className="font-[family-name:var(--font-ibm-plex-mono)] text-sm uppercase tracking-widest text-[var(--home-text-primary)] font-semibold">
                &gt; ./deepagentsdk demo
              </h1>
              <div className="flex-1 h-px bg-[var(--home-border-secondary)]" />
              <button
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className="p-2 text-[var(--home-text-muted)] hover:text-[var(--home-text-primary)] hover:bg-[var(--home-bg-card)] border border-transparent hover:border-[var(--home-border-secondary)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
              >
                <SettingsIcon className="size-4" />
              </button>
            </div>

            {/* Settings Panel */}
            <AnimatePresence>
              {isSettingsOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="mt-4"
                >
                  <div className="border border-[var(--home-border-secondary)] bg-[var(--home-bg-card)] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="font-[family-name:var(--font-ibm-plex-mono)] text-xs uppercase tracking-widest text-[var(--home-text-primary)] font-semibold">
                        &gt; ./api-config
                      </h2>
                      <button
                        onClick={() => setIsSettingsOpen(false)}
                        className="p-1 text-[var(--home-text-muted)] hover:text-[var(--home-text-primary)] transition-colors duration-200"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    <ApiSettings />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
                      icon={<MessageSquareIcon className="size-8 text-[var(--home-text-muted)]" />}
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
                  {/* Error Message */}
                  {errorMessage && (
                    <div className="mb-4 p-4 border border-[var(--home-border-primary)] border-l-2 border-l-red-600 bg-[var(--home-bg-card)]">
                      <div className="flex items-start gap-3">
                        <XCircleIcon className="size-5 text-red-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <h3 className="text-sm font-semibold text-[var(--home-text-primary)] font-[family-name:var(--font-ibm-plex-mono)] uppercase tracking-wider mb-1">
                            Error
                          </h3>
                          <p className="text-xs text-[var(--home-text-secondary)] font-light leading-relaxed">
                            {errorMessage}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* API Key Warning */}
                  {isInitialized && !settingsStore.hasAnyApiKey() && (
                    <div className="mb-4 p-4 border border-[var(--home-border-primary)] border-l-2 border-l-orange-600 bg-[var(--home-bg-card)]">
                      <div className="flex items-start gap-3">
                        <LockIcon className="size-5 text-orange-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <h3 className="text-sm font-semibold text-[var(--home-text-primary)] font-[family-name:var(--font-ibm-plex-mono)] uppercase tracking-wider mb-1">
                            API Key Required
                          </h3>
                          <p className="text-xs text-[var(--home-text-secondary)] font-light leading-relaxed mb-2">
                            Please configure an API key to start chatting. You can either:
                          </p>
                          <ul className="text-xs text-[var(--home-text-secondary)] font-light space-y-1 list-disc list-inside">
                            <li>Add keys to your <code className="px-1.5 py-0.5 bg-[var(--home-bg-elevated)] border border-[var(--home-border-secondary)] text-[var(--home-accent)] font-[family-name:var(--font-ibm-plex-mono)]">.env</code> file (server-side)</li>
                            <li>Click the <span className="font-[family-name:var(--font-ibm-plex-mono)]">⚙️</span> icon above to enter your own keys (client-side)</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

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
                      placeholder={
                        !isInitialized
                          ? "Loading configuration..."
                          : settingsStore.hasAnyApiKey()
                          ? "Create files, run commands, search the web, or use subagents..."
                          : "Configure an API key to start chatting..."
                      }
                      className="font-[family-name:var(--font-ibm-plex-mono)] text-sm"
                      disabled={
                        uiStatus === "streaming" ||
                        uiStatus === "submitted" ||
                        !isInitialized ||
                        !settingsStore.hasAnyApiKey()
                      }
                    />
                    <PromptInputFooter>
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                          <ModelSelector />
                          
                          {/* Sandbox Toggle */}
                          {isInitialized && (
                            <div className="flex items-center gap-1.5 px-2 py-1 border border-[var(--home-border-secondary)] bg-[var(--home-bg-card)]">
                              <button
                                onClick={() => handleSandboxSwitch("local")}
                                disabled={settingsStore.isCloudEnvironment}
                                className={`flex items-center gap-1 px-2 py-0.5 text-xs font-[family-name:var(--font-ibm-plex-mono)] transition-all duration-200 ${
                                  settingsStore.sandboxType === "local"
                                    ? "bg-[var(--home-accent)] text-white"
                                    : "text-[var(--home-text-muted)] hover:text-[var(--home-text-primary)]"
                                } ${settingsStore.isCloudEnvironment ? "opacity-50 cursor-not-allowed" : ""}`}
                                title={settingsStore.isCloudEnvironment ? "Local sandbox not available in cloud environment" : "Use local sandbox"}
                              >
                                <Monitor className="size-3" />
                                <span className="hidden sm:inline">Local</span>
                              </button>
                              <button
                                onClick={() => handleSandboxSwitch("e2b")}
                                disabled={!settingsStore.hasE2bApiKey() && !settingsStore.isCloudEnvironment}
                                className={`flex items-center gap-1 px-2 py-0.5 text-xs font-[family-name:var(--font-ibm-plex-mono)] transition-all duration-200 ${
                                  settingsStore.sandboxType === "e2b"
                                    ? "bg-[var(--home-accent)] text-white"
                                    : "text-[var(--home-text-muted)] hover:text-[var(--home-text-primary)]"
                                } ${!settingsStore.hasE2bApiKey() && !settingsStore.isCloudEnvironment ? "opacity-50 cursor-not-allowed" : ""}`}
                                title={!settingsStore.hasE2bApiKey() ? "E2B API key required" : "Use E2B cloud sandbox"}
                              >
                                <Cloud className="size-3" />
                                <span className="hidden sm:inline">E2B</span>
                              </button>
                            </div>
                          )}
                        </div>
                        <PromptInputSubmit
                          status={uiStatus}
                          disabled={
                            uiStatus === "streaming" ||
                            uiStatus === "submitted" ||
                            !isInitialized ||
                            !settingsStore.hasAnyApiKey() ||
                            !settingsStore.selectedModel
                          }
                          onClick={
                            uiStatus === "streaming" ? abort : undefined
                          }
                        />
                      </div>
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

          {/* Sandbox Switch Confirmation Dialog */}
          <AlertDialog open={showSandboxSwitchDialog} onOpenChange={setShowSandboxSwitchDialog}>
            <AlertDialogContent className="bg-[var(--home-bg-card)] border-[var(--home-border-primary)]">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 font-[family-name:var(--font-ibm-plex-mono)] text-[var(--home-text-primary)]">
                  <AlertTriangle className="size-5 text-amber-500" />
                  Switch Sandbox Environment?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-[var(--home-text-secondary)]">
                  Switching from <strong>{settingsStore.sandboxType === "local" ? "Local" : "E2B Cloud"}</strong> to{" "}
                  <strong>{pendingSandboxType === "local" ? "Local" : "E2B Cloud"}</strong> sandbox will clear your current chat history and start fresh.
                  <br /><br />
                  Files in the current sandbox will remain, but you'll need to reference them again in the new session.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="font-[family-name:var(--font-ibm-plex-mono)] text-xs uppercase tracking-wider border-[var(--home-border-primary)] bg-transparent hover:bg-[var(--home-bg-elevated)]">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmSandboxSwitch}
                  className="font-[family-name:var(--font-ibm-plex-mono)] text-xs uppercase tracking-wider bg-[var(--home-accent)] hover:bg-[var(--home-accent)]/90"
                >
                  Switch & Clear Chat
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </PromptInputProvider>
    </TooltipProvider>
  );
}
