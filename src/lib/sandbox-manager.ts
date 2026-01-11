/**
 * Sandbox Manager - Shared module for managing sandbox instances
 * 
 * This module provides a centralized way to manage sandbox instances
 * (both Local and E2B) across different API routes.
 * 
 * IMPORTANT: In serverless environments (Vercel, etc.), each API route may run
 * in a separate function instance. In-memory caches don't persist between
 * invocations. We store the E2B sandbox ID separately so we can reconnect
 * to existing sandboxes from different function instances.
 */

import { type E2BBackend } from "deepagentsdk";

// In-memory cache for E2B sandbox instances (works locally, may not persist in serverless)
const e2bSandboxes = new Map<string, E2BBackend>();

// Separate storage for E2B sandbox IDs - these are the actual E2B sandbox IDs
// that can be used to reconnect to sandboxes in serverless environments
const e2bSandboxIds = new Map<string, string>();

// Default sandbox ID for single-user scenarios (our internal key)
export const DEFAULT_SANDBOX_ID = "default";

/**
 * Store an E2B sandbox instance and its ID
 */
export function setE2BSandbox(sandboxId: string, sandbox: E2BBackend): void {
  e2bSandboxes.set(sandboxId, sandbox);
  // Also store the actual E2B sandbox ID for reconnection
  if (sandbox.id) {
    e2bSandboxIds.set(sandboxId, sandbox.id);
    console.log(`[SandboxManager] Stored E2B sandbox with ID: ${sandbox.id}`);
  }
}

/**
 * Get an E2B sandbox instance from cache
 */
export function getE2BSandbox(sandboxId: string): E2BBackend | undefined {
  return e2bSandboxes.get(sandboxId);
}

/**
 * Get the actual E2B sandbox ID (for reconnection in serverless environments)
 */
export function getE2BSandboxId(sandboxId: string): string | undefined {
  return e2bSandboxIds.get(sandboxId);
}

/**
 * Store just the E2B sandbox ID (useful when we know the ID but don't have the instance)
 */
export function setE2BSandboxId(sandboxId: string, e2bId: string): void {
  e2bSandboxIds.set(sandboxId, e2bId);
}

/**
 * Check if an E2B sandbox exists (either instance or ID)
 */
export function hasE2BSandbox(sandboxId: string): boolean {
  return e2bSandboxes.has(sandboxId) || e2bSandboxIds.has(sandboxId);
}

/**
 * Remove an E2B sandbox from cache
 */
export function removeE2BSandbox(sandboxId: string): boolean {
  e2bSandboxIds.delete(sandboxId);
  return e2bSandboxes.delete(sandboxId);
}

/**
 * Get all active E2B sandbox IDs
 */
export function getActiveE2BSandboxIds(): string[] {
  return Array.from(e2bSandboxIds.keys());
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
  e2bSandboxIds.clear();
}
