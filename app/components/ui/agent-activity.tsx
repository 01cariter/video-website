'use client';

import { Check, ChevronDown, CircleAlert, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AgentActivity({
  label,
  state = 'complete',
}: {
  label: string;
  state?: 'running' | 'complete' | 'error';
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-secondary/65 px-2.5 py-2 text-[11.5px] font-medium">
      <span
        className={cn(
          'grid size-5 shrink-0 place-items-center rounded-md bg-card shadow-[inset_0_0_0_1px_var(--line)]',
          state === 'error' && 'text-destructive',
        )}
      >
        {state === 'running' ? (
          <Loader2 className="size-3 animate-spin" />
        ) : state === 'error' ? (
          <CircleAlert className="size-3" />
        ) : (
          <Check className="size-3" />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="text-[10px] text-muted-foreground">
        {state === 'running'
          ? 'Running'
          : state === 'error'
            ? 'Failed'
            : 'Done'}
      </span>
    </div>
  );
}

export function AgentReasoning({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-lg bg-secondary/45 px-2.5 py-2 text-xs text-muted-foreground">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-foreground/78">
        <ChevronDown className="size-3 transition-transform group-open:rotate-180" />
        Reasoning
      </summary>
      <div className="mt-2 whitespace-pre-wrap border-l border-border pl-3 leading-5">
        {children}
      </div>
    </details>
  );
}

export function AgentThinking({ label = 'Thinking' }: { label?: string }) {
  return (
    <div
      className="flex items-center gap-2 py-1 text-[11.5px] font-medium text-muted-foreground"
      aria-label={label}
    >
      <Loader2 className="size-3.5 animate-spin" />
      <span>{label}</span>
    </div>
  );
}
