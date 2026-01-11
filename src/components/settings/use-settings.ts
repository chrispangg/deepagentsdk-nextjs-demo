import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ModelProvider = "anthropic" | "openai";
export type SandboxType = "local" | "e2b";

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
  hasE2bApiKey: boolean;
  isCloudEnvironment: boolean;
}

interface ApiSettings {
  anthropicApiKey: string;
  anthropicBaseUrl: string;
  tavilyApiKey: string;
  openaiApiKey: string;
  e2bApiKey: string;
  selectedProvider: ModelProvider;
  selectedModel: string;
  sandboxType: SandboxType;
  useServerDefaults: boolean; // New flag to track if using .env defaults
  isCloudEnvironment: boolean; // Track if running in cloud
}

interface ApiSettingsStore extends ApiSettings {
  setAnthropicApiKey: (key: string) => void;
  setAnthropicBaseUrl: (url: string) => void;
  setTavilyApiKey: (key: string) => void;
  setOpenaiApiKey: (key: string) => void;
  setE2bApiKey: (key: string) => void;
  setSelectedProvider: (provider: ModelProvider) => void;
  setSelectedModel: (model: string) => void;
  setSandboxType: (type: SandboxType) => void;
  resetSettings: () => void;
  hasApiKey: (provider: ModelProvider) => boolean;
  hasAnyApiKey: () => boolean;
  hasE2bApiKey: () => boolean;
  canUseLocalSandbox: () => boolean;
  initializeFromServer: () => Promise<void>;
}

const DEFAULT_SETTINGS: ApiSettings = {
  anthropicApiKey: "",
  anthropicBaseUrl: "https://api.anthropic.com/v1",
  tavilyApiKey: "",
  openaiApiKey: "",
  e2bApiKey: "",
  selectedProvider: "anthropic",
  selectedModel: "anthropic/claude-sonnet-4-5-20250929",
  sandboxType: "local", // Will be updated based on environment
  useServerDefaults: true, // Default to using server defaults
  isCloudEnvironment: false,
};

export const useSettings = create<ApiSettingsStore>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,

      setAnthropicApiKey: (key) => set({ anthropicApiKey: key, useServerDefaults: false }),

      setAnthropicBaseUrl: (url) => set({ anthropicBaseUrl: url, useServerDefaults: false }),

      setTavilyApiKey: (key) => set({ tavilyApiKey: key, useServerDefaults: false }),

      setOpenaiApiKey: (key) => set({ openaiApiKey: key, useServerDefaults: false }),

      setE2bApiKey: (key) => {
        const state = get();
        set({ 
          e2bApiKey: key, 
          useServerDefaults: false,
          // Auto-switch to E2B when user provides key
          sandboxType: key ? "e2b" : (state.isCloudEnvironment ? "e2b" : "local"),
        });
      },

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

      setSandboxType: (type) => set({ sandboxType: type }),

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

      hasE2bApiKey: () => {
        const state = get();
        return !!state.e2bApiKey && state.e2bApiKey !== "[FROM_SERVER]" || state.e2bApiKey === "[FROM_SERVER]";
      },

      canUseLocalSandbox: () => {
        const state = get();
        // Can only use local sandbox in local environment
        return !state.isCloudEnvironment;
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
          const hasUserE2bKey = state.e2bApiKey && state.e2bApiKey !== "[FROM_SERVER]";

          // Determine sandbox type based on environment and available keys
          const hasE2bKey = hasUserE2bKey || config.hasE2bApiKey;
          let sandboxType: SandboxType;
          
          if (config.isCloudEnvironment) {
            // In cloud, always use E2B (local not available)
            sandboxType = "e2b";
          } else {
            // In local, use E2B if key available and user hasn't explicitly chosen local
            // Default to local if no E2B key
            sandboxType = hasE2bKey ? state.sandboxType : "local";
          }

          // Always update state based on server config - this ensures stale [FROM_SERVER]
          // markers are cleared when keys are removed from .env
          set({
            anthropicApiKey: hasUserAnthropicKey ? state.anthropicApiKey : (config.hasAnthropicApiKey ? "[FROM_SERVER]" : ""),
            anthropicBaseUrl: config.anthropicBaseUrl,
            tavilyApiKey: hasUserTavilyKey ? state.tavilyApiKey : (config.hasTavilyApiKey ? "[FROM_SERVER]" : ""),
            openaiApiKey: hasUserOpenaiKey ? state.openaiApiKey : (config.hasOpenaiApiKey ? "[FROM_SERVER]" : ""),
            e2bApiKey: hasUserE2bKey ? state.e2bApiKey : (config.hasE2bApiKey ? "[FROM_SERVER]" : ""),
            isCloudEnvironment: config.isCloudEnvironment,
            sandboxType,
            useServerDefaults: !hasUserAnthropicKey && !hasUserOpenaiKey && !hasUserTavilyKey && !hasUserE2bKey && (config.hasAnthropicApiKey || config.hasOpenaiApiKey || config.hasTavilyApiKey || config.hasE2bApiKey),
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
