export function friendlyAiError(message: string) {
  if (/No authentication provided|authentication failed/i.test(message)) {
    return '未配置 Vercel AI Gateway。请在 .env.local 设置 AI_GATEWAY_API_KEY。';
  }
  return message;
}
