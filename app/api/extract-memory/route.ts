export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/api-auth';
import { callAI } from '@/lib/ai/callAI';
import { verifyInternalSecret } from '@/lib/security';

// Use service role for background memory extraction (internal server-to-server only)
const MEMORY_EXTRACTION_PROMPT = `Analyze this completed task and extract any reusable information about the client's preferences. Only extract concrete, specific details — not vague observations.

TASK INPUT:
{task_input}

TASK OUTPUT:
{task_output}

Extract into these categories (return null for any category with nothing new to learn):

{
  "brand_voice": "Specific writing style observations — tone, vocabulary, sentence structure preferences. Example: 'Prefers casual/witty tone, uses contractions, likes short punchy sentences, avoids corporate jargon'",
  "preferences": "Format and structure preferences — length, formatting, recurring instructions. Example: 'Always wants 3 variations, prefers bullet points over paragraphs, likes headers in questions'",
  "context": "Business facts — company name, industry, product details, target audience, competitors. Example: 'Runs a SaaS startup called Acme, targets SMB owners, competes with HubSpot and Salesforce'"
}

Rules:
- Only extract NEW information not already covered in existing memory
- Keep each field under 200 characters
- Be specific and actionable, not vague
- If nothing new to learn from this task, return all null values
- Return ONLY valid JSON, no preamble`;

const MAX_MEMORY_CHARS = 2000;

export async function POST(request: NextRequest) {
  // Gate: only internal server calls are allowed (execute-task fires this)
  if (!verifyInternalSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { userId, workspaceId, workerSlug, taskInput, taskOutput } = await request.json();

    if (!userId || !workerSlug || !taskInput || !taskOutput) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Interpolate task data into the prompt
    const taskInputStr = JSON.stringify(taskInput, null, 2);
    const taskOutputStr = typeof taskOutput === 'string' ? taskOutput.slice(0, 1000) : JSON.stringify(taskOutput).slice(0, 1000);
    const interpolatedPrompt = MEMORY_EXTRACTION_PROMPT
      .replace('{task_input}', taskInputStr)
      .replace('{task_output}', taskOutputStr);

    // Call AI for memory extraction (haiku tier — lightweight task)
    const aiResponse = await callAI({
      model_tier: 'haiku',
      system: 'You are a memory extraction system. Return only valid JSON.',
      messages: [{ role: 'user', content: interpolatedPrompt }],
      max_tokens: 512,
    });

    const responseText = aiResponse.content || '{}';

    let extracted: { brand_voice: string | null; preferences: string | null; context: string | null };
    try {
      // Extract JSON from response (handle code blocks)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      extracted = jsonMatch ? JSON.parse(jsonMatch[0]) : { brand_voice: null, preferences: null, context: null };
    } catch {
      console.error('Failed to parse memory extraction response:', responseText);
      return NextResponse.json({ success: false, message: 'Parse error' });
    }

    // Upsert non-null memory values
    const memoryTypes: Array<'brand_voice' | 'preferences' | 'context'> = ['brand_voice', 'preferences', 'context'];
    const upsertResults: string[] = [];

    for (const memoryType of memoryTypes) {
      const newContent = extracted[memoryType];
      if (!newContent) continue;

      // Fetch existing memory entry (workspace-scoped if available, else user-scoped)
      const memQuery = supabaseAdmin
        .from('worker_memory')
        .select('id, content')
        .eq('worker_slug', workerSlug)
        .eq('memory_type', memoryType);
      if (workspaceId) memQuery.eq('workspace_id', workspaceId);
      else memQuery.eq('user_id', userId);
      const { data: existing } = await memQuery.single();

      if (existing) {
        // Append to existing content, enforcing max chars
        const separator = '\n---\n';
        const combined = existing.content + separator + newContent;
        const truncated = combined.length > MAX_MEMORY_CHARS
          ? combined.slice(combined.length - MAX_MEMORY_CHARS)
          : combined;

        await supabaseAdmin
          .from('worker_memory')
          .update({
            content: truncated,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        // Insert new memory entry
        const truncated = newContent.slice(0, MAX_MEMORY_CHARS);
        await supabaseAdmin
          .from('worker_memory')
          .insert({
            user_id: userId,
            workspace_id: workspaceId || null,
            worker_slug: workerSlug,
            memory_type: memoryType,
            content: truncated,
          });
      }

      upsertResults.push(memoryType);
    }

    return NextResponse.json({
      success: true,
      extracted: upsertResults,
      hasMemory: upsertResults.length > 0,
    });
  } catch (error: unknown) {
    console.error('Memory extraction error:', error);
    const msg = error instanceof Error ? error.message : 'Memory extraction failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
