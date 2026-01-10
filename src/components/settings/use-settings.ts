import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ModelProvider = "anthropic" | "openai";

export interface Model {
  id: string;
  name: string;
  provider: ModelProvider;
}

export interface ServerConfig {
  hasAnthropicApiKey: boolean;
  anthropicBaseUrl: string;
  hasTavilyApiKey: boolean;
  hasOpenaiApiKey: boolean;
}

interface ApiSettings {
  anthropicApiKey: string;
  anthropicBaseUrl: string;
  tavilyApiKey: string;
  openaiApiKey: string;
  selectedProvider: ModelProvider;
  selectedModel: string;
  useServerDefaults: boolean; // New flag to track if using .env defaults
}

interface ApiSettingsStore extends ApiSettings {
  setAnthropicApiKey: (key: string) => void;
  setAnthropicBaseUrl: (url: string) => void;
  setTavilyApiKey: (key: string) => void;
  setOpenaiApiKey: (key: string) => void;
  setSelectedProvider: (provider: ModelProvider) => void;
  setSelectedModel: (model: string) => void;
  resetSettings: () => void;
  hasApiKey: (provider: ModelProvider) => boolean;
  hasAnyApiKey: () => boolean;
  initializeFromServer: () => Promise<void>;
}

const DEFAULT_SETTINGS: ApiSettings = {
  anthropicApiKey: "",
  anthropicBaseUrl: "https://api.anthropic.com/v1",
  tavilyApiKey: "",
  openaiApiKey: "",
  selectedProvider: "anthropic",
  selectedModel: "anthropic/claude-sonnet-4-5-20250929",
  useServerDefaults: true, // Default to using server defaults
};

export const useSettings = create<ApiSettingsStore>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,

      setAnthropicApiKey: (key) => set({ anthropicApiKey: key, useServerDefaults: false }),

      setAnthropicBaseUrl: (url) => set({ anthropicBaseUrl: url, useServerDefaults: false }),

      setTavilyApiKey: (key) => set({ tavilyApiKey: key, useServerDefaults: false }),

      setOpenaiApiKey: (key) => set({ openaiApiKey: key, useServerDefaults: false }),

      setSelectedProvider: (provider) =>
        set((state) => ({
          selectedProvider: provider,
          // Update default model when provider changes
          selectedModel:
            provider === "anthropic"
              ? "anthropic/claude-sonnet-4-5-20250929"
              : "openai/gpt-4.1",
        })),

      setSelectedModel: (model) => set({ selectedModel: model }),

      resetSettings: () => set(DEFAULT_SETTINGS),

      hasApiKey: (provider) => {
        const state = get();
        // If using server defaults, check server config
        if (state.useServerDefaults) {
          return provider === "anthropic"
            ? state.anthropicApiKey !== "" // Will be set from server
            : state.openaiApiKey !== "";
        }
        // Otherwise check local storage
        return provider === "anthropic"
          ? !!state.anthropicApiKey
          : !!state.openaiApiKey;
      },

      hasAnyApiKey: () => {
        const state = get();
        // Check if we have either Anthropic or OpenAI key (from server or local)
        return !!state.anthropicApiKey || !!state.openaiApiKey;
      },

      initializeFromServer: async () => {
        try {
          const response = await fetch("/api/config");
          if (!response.ok) return;

          const config: ServerConfig = await response.json();

          const state = get();

          // Check if user has manually entered their own keys (not from server)
          const hasUserAnthropicKey = state.anthropicApiKey && state.anthropicApiKey !== "[FROM_SERVER]";
          const hasUserOpenaiKey = state.openaiApiKey && state.openaiApiKey !== "[FROM_SERVER]";
          const hasUserTavilyKey = state.tavilyApiKey && state.tavilyApiKey !== "[FROM_SERVER]";

          // Always update state based on server config - this ensures stale [FROM_SERVER]
          // markers are cleared when keys are removed from .env
          set({
            anthropicApiKey: hasUserAnthropicKey ? state.anthropicApiKey : (config.hasAnthropicApiKey ? "[FROM_SERVER]" : ""),
            anthropicBaseUrl: config.anthropicBaseUrl,
            tavilyApiKey: hasUserTavilyKey ? state.tavilyApiKey : (config.hasTavilyApiKey ? "[FROM_SERVER]" : ""),
            openaiApiKey: hasUserOpenaiKey ? state.openaiApiKey : (config.hasOpenaiApiKey ? "[FROM_SERVER]" : ""),
            useServerDefaults: !hasUserAnthropicKey && !hasUserOpenaiKey && !hasUserTavilyKey && (config.hasAnthropicApiKey || config.hasOpenaiApiKey || config.hasTavilyApiKey),
          });
        } catch (error) {
          console.error("Failed to fetch server config:", error);
        }
      },
    }),
    {
      name: "api-settings-storage",
    }
  )
);
