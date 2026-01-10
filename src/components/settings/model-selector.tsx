"use client";

import { useSettings, type ModelProvider } from "./use-settings";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Model {
  id: string;
  name: string;
  provider: ModelProvider;
}

// Hardcoded list of supported models
const ANTHROPIC_MODELS: Model[] = [
  {
    id: "anthropic/claude-opus-4-5-20251101",
    name: "Claude Opus 4.5",
    provider: "anthropic",
  },
  {
    id: "anthropic/claude-sonnet-4-5-20250929",
    name: "Claude Sonnet 4.5",
    provider: "anthropic",
  },
  {
    id: "anthropic/claude-haiku-4-5-20251001",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
  },
];

const OPENAI_MODELS: Model[] = [
  {
    id: "openai/gpt-5.2",
    name: "GPT-5.2",
    provider: "openai",
  },
  {
    id: "openai/gpt-5.2-pro",
    name: "GPT-5.2 Pro",
    provider: "openai",
  },
  {
    id: "openai/gpt-5.1-codex",
    name: "GPT-5.1 Codex",
    provider: "openai",
  },
  {
    id: "openai/gpt-5.1-codex-mini",
    name: "GPT-5.1 Codex Mini",
    provider: "openai",
  },
  {
    id: "openai/gpt-5.1-codex-max",
    name: "GPT-5.1 Codex Max",
    provider: "openai",
  },
];

export function ModelSelector() {
  const {
    selectedProvider,
    selectedModel,
    setSelectedProvider,
    setSelectedModel,
  } = useSettings();

  // Get all available models
  const allModels = [...ANTHROPIC_MODELS, ...OPENAI_MODELS];

  // Group models by provider for display
  const modelsByProvider = {
    anthropic: ANTHROPIC_MODELS,
    openai: OPENAI_MODELS,
  };

  const handleModelChange = (modelId: string) => {
    // Determine provider from model ID
    const provider = modelId.startsWith("anthropic/") ? "anthropic" : "openai";

    // Update provider if it changed
    if (provider !== selectedProvider) {
      setSelectedProvider(provider);
    }

    setSelectedModel(modelId);
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedModel} onValueChange={handleModelChange}>
        <SelectTrigger className="h-8 w-[200px] border-[var(--home-border-primary)] bg-[var(--home-bg-card)] font-[family-name:var(--font-ibm-plex-mono)] text-xs">
          <SelectValue placeholder="Select model" />
        </SelectTrigger>
        <SelectContent className="bg-[var(--home-bg-card)] border-[var(--home-border-primary)]">
          <div className="px-2 py-1.5 text-xs font-semibold text-[var(--home-text-muted)] font-[family-name:var(--font-ibm-plex-mono)] uppercase tracking-wider">
            Anthropic
          </div>
          {modelsByProvider.anthropic.map((model) => (
            <SelectItem
              key={model.id}
              value={model.id}
              className="font-[family-name:var(--font-ibm-plex-mono)] text-xs"
            >
              {model.name}
            </SelectItem>
          ))}
          <div className="px-2 py-1.5 text-xs font-semibold text-[var(--home-text-muted)] font-[family-name:var(--font-ibm-plex-mono)] uppercase tracking-wider mt-2">
            OpenAI
          </div>
          {modelsByProvider.openai.map((model) => (
            <SelectItem
              key={model.id}
              value={model.id}
              className="font-[family-name:var(--font-ibm-plex-mono)] text-xs"
            >
              {model.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
