import 'server-only';

import { vercelAdapter } from '@flags-sdk/vercel';
import { flag } from 'flags/next';

export const freeCreditModelsOnly = flag({
  key: 'free-credit-models-only',
  adapter: vercelAdapter,
  defaultValue: true,
  description:
    'Restrict Creator Studio to models available to Vercel AI Gateway free-credit accounts.',
  options: [
    { value: true, label: 'Free-credit models only' },
    { value: false, label: 'All models' },
  ],
});
