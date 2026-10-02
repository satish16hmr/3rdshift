import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { charlieGenerate, charlieFailureHandler } from '@/lib/inngest/functions/charlie';
import { chainExecutorFunction } from '@/lib/inngest/functions/chain-executor';
import { taskExecutorFunction } from '@/lib/inngest/functions/task-executor';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [charlieGenerate, charlieFailureHandler, chainExecutorFunction, taskExecutorFunction],
});
