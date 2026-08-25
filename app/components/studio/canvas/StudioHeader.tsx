'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowLeft,
  CloudOff,
  LoaderCircle,
  Moon,
  PanelRight,
  Sun,
} from 'lucide-react';
import { getThemeSnapshot, setTheme } from '@/lib/theme';
import { studioSnap } from '@/lib/studio/motion';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Separator } from '@/app/components/ui/separator';
import { cn } from '@/lib/utils';
import StudioCreditPill from './StudioCreditPill';

interface StudioHeaderProps {
  title: string;
  onTitleChange: (title: string) => void;
  syncStatus: 'saved' | 'saving' | 'offline';
  agentOpen: boolean;
  onToggleAgent: () => void;
}

export default function StudioHeader({
  title,
  onTitleChange,
  syncStatus,
  agentOpen,
  onToggleAgent,
}: StudioHeaderProps) {
  const [dark, setDark] = useState(() => (typeof document === 'undefined' ? false : getThemeSnapshot()));
  const reduceMotion = Boolean(useReducedMotion());

  return (
    <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-2">
      <div className="flex min-w-0 items-center gap-0.5">
        <Button asChild variant="ghost" size="icon-xs" aria-label="Back to Creator Studio">
          <Link href="/studio">
            <ArrowLeft />
          </Link>
        </Button>
        <Link href="/" className="inline-flex items-center gap-1.5 font-[family-name:var(--font-display)] text-[13px] font-semibold" aria-label="Snackd home">
          <span className="mark !size-[18px] !rounded-[5px]" />
          <span>Snackd</span>
        </Link>
        <Separator className="mx-1 h-3.5" orientation="vertical" />
        <Input
          className="h-7 w-auto max-w-64 min-w-28 border-0 bg-transparent px-1 text-[13px] font-medium shadow-none focus-visible:border-0 focus-visible:ring-0"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          aria-label="Project name"
        />
        {syncStatus !== 'saved' ? (
          <span
            className={cn(
              'ml-1 flex shrink-0 items-center gap-1 text-[10px] font-medium text-muted-foreground',
              syncStatus === 'offline' && 'text-destructive',
            )}
            role="status"
          >
            {syncStatus === 'saving' ? (
              <LoaderCircle className="size-3 animate-spin" />
            ) : (
              <CloudOff className="size-3" />
            )}
            {syncStatus === 'saving' ? 'Saving…' : 'Saved locally · retrying'}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        <StudioCreditPill />
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => {
            setTheme(!dark);
            setDark(!dark);
          }}
          aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={dark ? 'moon' : 'sun'}
              className="inline-flex"
              initial={reduceMotion ? false : { opacity: 0, rotate: -50, scale: 0.7 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, rotate: 50, scale: 0.7 }}
              transition={studioSnap}
            >
              {dark ? <Moon /> : <Sun />}
            </motion.span>
          </AnimatePresence>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className={cn(
            'rounded-md',
            agentOpen &&
              '!bg-primary !text-primary-foreground hover:!bg-primary/90 hover:!text-primary-foreground',
          )}
          onClick={onToggleAgent}
        >
          <PanelRight />
          Agent
        </Button>
      </div>
    </header>
  );
}
