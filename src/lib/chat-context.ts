/**
 * Stub chat context module to fix build
 * TODO: Implement actual chat context functionality
 */

import { createContext } from "react";

export const SharedChatContext = createContext<any>(null);

export function useSharedChatContext() {
  return {
    chat: null,
  };
}
