/**
 * CommandEvent component - Displays command execution
 *
 * Shows shell command execution with start/finish status,
 * exit codes, and truncation warnings.
 */

import React from 'react';
import { Terminal, Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import type { CommandEvent } from '@/lib/use-chat-full-events';

interface CommandEventProps {
  event: CommandEvent;
}

export function CommandEventDisplay({ event }: CommandEventProps) {
  const isStart = event.type === 'execute-start';
  const isFinish = event.type === 'execute-finish';
  const isSuccess = isFinish && event.exitCode === 0;
  const isError = isFinish && event.exitCode !== 0;

  return (
    <div className="group relative flex items-start gap-2 py-2">
      {/* Visual indicator line */}
      <div className="absolute left-[7px] top-8 bottom-0 w-px bg-gradient-to-b from-gray-300 to-transparent dark:from-gray-700" />

      {/* Icon */}
      <div className="relative z-10 flex-shrink-0">
        {isStart && <Loader2 size={16} className="text-blue-500 animate-spin" />}
        {isSuccess && <CheckCircle size={16} className="text-green-500" />}
        {isError && <XCircle size={16} className="text-red-500" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <Terminal size={14} className="text-gray-500 dark:text-gray-400" />
          <span className="font-mono text-xs">{event.command}</span>
          {isError && (
            <span className="text-red-500 dark:text-red-400 text-xs">
              (exit: {event.exitCode})
            </span>
          )}
          {event.truncated && (
            <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400 text-xs" title="Output truncated">
              <AlertTriangle size={12} />
              truncated
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
