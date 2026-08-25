'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

export default function AgentMarkdown({
  children,
  compact = false,
}: {
  children: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'min-w-0 max-w-full [overflow-wrap:anywhere] text-[13.5px] leading-[1.55]',
        '[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
        '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
        '[&_code]:rounded-[4px] [&_code]:bg-foreground/[0.06] [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em]',
        '[&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:text-[16px] [&_h1]:font-semibold',
        '[&_h2]:mb-1.5 [&_h2]:mt-3 [&_h2]:text-[15px] [&_h2]:font-semibold',
        '[&_h3]:mb-1 [&_h3]:mt-2.5 [&_h3]:text-[14px] [&_h3]:font-semibold',
        '[&_hr]:my-3 [&_hr]:border-border',
        '[&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
        '[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
        '[&_pre]:my-2 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:bg-foreground/[0.055] [&_pre]:p-2.5',
        '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
        '[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-1.5 [&_th]:border [&_th]:border-border [&_th]:bg-foreground/[0.04] [&_th]:p-1.5 [&_th]:text-left',
        '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5',
        compact && 'text-[13px] [&_p]:my-1.5',
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children: linkChildren, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer noopener">
              {linkChildren}
            </a>
          ),
          img: ({ alt }) => (
            <span className="text-muted-foreground">
              {alt ? `[Image: ${alt}]` : '[Image]'}
            </span>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
