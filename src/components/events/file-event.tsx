/**
 * FileEvent component - Displays file system operations
 *
 * Shows file write, edit, read, and search operations with status
 * indicators and expandable content preview.
 */

import React, { useState } from 'react';
import { File, FileEdit, FileSearch, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import type { FileEvent } from '@/lib/use-chat-full-events';

interface FileEventProps {
  event: FileEvent;
}

export function FileEventDisplay({ event }: FileEventProps) {
  const [expanded, setExpanded] = useState(false);

  // Map event types to icons and labels
  const config = {
    'file-write-start': { icon: Loader2, label: 'Writing', color: 'text-blue-500', spin: true },
    'file-written': { icon: File, label: 'Wrote', color: 'text-green-500', spin: false },
    'file-edited': { icon: FileEdit, label: 'Edited', color: 'text-yellow-500', spin: false },
    'file-read': { icon: File, label: 'Read', color: 'text-purple-500', spin: false },
    'ls': { icon: FileSearch, label: 'Listed', color: 'text-blue-500', spin: false },
    'glob': { icon: FileSearch, label: 'Found', color: 'text-blue-500', spin: false },
    'grep': { icon: FileSearch, label: 'Matched', color: 'text-blue-500', spin: false },
  }[event.type];

  const Icon = config.icon;

  return (
    <div className="group relative flex items-start gap-2 py-2">
      {/* Visual indicator line */}
      <div className="absolute left-[7px] top-8 bottom-0 w-px bg-gradient-to-b from-gray-300 to-transparent dark:from-gray-700" />

      {/* Icon */}
      <div className={`relative z-10 flex-shrink-0 ${config.color} ${config.spin ? 'animate-spin' : ''}`}>
        <Icon size={16} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="font-medium">{config.label}</span>
          {event.path && (
            <span className="text-gray-600 dark:text-gray-400 font-mono text-xs">
              {event.path}
            </span>
          )}
          {event.lines !== undefined && (
            <span className="text-gray-500 dark:text-gray-500 text-xs">
              ({event.lines} lines)
            </span>
          )}
          {event.occurrences !== undefined && (
            <span className="text-gray-500 dark:text-gray-500 text-xs">
              ({event.occurrences} edits)
            </span>
          )}
          {event.count !== undefined && (
            <span className="text-gray-500 dark:text-gray-500 text-xs">
              ({event.count} items)
            </span>
          )}
        </button>

        {expanded && event.content && (
          <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-md overflow-x-auto text-xs font-mono">
            {event.content}
          </pre>
        )}
      </div>
    </div>
  );
}
