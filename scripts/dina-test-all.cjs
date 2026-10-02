/**
 * Dina specialist rebuild — test all 8 meeting modes via transcript paste path (1 credit each)
 */
'use strict';

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://auth.3rdshift.ai';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.PROD_SVC_KEY;
if (!SUPABASE_KEY) throw new Error('Missing Supabase key env for SUPABASE_KEY');
const BASE_URL = 'https://3rdshift.ai';
const TODAY = new Date().toISOString().split('T')[0];
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// Realistic meeting transcripts per mode
const TRANSCRIPTS = {
  team_standup: `JR: Morning. Let's go around. What did everyone do yesterday, what are you on today, any blockers?
Shobrun: Yesterday I finished the Dex form mockups and sent them to Roger. Today I'm starting the Dina wireframes. No blockers.
Roger: Yesterday I shipped the Darcy improvements and ran the form field audit. Today I'm rebuilding Dina. No blockers from me.
JR: Good. I reviewed the Dex mockups — they look solid. One thing: the platform dropdown needs to default to Shopify not Etsy. Roger, can you fix that?
Roger: Done, I'll push it today.
JR: That's it from me. I'm finishing the CMO briefs for the F-Z workers this morning. Might need Shobrun for design input on Elliot's LinkedIn post types.
Shobrun: I'm available after 2pm.
JR: Good. Roger, where are we on the Charlie premium mode test?
Roger: Rate limit cleared at 5:19 UTC. Running it now. Should have results in the next 10 minutes.
JR: Ping me when it's done. That's the standup.`,

  one_on_one: `JR: Okay, let's do our 1:1. How are you feeling about the workload right now?
Roger: Honestly pretty good. The Inngest stuff was gnarly to debug but I got through it. The form field audit was satisfying — finding that clear-on-hide bug before launch saved us.
JR: Yeah, that was a good catch. What's blocking you right now?
Roger: Nothing major. The Dina transcript paste path needs testing once deployed. And I want to double-check that the 60-min cap is actually enforceable server-side given how Scribe handles the buffer.
JR: On the cap — I talked to FA. 89% margin holds as long as the cap is enforced. So yeah, make sure it's airtight.
Roger: Will do. On career stuff — I've been thinking about how to build better testing patterns for complex audio workers. The current purity harness works well but it's not quite right for audio.
JR: What would you need?
Roger: Mostly just a real audio file of a known meeting to test against. I can generate one if needed.
JR: I'll send you a recording from one of our old calls. Redacted. That works?
Roger: Perfect. My goal this week is getting through Tier 3 workers D through F before Friday.
JR: That's ambitious but doable if Duncan is clean. Let's check back Thursday.
Roger: Works for me.`,

  client_call: `BuildFlow CEO (Alex): Thanks for taking the time. We've been evaluating 3rdShift and I have some specific questions.
JR: Of course. What are you looking for?
Alex: Mainly automation. We have an ops team that writes a lot of SOPs and meeting notes. Can 3rdShift handle that at scale?
JR: Yes — we have Flynn for SOPs and Dina for meeting notes. Dina specifically can turn any recording into structured notes in about 60 seconds.
Alex: What's the turnaround on audio files?
JR: Typically 2-4 minutes for a full hour-long meeting.
Alex: And what does it cost?
JR: Pro plan includes 50 heavy credits per month. Dina audio is 2 credits per meeting. So you'd get about 25 meetings per month on Pro.
Alex: That's going to be a problem for us. We do about 80 meetings a week that we'd want notes on.
JR: Operator tier is 150 credits and we sell top-up packs. Let me run the math — 80 meetings × 2 credits = 160 credits/week, so you'd want a custom arrangement. I'll have our FA reach out.
Alex: That works. One more thing — do you have a SOC 2?
JR: Not yet. Timeline is Q3. Is that a blocker for you?
Alex: For procurement it will be. But I can start the evaluation now and finalize after.
JR: Perfect. I'll follow up with pricing and connect you with our FA team by EOD tomorrow.
Alex: Sounds good.`,

  strategy_session: `JR: Okay, the question on the table is whether to launch 3rdShift publicly in May or push to June. What are the arguments?
Shobrun: May gives us 3 more weeks of runway before Q3 spending cuts kick in. But the product isn't quite ready — we still have the F-Z worker rebuilds and the reliability audit is just finishing.
Roger: The platform is functional. The D-F rebuilds will be done this week. F-Z is maybe 3 more weeks. If we launch in May it's with the current worker quality on F-Z, not the rebuilt ones.
JR: What does that mean practically?
Roger: The F-Z workers will still work. They just won't have the specialist rebuild quality. Dex vs old Dex — old Dex still produced descriptions, just generic ones.
Shobrun: So we'd be launching with maybe 60% of workers at the new quality bar.
JR: Is that acceptable?
Roger: From a trust standpoint, borderline. From a crash risk standpoint, the platform is solid.
JR: Here's my take. May for a soft launch — invite-only founding members, founders we already have relationships with. June for public. That way we get real usage data on the rebuilt workers without exposing everyone to the older ones.
Shobrun: I like that. It also gives us time to build the notification bell and team updates features.
Roger: And I can get through more of the F-Z rebuilds.
JR: Decision: May soft launch, invite-only, 50 users max. June public launch with full press. Roger, you're the Driver on the platform readiness side. Shobrun, you're the Driver on design. I'm the Approver on launch date. We'll need marketing briefed before May — that's on me.
Roger: Got it. Should I start preparing a launch readiness checklist?
JR: Yes. Let's have that ready by next Monday.
Roger: Done.`,

  customer_discovery: `Interviewer (Roger): Thanks for making time. We're building 3rdShift and I want to understand how you currently handle meeting follow-ups. Can you walk me through what happens after a meeting ends?
Interviewee (Sarah, PM at 50-person SaaS): Sure. So I take notes during the meeting, usually in Notion. But honestly sometimes I don't — especially if the meeting is moving fast. Then after I try to piece together what happened from memory and my partial notes.
Roger: How long does that take you?
Sarah: Anywhere from 20 minutes to an hour. For a 60-minute strategy session it's basically like having the meeting twice.
Roger: What's the cost of getting it wrong?
Sarah: Huge. Last month we had a disconnect where I thought we'd agreed to delay a feature and the engineering lead thought we were still on schedule. Cost us a sprint.
Roger: Do you use any tools to help?
Sarah: I tried Otter but it doesn't understand our terminology. The transcripts are word-salad. I looked at Fathom but it's expensive for a small team. I mostly just suffer through it.
Roger: If you had a tool that could turn a recording into clean, structured notes with named action items, would you use it?
Sarah: Immediately. The action items thing is the key part. I don't need a transcript — I need to know who's doing what by when.
Roger: What would you pay for that?
Sarah: Honestly, less than I think it's worth. Maybe $30-50 a month? But if it actually saved an hour a week that's worth way more.
Roger: Last question — what would make you NOT use it?
Sarah: If I had to upload every file manually. And if the notes were generic. I need them to know the difference between a standup and a board meeting.`,

  sales_call: `SDR (Wilma at BuildFlow): Hi JR, thanks for the call. We've been evaluating 3rdShift and I have our VP of Ops, Marcus, joining today.
JR: Great. Marcus, good to have you.
Marcus: Thanks JR. I'll be direct — we're evaluating this against Jasper and a custom GPT setup we built internally. Why should we replace what we have?
JR: Your custom GPT gives you flexibility but no accountability. 3rdShift gives you 85 specialists optimized for specific tasks — each one tested, prompt-engineered, and QA'd. The meeting notes worker for example uses a structured DACI framework for decisions and SMART criteria for action items. Your GPT probably doesn't do that automatically.
Marcus: Fair. What's the pricing?
JR: Pro is $79/month, 50 heavy credits. Your volume sounds like Operator — $199/month, 150 credits. Enterprise is custom.
Marcus: That's per seat or flat?
JR: Flat per workspace. Everyone on your team uses one subscription.
Marcus: Interesting. Jasper is per seat, so you're cheaper for us once we go past 3 users.
JR: Exactly. And we're not a writing assistant — we're a workforce. Different value prop.
Marcus: Walk me through the meeting notes product specifically.
JR: Upload any recording, get DACI decisions, SMART action items, speaker attribution. Eight meeting types with different output structures. About 60 seconds for a 30-minute meeting.
Marcus: What's the 60-second claim based on?
JR: Actual production data. STT runs in about 30 seconds, Claude structures in another 30.
Marcus: We'll want to run a pilot. Can we get a 2-week trial?
JR: Absolutely. I'll set that up today. What's the best email for provisioning?
Marcus: marcus@buildflow.com. And one last thing — we'll need a Business Associate Agreement if we're putting meeting content through your system.
JR: We can do that. I'll loop in our legal contact.`,

  board_meeting: `JR: Thank you all for joining. Let's call the April board meeting to order. We have three agenda items: Q1 results, the May launch timeline, and the funding update.
Board member (Chen): Before we start, can we confirm everyone present? JR, Chen, Sarah from Sequoia, Michael.
JR: Confirmed. Sarah, you're joining remotely?
Sarah: Yes, I'm here.
JR: Q1 results. We ended Q1 with 12 paying customers, $23,400 ARR, $8,200 MRR. We projected $15K ARR so we're running ahead. Net revenue retention is 118%. Churn is zero — no customer has churned in Q1.
Chen: That NRR is impressive. What's driving it?
JR: Expansion revenue. Three customers upgraded from Pro to Operator in Q1.
Sarah: What's the average expansion time?
JR: About 45 days after signup.
Michael: That's a great signal. What does the pipeline look like?
JR: We have 8 qualified prospects, 3 in active evaluation. If all 3 close that's an additional $7,200 ARR.
Chen: Let's move to the launch timeline. JR, where are we?
JR: Soft launch May 15th, invite-only. Public launch June 1st. This was a decision we made internally last week based on platform readiness.
Sarah: Does the board need to vote on this or is it informational?
JR: Informational. It's within my authority.
Chen: I'd like to record a formal note of support. The soft-then-hard launch approach is the right call.
JR: Noted. Michael, funding?
Michael: We're tracking toward a $3M seed extension. Term sheet expected by end of April. The current round math works out to a $15M pre-money cap.
Chen: Any changes to terms from the previous discussion?
Michael: None material. We moved the pro-rata right threshold from $500K to $750K to accommodate the new investors.
Chen: Approved on my end.
Sarah: Same.
JR: Great. Any other business? None. Meeting adjourned at 3:47 PM.`,

  general: `JR: Okay let's get through this quickly. Three things. First, the Inngest Charlie rollout — Roger, status?
Roger: All 4 verification items passed. Signed email delivered, Sentry live, Inngest runs confirmed. 24h monitoring starts now.
JR: When does the monitoring window close?
Roger: 7 PM CT tonight.
JR: Good. Second thing — the Vercel failed deployment alerts. We've had 22 in the last 2 weeks. What's causing them?
Roger: Mostly the validator.ts errors in the dev types. They're pre-existing and don't block production, but they do show as CI failures. I need to either fix the validator or ignore those errors in CI.
JR: What's the cleanest fix?
Roger: Adding them to the ESLint ignore in the workflow. Takes 10 minutes.
JR: Do it today. Third thing — I need to send you the Dina FA margin confirmation. The short version is 2-credit audio tier is confirmed, 89% worst-case margin holds if you enforce the 60-min cap.
Roger: Already noted. Cap enforcement is in the build.
JR: That's it. Anything from you two?
Roger: One flag — the automatic rate limit on Charlie. Test accounts are hitting it during testing. I've been backdating tasks to clear it but it's a pain.
JR: Noted. I'll think about a test-account bypass flag.
Shobrun: I'm good. Just finishing the Dina wireframes.
JR: Ship it when ready. That's the meeting.`
};

