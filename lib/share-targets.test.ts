import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  SHARE_TARGETS,
  postShareUrl,
  shareDownloadName,
  shareTitle,
} from './share-targets';

const payload = {
  url: 'https://snackd.example/videos/12',
  title: 'Fox & friends: a "study" clip',
};

describe('share intents', () => {
  it('escapes the url and the title into every intent', () => {
    for (const target of SHARE_TARGETS) {
      const href = target.href(payload);
      assert.ok(
        href.includes(encodeURIComponent(payload.url)),
        `${target.id} should carry the encoded url`,
      );
      assert.ok(
        !href.includes(' ') && !href.includes('"'),
        `${target.id} should not leave raw characters in the query`,
      );
    }
  });

  it('points at each platform’s documented intent', () => {
    const byId = Object.fromEntries(
      SHARE_TARGETS.map((target) => [target.id, target.href(payload)]),
    );
    assert.match(byId.x, /^https:\/\/x\.com\/intent\/post\?/);
    assert.match(byId.facebook, /^https:\/\/www\.facebook\.com\/sharer\//);
    assert.match(byId.linkedin, /^https:\/\/www\.linkedin\.com\/sharing\//);
    assert.match(byId.reddit, /^https:\/\/www\.reddit\.com\/submit\?/);
    assert.match(byId.telegram, /^https:\/\/t\.me\/share\/url\?/);
    assert.match(byId.whatsapp, /^https:\/\/wa\.me\/\?text=/);
    assert.match(byId.weibo, /^https:\/\/service\.weibo\.com\/share\//);
    assert.match(byId.email, /^mailto:\?subject=/);
  });
});

describe('share title', () => {
  it('prefers the title and falls back to the body', () => {
    assert.equal(shareTitle({ title: 'A clip', description: 'body' }), 'A clip');
    assert.equal(shareTitle({ title: '  ', description: 'body' }), 'body');
    assert.equal(shareTitle({}), 'A post on Snackd');
  });

  it('collapses whitespace and truncates', () => {
    assert.equal(shareTitle({ title: 'a\n\n  b' }), 'a b');
    const long = shareTitle({ title: 'x'.repeat(200) });
    assert.equal(long.length, 120);
    assert.ok(long.endsWith('…'));
  });
});

describe('share url and download name', () => {
  it('builds an absolute post url without doubling the slash', () => {
    assert.equal(
      postShareUrl('https://snackd.example/', 12),
      'https://snackd.example/videos/12',
    );
  });

  it('names the file after the post and keeps a plausible extension', () => {
    assert.equal(
      shareDownloadName('Fox & friends!', 'https://cdn.example/a/b.webm?token=1'),
      'fox-friends.webm',
    );
    assert.equal(
      shareDownloadName('', 'https://cdn.example/a/b'),
      'snackd-post.mp4',
    );
  });
});
