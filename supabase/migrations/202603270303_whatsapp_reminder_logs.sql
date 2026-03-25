-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: WhatsApp reminder logs + pg_cron daily auto-fee-reminder schedule
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Enable pg_cron and pg_net extensions (required for scheduled calls) ──
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- ── 2. Create reminder logs table ──
create table if not exists public.whatsapp_reminder_logs (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.profiles(id) on delete cascade,
  payment_id    uuid,
  template_key  text not null,
  phone         text not null,
  sent_at       timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- Indexes for fast dedup checks
create index if not exists idx_wa_reminder_logs_payment   on public.whatsapp_reminder_logs(payment_id);
create index if not exists idx_wa_reminder_logs_student   on public.whatsapp_reminder_logs(student_id);
create index if not exists idx_wa_reminder_logs_sent_at   on public.whatsapp_reminder_logs(sent_at);
create index if not exists idx_wa_reminder_logs_template  on public.whatsapp_reminder_logs(template_key);

-- ── 3. Row Level Security ──
alter table public.whatsapp_reminder_logs enable row level security;

-- Only service role can read/write reminder logs (edge functions use service role)
create policy "service_role_full_access_reminder_logs"
  on public.whatsapp_reminder_logs
  as permissive
  for all
  to service_role
  using (true)
  with check (true);

-- Admins can read their org's logs
create policy "admin_read_reminder_logs"
  on public.whatsapp_reminder_logs
  as permissive
  for select
  to authenticated
  using (
    student_id in (
      select id from public.profiles
      where organization_id = (
        select organization_id from public.profiles where id = auth.uid()
      )
    )
  );

-- ── 4. Schedule daily cron job at 9:00 AM IST (3:30 AM UTC) ──
-- Calls the auto-fee-reminder edge function every day
-- Replace YOUR_SUPABASE_PROJECT_REF with your actual project ref: jdbxqjanhjifafjukdzd
-- Replace YOUR_SERVICE_ROLE_KEY with your actual service role key (from Supabase dashboard)
--
-- NOTE: If pg_cron/pg_net is not available on your plan, use an external cron
-- (e.g. GitHub Actions, Render cron, or any HTTP scheduler) to call this URL:
--   POST https://jdbxqjanhjifafjukdzd.supabase.co/functions/v1/auto-fee-reminder
--   Header: Authorization: Bearer <service_role_key>
--
select
  cron.schedule(
    'auto-fee-reminder-daily',       -- job name (unique)
    '30 3 * * *',                    -- every day at 03:30 UTC = 09:00 AM IST
    $$
    select net.http_post(
      url     := 'https://jdbxqjanhjifafjukdzd.supabase.co/functions/v1/auto-fee-reminder',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body    := '{}'::jsonb
    )
    $$
  );
