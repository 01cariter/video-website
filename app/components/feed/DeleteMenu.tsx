'use client';

import { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeleteMenuProps {
  itemLabel: 'post' | 'comment';
  onDelete: () => Promise<void>;
  className?: string;
  disabled?: boolean;
}

export default function DeleteMenu({
  itemLabel,
  onDelete,
  className,
  disabled = false,
}: DeleteMenuProps) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen && !busy) {
      setConfirming(false);
      setError('');
    }
  }

  async function confirmDelete() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await onDelete();
      setOpen(false);
      setConfirming(false);
    } catch {
      setError(`Could not delete this ${itemLabel}.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu.Root open={open} onOpenChange={changeOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn('delete-menu-trigger', className)}
          aria-label={`${itemLabel === 'post' ? 'Post' : 'Comment'} actions`}
          disabled={disabled}
        >
          <MoreHorizontal aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="delete-menu-content"
          align="end"
          sideOffset={6}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          {!confirming ? (
            <DropdownMenu.Item
              className="delete-menu-item danger"
              onSelect={(event) => {
                event.preventDefault();
                setConfirming(true);
              }}
            >
              <Trash2 aria-hidden="true" />
              Delete {itemLabel}
            </DropdownMenu.Item>
          ) : (
            <div
              className="delete-menu-confirm"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <b>Delete this {itemLabel}?</b>
              <p>This cannot be undone.</p>
              {error && <span role="alert">{error}</span>}
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(false);
                    setError('');
                  }}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => void confirmDelete()}
                  disabled={busy}
                >
                  {busy ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
