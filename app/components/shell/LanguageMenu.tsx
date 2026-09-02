'use client';

import { useRouter } from 'next/navigation';
import { DropdownMenu } from 'radix-ui';
import { Check, Languages } from 'lucide-react';
import { LOCALES, LOCALE_COOKIE, LOCALE_LABELS } from '@/lib/i18n/config';
import { useT } from '../i18n-provider';

const ONE_YEAR = 60 * 60 * 24 * 365;

export default function LanguageMenu() {
  const router = useRouter();
  const t = useT();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="ghost-btn"
          title={t('common.language')}
          aria-label={t('common.language')}
        >
          <Languages aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="delete-menu-content"
          align="end"
          sideOffset={6}
        >
          {LOCALES.map((locale) => (
            <DropdownMenu.Item
              key={locale}
              className="delete-menu-item"
              onSelect={() => {
                // A plain cookie rather than a URL segment: the whole app would
                // have to move under /[locale] for that, and this reads the
                // same on every route.
                document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
                router.refresh();
              }}
            >
              {locale === t.locale ? (
                <Check aria-hidden="true" />
              ) : (
                <span className="delete-menu-spacer" aria-hidden="true" />
              )}
              {LOCALE_LABELS[locale]}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
