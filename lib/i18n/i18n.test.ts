import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_LOCALE, LOCALES, isLocale, pickLocale } from './config';
import { createTranslate } from './t';
import { en } from './messages/en';
import { zh } from './messages/zh';
import { es } from './messages/es';
import { fr } from './messages/fr';
import { de } from './messages/de';

const DICTIONARIES = { en, zh, es, fr, de };

describe('locale negotiation', () => {
  it('honours the reader’s own choice above everything else', () => {
    assert.equal(pickLocale('de', 'fr-FR,fr;q=0.9'), 'de');
  });

  it('matches Accept-Language on the base tag, by quality', () => {
    assert.equal(pickLocale(null, 'de-AT,de;q=0.9'), 'de');
    assert.equal(pickLocale(null, 'pt-BR;q=0.9,es;q=0.8'), 'es');
    assert.equal(pickLocale(null, 'en;q=0.5,fr;q=0.9'), 'fr');
  });

  it('falls back to English for anything unsupported or missing', () => {
    assert.equal(pickLocale(null, 'ja-JP,ja;q=0.9'), DEFAULT_LOCALE);
    assert.equal(pickLocale(null, null), DEFAULT_LOCALE);
    assert.equal(pickLocale('klingon', ''), DEFAULT_LOCALE);
  });

  it('rejects anything that is not one of the shipped locales', () => {
    assert.equal(isLocale('en'), true);
    assert.equal(isLocale('en-GB'), false);
    assert.equal(isLocale(null), false);
  });
});

describe('dictionaries', () => {
  // The Messages type already enforces this at compile time; the test catches
  // a key that was added to en and stubbed elsewhere with an empty string.
  it('are complete and non-empty in every locale', () => {
    const keys = Object.keys(en);
    for (const locale of LOCALES) {
      const dictionary = DICTIONARIES[locale] as Record<string, string>;
      assert.equal(
        Object.keys(dictionary).length,
        keys.length,
        `${locale} has a different number of keys`,
      );
      for (const key of keys) {
        assert.ok(dictionary[key]?.trim(), `${locale} is missing ${key}`);
      }
    }
  });

  it('keeps every placeholder the English string declares', () => {
    const placeholders = (value: string) =>
      [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    for (const locale of LOCALES) {
      if (locale === 'en') continue;
      const dictionary = DICTIONARIES[locale] as Record<string, string>;
      for (const [key, value] of Object.entries(en)) {
        assert.deepEqual(
          placeholders(dictionary[key]),
          placeholders(value),
          `${locale}.${key} does not carry the same placeholders`,
        );
      }
    }
  });
});

describe('translate', () => {
  it('fills placeholders and leaves unknown ones alone', () => {
    const t = createTranslate('en', en, en);
    assert.equal(t('profile.level', { level: 4 }), 'Level 4');
    assert.equal(t('profile.level'), 'Level {level}');
  });

  it('falls back to English when a locale is missing a key', () => {
    const sparse: Record<string, string> = { ...en };
    delete sparse['common.save'];
    const t = createTranslate('de', sparse as never, en);
    assert.equal(t('common.save'), 'Save');
  });

  // French keeps the singular at zero; Chinese has one form for both.
  it('selects the plural form with the locale’s own rules', () => {
    assert.equal(createTranslate('en', en, en).plural('search.posts', 1), '1 post');
    assert.equal(createTranslate('en', en, en).plural('search.posts', 0), '0 posts');
    assert.equal(createTranslate('fr', fr, en).plural('search.posts', 0), '0 publication');
    assert.equal(createTranslate('fr', fr, en).plural('search.posts', 2), '2 publications');
    assert.equal(createTranslate('zh', zh, en).plural('search.posts', 5), '5 条帖子');
  });
});
