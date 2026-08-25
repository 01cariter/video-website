export async function runIdempotentWebhookEvent<T>(input: {
  event: T;
  eventId: string;
  hasProcessed: (eventId: string) => Promise<boolean>;
  process: (event: T) => Promise<void>;
  record: (event: T) => Promise<void>;
}): Promise<'processed' | 'duplicate'> {
  if (await input.hasProcessed(input.eventId)) return 'duplicate';
  await input.process(input.event);
  await input.record(input.event);
  return 'processed';
}
