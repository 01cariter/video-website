'use client';

import { useId, type ComponentType } from 'react';
import { LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

export interface MotionTabItem<T extends string> {
  value: T;
  label: string;
  icon?: ComponentType<{ className?: string }>;
}

export function MotionTabs<T extends string>({
  value,
  items,
  onValueChange,
  ariaLabel,
  className,
}: {
  value: T;
  items: readonly MotionTabItem<T>[];
  onValueChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  const id = useId();
  const reduceMotion = Boolean(useReducedMotion());

  return (
    <LayoutGroup id={id}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={cn(
          'inline-flex min-w-0 items-center rounded-xl bg-secondary p-1',
          className,
        )}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.value === value;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={active}
              className={cn(
                'relative flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-muted-foreground transition-colors',
                active && 'text-foreground',
              )}
              onClick={() => onValueChange(item.value)}
            >
              {active ? (
                <motion.span
                  layoutId="active-tab"
                  className="absolute inset-0 rounded-lg bg-card shadow-[0_1px_4px_rgba(0,0,0,.08)]"
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 460, damping: 38 }
                  }
                />
              ) : null}
              {Icon ? <Icon className="relative z-[1] size-3.5 shrink-0" /> : null}
              <span className="relative z-[1] truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
