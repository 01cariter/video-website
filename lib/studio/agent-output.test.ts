import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cleanStudioAgentText,
  stripStudioAgentEmoji,
} from './agent-output';

test('removes standalone and joined emoji from Agent-authored text', () => {
  const value = stripStudioAgentEmoji(
    'Storyboard 🎬 with light ✨, one 1️⃣ flag 🇨🇳 and a creator 👩🏽‍🎨.',
  );

  assert.equal(
    value,
    'Storyboard  with light , one  flag  and a creator .',
  );
});

test('keeps Markdown and ordinary symbols intact', () => {
  assert.equal(
    cleanStudioAgentText('  **Plan**\n\n- Shot 1 → Shot 2  '),
    '**Plan**\n\n- Shot 1 → Shot 2',
  );
});
