import type { Locale } from './config';
import type { Messages } from './messages/en';

export type { Messages };
export type MessageKey = keyof Messages;

/** Keys whose dictionary entries come in `.one` / `.other` pairs. */
type PluralStem = Extract<MessageKey, `${string}.one`> extends `${infer S}.one`
  ? S
  : never;

export interface Translate {
  (key: MessageKey, values?: Record<string, string | number>): string;
  /**
   * Picks the singular or plural entry with Intl.PluralRules, so French keeps
   * its singular at zero and Chinese never needs a second form.
   */
  plural: (
    stem: PluralStem,
    count: number,
    values?: Record<string, string | number>,
  ) => string;
  locale: Locale;
}

function interpolate(
  template: string,
  values?: Record<string, string | number>,
) {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

export function createTranslate(
  locale: Locale,
  messages: Messages,
  fallback: Messages,
): Translate {
  const translate = ((key, values) =>
    interpolate(messages[key] ?? fallback[key] ?? key, values)) as Translate;

  translate.locale = locale;
  translate.plural = (stem, count, values) => {
    const rule = new Intl.PluralRules(locale).select(count);
    const key = (
      rule === 'one' ? `${stem}.one` : `${stem}.other`
    ) as MessageKey;
    return translate(key, { count, ...values });
  };
  return translate;
}
