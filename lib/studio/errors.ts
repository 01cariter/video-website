export function friendlyAiError(message: string) {
  if (/No authentication provided|authentication failed/i.test(message)) {
    return 'Vercel AI Gateway is not configured. Set AI_GATEWAY_API_KEY in .env.local.';
  }
  return message;
}
