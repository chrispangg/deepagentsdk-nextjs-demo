/**
 * WebEvent component - Displays web operations
 *
 * Shows web searches, HTTP requests, and URL fetching with
 * status indicators and response information.
 */

import React from 'react';
import { Globe, Loader2, CheckCircle, XCircle, Search } from 'lucide-react';
import type { WebEvent } from '@/lib/use-chat-full-events';

interface WebEventProps {
  event: WebEvent;
}

export function WebEventDisplay({ event }: WebEventProps) {
  const isStart = event.type.includes('start');
  const isFinish = event.type.includes('finish');
  const isSuccess = isFinish && (
    event.type === 'web-search-finish' ||
    (event.statusCode !== undefined && event.statusCode >= 200 && event.statusCode < 300) ||
    event.success === true
  );

  return (
    <div className="group relative flex items-start gap-2 py-2">
      {/* Visual indicator line */}
      <div className="absolute left-[7px] top-8 bottom-0 w-px bg-gradient-to-b from-gray-300 to-transparent dark:from-gray-700" />

      {/* Icon */}
      <div className="relative z-10 flex-shrink-0">
        {isStart && <Loader2 size={16} className="text-blue-500 animate-spin" />}
        {isSuccess && <CheckCircle size={16} className="text-green-500" />}
        {!isSuccess && isFinish && <XCircle size={16} className="text-red-500" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          {event.type.includes('web-search') ? (
            <Search size={14} className="text-gray-500 dark:text-gray-400" />
          ) : (
            <Globe size={14} className="text-gray-500 dark:text-gray-400" />
          )}

          {event.query && (
            <span className="text-gray-700 dark:text-gray-300">
              Search: <span className="font-medium">{event.query}</span>
            </span>
          )}

          {event.url && (
            <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
              {event.method && `${event.method} `}{event.url}
            </span>
          )}

          {event.statusCode && (
            <span className={`text-xs ${
              event.statusCode >= 200 && event.statusCode < 300
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {event.statusCode}
            </span>
          )}

          {event.resultCount !== undefined && (
            <span className="text-gray-500 dark:text-gray-500 text-xs">
              ({event.resultCount} results)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
