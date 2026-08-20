import type { UIMessage } from 'ai';

export function withoutSkillResourceHistory(messages: UIMessage[]) {
  return messages.flatMap((message) => {
    const parts = message.parts.filter(
      (part) => part.type !== 'tool-readSkillResource',
    );
    return parts.length ? [{ ...message, parts } as UIMessage] : [];
  });
}