async function runTest(name, meetingType, token, userId, workspaceId) {
  const transcript = TRANSCRIPTS[meetingType];
  const { data: task, error } = await sb.from('tasks').insert({
    user_id: userId, workspace_id: workspaceId,
    worker_slug: 'meeting-notes-writer', category: 'audio-voice',
    task_type: 'heavy', status: 'pending',
    input: {
      meeting_type: meetingType,
      transcript_paste: transcript,
      attendees: 'JR (CEO)\nRoger (Lead Developer)\nShobrun (Product Designer)',
      meeting_context: `Test: ${name}`,
    },
  }).select('id').single();
  if (error || !task) return { name, status: 'FAIL', error: error?.message };

  const res = await fetch(`${BASE_URL}/api/execute-task`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-workspace-id': workspaceId },
    body: JSON.stringify({ taskId: task.id }),
  });
  if (!res.ok) return { name, status: 'FAIL', error: `Execute ${res.status}` };

  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const { data } = await sb.from('tasks').select('status, output').eq('id', task.id).single();
    if (data?.status === 'completed' || data?.status === 'failed') {
      const text = data.output?.text || '';
      const BANNED = ['The team discussed', 'It was mentioned that', 'The meeting concluded', 'Various topics', 'In summary', 'Overall'];
      const bannedFound = BANNED.filter(b => text.includes(b));
      const hasDaci = meetingType === 'strategy_session' ? text.includes('Driver') || text.includes('Approver') : true;
      const hasActions = text.includes('Action Items') || text.includes('action item');
      return {
        name, taskId: task.id,
        status: data.status === 'completed' && bannedFound.length === 0 ? 'PASS' : 'FAIL',
        wordCount: text.split(/\s+/).filter(Boolean).length,
        hasDaci, hasActions,
        bannedFound,
        preview: text.substring(0, 150).replace(/\n/g, ' '),
      };
    }
  }
  return { name, status: 'TIMEOUT', taskId: task.id };
}

