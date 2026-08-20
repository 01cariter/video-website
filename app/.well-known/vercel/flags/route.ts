import { getProviderData } from '@flags-sdk/vercel';
import { createFlagsDiscoveryEndpoint } from 'flags/next';
import {
  freeCreditModelsOnly,
  studioAgentModel,
  studioModelPolicy,
} from '@/flags';

export const GET = createFlagsDiscoveryEndpoint(() =>
  getProviderData({
    freeCreditModelsOnly,
    studioAgentModel,
    studioModelPolicy,
  }),
);
