import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: '3rdshift',
  eventKey: process.env.INNGEST_EVENT_KEY,
});
