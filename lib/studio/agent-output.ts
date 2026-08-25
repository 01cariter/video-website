const EMOJI_PATTERN =
  /(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|(?:\p{Emoji_Presentation}|\p{Extended_Pictographic})\uFE0F?\p{Emoji_Modifier}?(?:\u200D(?:\p{Emoji_Presentation}|\p{Extended_Pictographic})\uFE0F?\p{Emoji_Modifier}?)*)/gu;

/** Removes emoji from Agent-authored content without changing user messages. */
export function stripStudioAgentEmoji(value: string) {
  return value.replace(EMOJI_PATTERN, '').replace(/[\u200D\uFE0F]/g, '');
}

export function cleanStudioAgentText(value: string | undefined) {
  if (value === undefined) return undefined;
  return stripStudioAgentEmoji(value).trim();
}
