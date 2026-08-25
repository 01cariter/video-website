import { getProviderData } from '@flags-sdk/vercel';
import { createFlagsDiscoveryEndpoint } from 'flags/next';
import { studioAgentModel, studioModelPolicy } from '@/flags';

export const GET = createFlagsDiscoveryEndpoint(() =>
  getProviderData({
    studioAgentModel,
    studioModelPolicy,
  }),
);
