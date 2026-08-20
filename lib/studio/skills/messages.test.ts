import assert from 'node:assert/strict';
import test from 'node:test';
import type { UIMessage } from 'ai';
import { withoutSkillResourceHistory } from './messages';

test('removes persisted Skill tool calls before the next model request', () => {
  const messages = [
    {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'tool-readSkillResource',
          toolCallId: 'skill-1',
          state: 'output-available',
          input: {
            skillId: 'one-line-story-to-script',
            resource: 'SKILL.md',
          },
          output: { loaded: true, characters: 10_000 },
        },
      ],
    },
    {
      id: 'assistant-2',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Done.' }],
    },
  ] as UIMessage[];

  assert.deepEqual(withoutSkillResourceHistory(messages), [messages[1]]);
});
