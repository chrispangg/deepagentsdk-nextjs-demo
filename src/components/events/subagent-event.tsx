/**
 * SubagentEvent component - Displays subagent lifecycle
 *
 * Shows subagent spawning, progress, and completion with a distinctive
 * "branch" visualization inspired by git branch diagrams.
 *
 * Design: Process Flow Visualization
 * - Visual connection lines show parent-child relationships
 * - Status animations (pulse when working, smooth transitions)
 * - Collapsible with progressive disclosure
 * - Nested indentation for sub-subagents
 */

import React, { useState } from 'react';
import { Bot, Loader2, CheckCircle, ChevronDown, ChevronRight, GitBranch } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { SubagentEvent } from '@/lib/use-chat-full-events';

interface SubagentEventProps {
  event: SubagentEvent;
  depth?: number; // For nested subagents
}

export function SubagentEventDisplay({ event, depth = 0 }: SubagentEventProps) {
  const [expanded, setExpanded] = useState(true);

  const isStart = event.type === 'subagent-start';
  const isFinish = event.type === 'subagent-finish';
  const isStep = event.type === 'subagent-step';

  // Determine status
  const status = isStart ? 'working' : isFinish ? 'completed' : 'stepping';

  return (
    <div
      className="relative"
      style={{ marginLeft: `${depth * 16}px` }}
    >
      {/* Branch connection line */}
      <div className="absolute left-0 top-6 bottom-0 w-px bg-gradient-to-b from-blue-400 to-blue-200 dark:from-blue-500 dark:to-blue-400" />

      {/* Branch dot indicator */}
      <motion.div
        className="absolute left-[-3px] top-2 w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400"
        animate={{
          scale: status === 'working' ? [1, 1.2, 1] : 1,
          opacity: status === 'working' ? [1, 0.7, 1] : 1
        }}
        transition={{
          duration: 2,
          repeat: status === 'working' ? Infinity : 0,
          ease: 'easeInOut'
        }}
      />

      {/* Content */}
      <div className="ml-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 py-2 hover:opacity-80 transition-opacity"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}

          {/* Status icon */}
          <div className="flex-shrink-0">
            {status === 'working' && <Loader2 size={16} className="text-blue-500 animate-spin" />}
            {status === 'completed' && <CheckCircle size={16} className="text-green-500" />}
            {status === 'stepping' && <GitBranch size={16} className="text-purple-500" />}
          </div>

          {/* Subagent info */}
          <div className="flex items-center gap-2 text-sm">
            <Bot size={14} className="text-gray-500 dark:text-gray-400" />
            <span className="font-medium">{event.name}</span>

            {event.task && isStart && (
              <span className="text-gray-600 dark:text-gray-400">
                task: {event.task}
              </span>
            )}

            {event.stepIndex !== undefined && (
              <span className="text-xs text-gray-500 dark:text-gray-500">
                step {event.stepIndex}
              </span>
            )}
          </div>
        </button>

        {/* Expanded content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              {/* Task details (start) */}
              {event.task && (
                <div className="ml-6 text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {event.task}
                </div>
              )}

              {/* Result details (finish) */}
              {event.result && isFinish && (
                <div className="ml-6 p-3 bg-green-50 dark:bg-green-900/20 rounded-md text-sm">
                  <div className="text-green-700 dark:text-green-300 font-medium mb-1">Result</div>
                  <div className="text-gray-700 dark:text-gray-300">{event.result}</div>
                </div>
              )}

              {/* Tool calls (step) */}
              {event.toolCalls && event.toolCalls.length > 0 && (
                <div className="ml-6 space-y-1">
                  {event.toolCalls.map((call, idx) => (
                    <div key={idx} className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                      → {call.toolName}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
