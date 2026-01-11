/**
 * Sandbox Manager - Shared module for managing sandbox instances
 * 
 * This module provides a centralized way to manage sandbox instances
 * (both Local and E2B) across different API routes.
 */

import { type E2BBackend } from "deepagentsdk";

// Global cache for E2B sandboxes
// Using a simple Map since Next.js API routes share the same Node.js process
const e2bSandboxes = new Map<string, E2BBackend>();

// Default sandbox ID for single-user scenarios
export const DEFAULT_SANDBOX_ID = "default";

/**
 * Store an E2B sandbox instance
 */
export function setE2BSandbox(sandboxId: string, sandbox: E2BBackend): void {
  e2bSandboxes.set(sandboxId, sandbox);
}

/**
 * Get an E2B sandbox instance
 */
export function getE2BSandbox(sandboxId: string): E2BBackend | undefined {
  return e2bSandboxes.get(sandboxId);
}

/**
 * Check if an E2B sandbox exists
 */
export function hasE2BSandbox(sandboxId: string): boolean {
  return e2bSandboxes.has(sandboxId);
}

/**
 * Remove an E2B sandbox from cache
 */
export function removeE2BSandbox(sandboxId: string): boolean {
  return e2bSandboxes.delete(sandboxId);
}

/**
 * Get all active E2B sandbox IDs
 */
export function getActiveE2BSandboxIds(): string[] {
  return Array.from(e2bSandboxes.keys());
}

/**
 * Clear all E2B sandboxes
 */
export async function clearAllE2BSandboxes(): Promise<void> {
  for (const [id, sandbox] of e2bSandboxes) {
    try {
      await sandbox.dispose();
    } catch (error) {
      console.error(`[SandboxManager] Error disposing sandbox ${id}:`, error);
    }
  }
  e2bSandboxes.clear();
}
