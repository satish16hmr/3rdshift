require('dotenv').config({ path: '.env.local' });
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const email = 'eatwellfed@gmail.com';

(async () => {
  const customers = await stripe.customers.list({ email, limit: 10 });
  console.log('Stripe customers:', customers.data.map(c => ({ id: c.id, email: c.email, created: c.created })));
  for (const c of customers.data) {
    const subs = await stripe.subscriptions.list({ customer: c.id, status: 'all', limit: 20, expand: ['data.items.data.price', 'data.latest_invoice'] });
    console.log('Subscriptions for', c.id, subs.data.map(s => ({
      id: s.id,
      status: s.status,
      cancel_at_period_end: s.cancel_at_period_end,
      current_period_start: new Date((s.current_period_start || s.items.data[0]?.current_period_start || 0) * 1000).toISOString(),
      current_period_end: new Date((s.current_period_end || s.items.data[0]?.current_period_end || 0) * 1000).toISOString(),
      price: s.items.data[0]?.price?.id,
      product: s.items.data[0]?.price?.product,
      amount: s.items.data[0]?.price?.unit_amount,
      interval: s.items.data[0]?.price?.recurring?.interval,
      latest_invoice: typeof s.latest_invoice === 'string' ? s.latest_invoice : s.latest_invoice?.id,
      latest_invoice_total: typeof s.latest_invoice === 'object' ? s.latest_invoice?.total : undefined,
      latest_invoice_charge: typeof s.latest_invoice === 'object' ? s.latest_invoice?.charge : undefined,
      created: new Date(s.created * 1000).toISOString(),
    })));
    const invoices = await stripe.invoices.list({ customer: c.id, limit: 20, expand: ['data.charge', 'data.lines.data.price'] });
    console.log('Recent invoices for', c.id, invoices.data.map(inv => ({
      id: inv.id,
      subscription: inv.subscription || inv.parent?.subscription_details?.subscription || null,
      status: inv.status,
      billing_reason: inv.billing_reason,
      total: inv.total,
      amount_paid: inv.amount_paid,
      created: new Date(inv.created * 1000).toISOString(),
      charge: typeof inv.charge === 'string' ? inv.charge : inv.charge?.id,
      refunded: typeof inv.charge === 'object' ? inv.charge?.refunded : undefined,
      lines: inv.lines.data.map(l => ({ amount: l.amount, price: l.price?.id, product: l.price?.product, period: l.period }))
    })));
  }

  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (authError) throw authError;
  const user = authUsers.users.find(u => u.email === email);
  console.log('Auth user:', user ? { id: user.id, email: user.email, created_at: user.created_at } : null);
  if (user) {
    const { data: profile, error: profileError } = await supabase.from('profiles').select('id,email,plan,billing_status,billing_cycle,stripe_customer_id,stripe_subscription_id,heavy_credits_remaining,heavy_credits_reset_at').eq('id', user.id).maybeSingle();
    if (profileError) throw profileError;
    console.log('Profile:', profile);
    const { data: workspaces, error: wsError } = await supabase.from('workspaces').select('id,name,plan,owner_id,heavy_credits_limit,light_tasks_limit,max_seats').eq('owner_id', user.id);
    if (wsError) throw wsError;
    console.log('Workspaces:', workspaces);
    const { data: topups, error: topupError } = await supabase.from('credit_topups').select('id,credits_purchased,credits_remaining,price_paid,stripe_payment_id,created_at').eq('user_id', user.id).gt('credits_remaining', 0);
    if (topupError) throw topupError;
    console.log('Active topups:', topups);
    const { data: grants, error: grantsError } = await supabase.from('plan_credit_grants').select('id,stripe_subscription_id,stripe_period_start,stripe_period_end,plan,granted_credits,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10);
    if (grantsError) throw grantsError;
    console.log('Recent plan grants:', grants);
  }
})().catch(err => { console.error(err); process.exit(1); });