(async () => {
  const { data: signIn } = await sb.auth.signInWithPassword({ email: 'test-roger@3rdshift.ai', password: '<SCREENSHOT_TEST_PASSWORD>' });
  const token = signIn?.session?.access_token;
  const userId = signIn?.user?.id;
  const { data: member } = await sb.from('workspace_members').select('workspace_id').eq('user_id', userId).single();
  const workspaceId = member?.workspace_id;
  console.log('Auth OK\n');

  const tests = [
    ['Team Standup', 'team_standup'],
    ['1:1 Meeting', 'one_on_one'],
    ['Client Call', 'client_call'],
    ['Strategy Session', 'strategy_session'],
    ['Customer Discovery', 'customer_discovery'],
    ['Sales Call', 'sales_call'],
    ['Board Meeting', 'board_meeting'],
    ['General Meeting', 'general'],
  ];

  const results = [];
  // Run 3 at a time for speed
  for (let i = 0; i < tests.length; i += 3) {
    const batch = tests.slice(i, i + 3);
    process.stdout.write(`Running batch ${Math.floor(i/3)+1}: ${batch.map(t => t[0]).join(', ')}...\n`);
    const batchResults = await Promise.all(batch.map(([name, mode]) => runTest(name, mode, token, userId, workspaceId)));
    batchResults.forEach(r => {
      const icon = r.status === 'PASS' ? '✅' : '❌';
      console.log(`  ${icon} ${r.name}: ${r.wordCount || '?'} words | DACI: ${r.hasDaci ? '✅' : '❌'} | Actions: ${r.hasActions ? '✅' : '❌'}`);
      if (r.bannedFound?.length) console.log(`    ⚠️ Banned: ${r.bannedFound.join(', ')}`);
      if (r.preview) console.log(`    Preview: ${r.preview.substring(0, 80)}...`);
    });
    results.push(...batchResults);
    if (i + 3 < tests.length) await new Promise(r => setTimeout(r, 2000));
  }

  const passed = results.filter(r => r.status === 'PASS').length;
  console.log(`\n${'='.repeat(50)}\nDina Tests: ${passed}/${results.length} passed`);

  fs.writeFileSync(path.join(__dirname, `dina-test-results-${TODAY}.json`), JSON.stringify({ date: TODAY, results, passed, total: results.length }, null, 2));
  console.log(`Results saved.`);
})();
