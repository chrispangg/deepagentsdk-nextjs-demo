"use client";

import { useState, useEffect } from "react";
import { useSettings, type ModelProvider, type SandboxType } from "./use-settings";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, X, Database, Cloud, Monitor, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export function ApiSettings() {
  const {
    anthropicApiKey,
    anthropicBaseUrl,
    tavilyApiKey,
    openaiApiKey,
    e2bApiKey,
    selectedProvider,
    selectedModel,
    sandboxType,
    useServerDefaults,
    isCloudEnvironment,
    setAnthropicApiKey,
    setAnthropicBaseUrl,
    setTavilyApiKey,
    setOpenaiApiKey,
    setE2bApiKey,
    setSelectedProvider,
    setSelectedModel,
    setSandboxType,
    hasE2bApiKey,
    canUseLocalSandbox,
    initializeFromServer,
  } = useSettings();

  const [fetchStatus, setFetchStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  // Hardcoded models
  const anthropicModels = [
    { id: "anthropic/claude-opus-4-5-20251101", name: "Claude Opus 4.5" },
    { id: "anthropic/claude-sonnet-4-5-20250929", name: "Claude Sonnet 4.5" },
    { id: "anthropic/claude-haiku-4-5-20251001", name: "Claude Haiku 4.5" },
  ];

  const openaiModels = [
    { id: "openai/gpt-5.2", name: "GPT-5.2" },
    { id: "openai/gpt-5.2-pro", name: "GPT-5.2 Pro" },
    { id: "openai/gpt-5.1-codex", name: "GPT-5.1 Codex" },
    { id: "openai/gpt-5.1-codex-mini", name: "GPT-5.1 Codex Mini" },
    { id: "openai/gpt-5.1-codex-max", name: "GPT-5.1 Codex Max" },
  ];

  // Initialize from server on mount
  useEffect(() => {
    initializeFromServer();
  }, []);

  // Get available models based on selected provider
  const availableModels =
    selectedProvider === "anthropic" ? anthropicModels : openaiModels;

  // Helper to check if a key is from server
  const isFromServer = (key: string) => key === "[FROM_SERVER]";

  return (
    <div className="space-y-6">
      {/* Server Default Notice */}
      {useServerDefaults && (
        <div 
          role="status"
          aria-live="polite"
          className="p-4 border border-[var(--home-border-primary)] border-l-2 border-l-blue-600 bg-[var(--home-bg-card)]"
        >
          <div className="flex items-start gap-2">
            <Database className="size-4 text-blue-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-xs text-[var(--home-text-secondary)] font-light leading-relaxed">
                <strong className="text-[var(--home-text-primary)] font-semibold">Using .env Configuration:</strong> The app is configured to use API keys from your server&apos;s .env file. Your keys remain secure on the server and are never exposed to the browser. You can override this by entering your own keys below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Notice */}
      <aside 
        aria-label="Privacy information"
        className="p-4 border border-[var(--home-border-primary)] border-l-2 border-l-[var(--home-accent)] bg-[var(--home-bg-card)]"
      >
        <p className="text-xs text-[var(--home-text-secondary)] font-light leading-relaxed">
          <strong className="text-[var(--home-text-primary)] font-semibold">Privacy Notice:</strong> {useServerDefaults
            ? "When using .env configuration, your keys stay on the server. If you provide your own keys below, they are stored locally in your browser."
            : "Your API keys are stored locally in your browser and never sent to our servers."} All API calls are made directly to the respective providers (Anthropic, OpenAI, Tavily). We do not capture, store, or have access to any of your API keys or conversation data.
        </p>
      </aside>

      {/* Status Message */}
      <AnimatePresence>
        {fetchStatus.type && (
          <motion.div
            role={fetchStatus.type === "error" ? "alert" : "status"}
            aria-live={fetchStatus.type === "error" ? "assertive" : "polite"}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`flex items-center gap-2 p-3 rounded-sm border-l-2 text-sm ${
              fetchStatus.type === "success"
                ? "bg-[var(--home-bg-card)] border-green-600 text-[var(--home-text-secondary)]"
                : "bg-[var(--home-bg-card)] border-red-600 text-[var(--home-text-secondary)]"
            }`}
          >
            {fetchStatus.type === "success" ? (
              <Check className="size-4 text-green-600" aria-hidden="true" />
            ) : (
              <X className="size-4 text-red-600" aria-hidden="true" />
            )}
            <span className="font-light">{fetchStatus.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Provider Selection */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-widest text-[var(--home-text-muted)] font-[family-name:var(--font-ibm-plex-mono)]">
          Model Provider
        </Label>
        <Select
          value={selectedProvider}
          onValueChange={(value) => setSelectedProvider(value as ModelProvider)}
        >
          <SelectTrigger className="font-[family-name:var(--font-ibm-plex-mono)] text-sm border-[var(--home-border-primary)] bg-[var(--home-bg-card)] w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[var(--home-bg-card)] border-[var(--home-border-primary)]">
            <SelectItem value="anthropic" className="font-[family-name:var(--font-ibm-plex-mono)]">Anthropic</SelectItem>
            <SelectItem value="openai" className="font-[family-name:var(--font-ibm-plex-mono)]">OpenAI</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Anthropic Settings */}
      {selectedProvider === "anthropic" && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-widest text-[var(--home-text-muted)] font-[family-name:var(--font-ibm-plex-mono)]">
                Anthropic API Key
              </Label>
              {isFromServer(anthropicApiKey) && (
                <span className="text-[10px] text-blue-600 font-[family-name:var(--font-ibm-plex-mono)] uppercase tracking-wider">
                  ✓ From .env
                </span>
              )}
            </div>
            <Input
              type="password"
              value={isFromServer(anthropicApiKey) ? "" : anthropicApiKey}
              onChange={(e) => setAnthropicApiKey(e.target.value)}
              placeholder={isFromServer(anthropicApiKey) ? "Using server-side key" : "sk-ant-..."}
              disabled={isFromServer(anthropicApiKey)}
              className="font-[family-name:var(--font-ibm-plex-mono)] text-sm border-[var(--home-border-primary)] bg-[var(--home-bg-card)] disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-[var(--home-text-muted)] font-[family-name:var(--font-ibm-plex-mono)]">
              Anthropic Base URL
            </Label>
            <Input
              type="text"
              value={anthropicBaseUrl}
              onChange={(e) => setAnthropicBaseUrl(e.target.value)}
              placeholder="https://api.anthropic.com/v1"
              className="font-[family-name:var(--font-ibm-plex-mono)] text-sm border-[var(--home-border-primary)] bg-[var(--home-bg-card)]"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-[var(--home-text-muted)] font-[family-name:var(--font-ibm-plex-mono)]">
              Model
            </Label>
            <Select
              value={selectedModel}
              onValueChange={setSelectedModel}
            >
              <SelectTrigger className="font-[family-name:var(--font-ibm-plex-mono)] text-sm border-[var(--home-border-primary)] bg-[var(--home-bg-card)] w-full">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent className="bg-[var(--home-bg-card)] border-[var(--home-border-primary)]">
                {anthropicModels.map((model) => (
                  <SelectItem key={model.id} value={model.id} className="font-[family-name:var(--font-ibm-plex-mono)]">
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </motion.div>
      )}

      {/* OpenAI Settings */}
      {selectedProvider === "openai" && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-widest text-[var(--home-text-muted)] font-[family-name:var(--font-ibm-plex-mono)]">
                OpenAI API Key
              </Label>
              {isFromServer(openaiApiKey) && (
                <span className="text-[10px] text-blue-600 font-[family-name:var(--font-ibm-plex-mono)] uppercase tracking-wider">
                  ✓ From .env
                </span>
              )}
            </div>
            <Input
              type="password"
              value={isFromServer(openaiApiKey) ? "" : openaiApiKey}
              onChange={(e) => setOpenaiApiKey(e.target.value)}
              placeholder={isFromServer(openaiApiKey) ? "Using server-side key" : "sk-proj-..."}
              disabled={isFromServer(openaiApiKey)}
              className="font-[family-name:var(--font-ibm-plex-mono)] text-sm border-[var(--home-border-primary)] bg-[var(--home-bg-card)] disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-[var(--home-text-muted)] font-[family-name:var(--font-ibm-plex-mono)]">
              Model
            </Label>
            <Select
              value={selectedModel}
              onValueChange={setSelectedModel}
            >
              <SelectTrigger className="font-[family-name:var(--font-ibm-plex-mono)] text-sm border-[var(--home-border-primary)] bg-[var(--home-bg-card)] w-full">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent className="bg-[var(--home-bg-card)] border-[var(--home-border-primary)]">
                {openaiModels.map((model) => (
                  <SelectItem key={model.id} value={model.id} className="font-[family-name:var(--font-ibm-plex-mono)]">
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </motion.div>
      )}

      {/* Tavily API Key (shared across providers) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-widest text-[var(--home-text-muted)] font-[family-name:var(--font-ibm-plex-mono)]">
            Tavily API Key (optional)
          </Label>
          {isFromServer(tavilyApiKey) && (
            <span className="text-[10px] text-blue-600 font-[family-name:var(--font-ibm-plex-mono)] uppercase tracking-wider">
              ✓ From .env
            </span>
          )}
        </div>
        <Input
          type="password"
          value={isFromServer(tavilyApiKey) ? "" : tavilyApiKey}
          onChange={(e) => setTavilyApiKey(e.target.value)}
          placeholder={isFromServer(tavilyApiKey) ? "Using server-side key" : "tvly-..."}
          disabled={isFromServer(tavilyApiKey)}
          className="font-[family-name:var(--font-ibm-plex-mono)] text-sm border-[var(--home-border-primary)] bg-[var(--home-bg-card)] disabled:opacity-50"
        />
      </div>

      {/* Sandbox Configuration Section */}
      <div className="pt-4 border-t border-[var(--home-border-primary)]">
        <h3 className="text-xs uppercase tracking-widest text-[var(--home-text-muted)] font-[family-name:var(--font-ibm-plex-mono)] mb-4">
          Sandbox Environment
        </h3>

        {/* Cloud Environment Warning */}
        {isCloudEnvironment && !hasE2bApiKey() && (
          <div 
            role="alert"
            aria-live="polite"
            className="p-4 border border-amber-600/50 border-l-2 border-l-amber-600 bg-amber-950/20 mb-4"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="size-4 text-amber-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-xs text-amber-200 font-light leading-relaxed">
                  <strong className="text-amber-100 font-semibold">E2B API Key Required:</strong> You&apos;re running in a cloud environment where local sandbox is not available. Please provide an E2B API key to use the sandbox features.
                </p>
                <a 
                  href="https://e2b.dev/docs" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-amber-400 hover:text-amber-300 underline mt-1 inline-block"
                >
                  Get your E2B API key →
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Sandbox Type Selection */}
        <div className="space-y-2 mb-4">
          <Label className="text-xs uppercase tracking-widest text-[var(--home-text-muted)] font-[family-name:var(--font-ibm-plex-mono)]">
            Sandbox Type
          </Label>
          <Select
            value={sandboxType}
            onValueChange={(value) => setSandboxType(value as SandboxType)}
            disabled={isCloudEnvironment} // Can't change in cloud - always E2B
          >
            <SelectTrigger className="font-[family-name:var(--font-ibm-plex-mono)] text-sm border-[var(--home-border-primary)] bg-[var(--home-bg-card)] w-full disabled:opacity-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[var(--home-bg-card)] border-[var(--home-border-primary)]">
              {!isCloudEnvironment && (
                <SelectItem value="local" className="font-[family-name:var(--font-ibm-plex-mono)]">
                  <div className="flex items-center gap-2">
                    <Monitor className="size-3" />
                    <span>Local Sandbox</span>
                  </div>
                </SelectItem>
              )}
              <SelectItem value="e2b" className="font-[family-name:var(--font-ibm-plex-mono)]">
                <div className="flex items-center gap-2">
                  <Cloud className="size-3" />
                  <span>E2B Cloud Sandbox</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[10px] text-[var(--home-text-muted)] font-light">
            {isCloudEnvironment 
              ? "Cloud environment detected - only E2B sandbox is available."
              : sandboxType === "local" 
                ? "Runs code on your local machine. Fast but requires local setup."
                : "Runs code in isolated cloud VMs. Secure and pre-configured."}
          </p>
        </div>

        {/* E2B API Key */}
        {(sandboxType === "e2b" || isCloudEnvironment) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-widest text-[var(--home-text-muted)] font-[family-name:var(--font-ibm-plex-mono)]">
                E2B API Key {isCloudEnvironment && "(required)"}
              </Label>
              {isFromServer(e2bApiKey) && (
                <span className="text-[10px] text-blue-600 font-[family-name:var(--font-ibm-plex-mono)] uppercase tracking-wider">
                  ✓ From .env
                </span>
              )}
            </div>
            <Input
              type="password"
              value={isFromServer(e2bApiKey) ? "" : e2bApiKey}
              onChange={(e) => setE2bApiKey(e.target.value)}
              placeholder={isFromServer(e2bApiKey) ? "Using server-side key" : "e2b_..."}
              disabled={isFromServer(e2bApiKey)}
              className="font-[family-name:var(--font-ibm-plex-mono)] text-sm border-[var(--home-border-primary)] bg-[var(--home-bg-card)] disabled:opacity-50"
            />
            <p className="text-[10px] text-[var(--home-text-muted)] font-light">
              Get your API key at{" "}
              <a 
                href="https://e2b.dev/docs" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[var(--home-accent)] hover:underline"
              >
                e2b.dev
              </a>
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
