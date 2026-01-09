"use client";

import { createContext, useContext } from "react";
import { useCommandErrorsLogs } from "@/app/state";

interface Props {
	children: React.ReactNode;
	debounceTimeMs?: number;
}

/**
 * Error Monitor Component - Stub Implementation
 *
 * TODO: Implement full error monitoring functionality.
 * This is a stub to allow the build to succeed.
 */
export function ErrorMonitor({ children }: Props) {
	const { errors } = useCommandErrorsLogs();

	// Log errors for debugging
	if (errors.length > 0) {
		console.warn(`[ErrorMonitor] ${errors.length} errors detected`, errors);
	}

	return (
		<Context.Provider value={{ status: "ready" }}>
			{children}
		</Context.Provider>
	);
}

const Context = createContext<{
	status: "ready" | "pending" | "disabled";
} | null>(null);

export function useErrorMonitor() {
	const context = useContext(Context);
	if (!context) {
		throw new Error("useErrorMonitor must be used within a ErrorMonitor");
	}
	return context;
}
