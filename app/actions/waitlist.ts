'use server';

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function joinWaitlist(email: string, source: string = 'homepage') {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes('@')) {
    return { success: false, message: 'Please enter a valid email.' };
  }

  const { error } = await supabase
    .from('waitlist')
    .insert([{ email: trimmed, source }]);

  if (error) {
    if (error.code === '23505') {
      return { success: true, message: "You're already on the list!" };
    }
    console.error('Waitlist insert error:', error);
    return { success: false, message: 'Something went wrong. Try again.' };
  }

  return { success: true, message: "You're in — we'll be in touch soon." };
}
