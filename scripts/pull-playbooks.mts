import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const env = fs.readFileSync('.env.local','utf8');
for (const line of env.split('\n')) {
  const [k,...v] = line.split('=');
  if (k?.trim() && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g,'');
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {auth:{autoRefreshToken:false,persistSession:false}});
const { data, error } = await db.from('agent_mode_presets').select('*').order('name');
if (error) { console.error(error); process.exit(1); }
console.log(JSON.stringify(data, null, 2));
