'use client';

import { useState, type ReactNode } from 'react';
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
    <div className="flex items-center gap-2 rounded-xl border border-border/75 bg-[var(--studio-raised)] px-2.5 py-2 text-[11.5px] font-medium shadow-[0_5px_16px_-14px_rgba(82,43,24,.42)]">
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
  children: ReactNode;
}) {
  return <AgentThinking>{children}</AgentThinking>;
}

export function AgentThinking({
  label = 'Thinking',
  children,
  active = false,
}: {
  label?: string;
  children?: ReactNode;
  active?: boolean;
}) {
  const [open, setOpen] = useState(active);

  if (children !== undefined && children !== null) {
    return (
      <details
        className="group overflow-hidden rounded-xl border border-border/75 bg-[var(--studio-raised)] text-xs text-muted-foreground shadow-[0_5px_16px_-14px_rgba(82,43,24,.42)]"
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-2 font-semibold text-foreground/80 marker:content-none">
          {active ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
          ) : (
            <span className="grid size-5 shrink-0 place-items-center rounded-md bg-secondary/70">
              <ChevronDown className="size-3 transition-transform group-open:rotate-180" />
            </span>
          )}
          <span className="min-w-0 flex-1">{label}</span>
          <span className="text-[10px] font-medium text-muted-foreground group-open:hidden">
            Show
          </span>
          <span className="hidden text-[10px] font-medium text-muted-foreground group-open:inline">
            Hide
          </span>
        </summary>
        <div className="border-t border-border/70 px-2.5 py-2.5 leading-5">
          {children}
        </div>
      </details>
    );
  }

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
