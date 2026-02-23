// Supabase Edge Function: Auto Fee Reminder
// Runs on a daily schedule via pg_cron — sends WhatsApp fee reminders to students
// whose payment is overdue or due within the next 3 days, without duplicate sends.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function normalizePhone(value: string): string {
  return String(value || '').replace(/\D/g, '')
}

async function sendWhatsAppTemplate(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  templateName: string,
  bodyParams: string[],
  graphVersion = 'v22.0'
) {
  const res = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: bodyParams.map((v) => ({ type: 'text', text: String(v ?? '') })),
          },
        ],
      },
    }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(JSON.stringify(data))
  return data
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
    const templateName = Deno.env.get('WHATSAPP_TEMPLATE_FEE_REMINDER')
    const graphVersion = Deno.env.get('WHATSAPP_GRAPH_VERSION') || 'v22.0'

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase server config' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!accessToken || !phoneNumberId || !templateName) {
      return new Response(JSON.stringify({ error: 'Missing WhatsApp server secrets' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // ── 1. Find all enrollments with pending/partial fee and due date coming ──
    const today = new Date()
    const cutoff = new Date(today)
    cutoff.setDate(cutoff.getDate() + 3)

    // Fetch payments with remaining fee and due_date <= cutoff
    const { data: pendingPayments, error: payError } = await supabase
      .from('payments')
      .select(`
        id,
        student_id,
        student_name,
        course_name,
        amount,
        amount_paid,
        due_date,
        status
      `)
      .in('status', ['pending', 'partial'])
      .lte('due_date', cutoff.toISOString().split('T')[0])
      .not('due_date', 'is', null)

    if (payError) throw payError

    if (!pendingPayments || pendingPayments.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: 'No pending reminders' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── 2. Fetch phone numbers for these students ──
    const studentIds = [...new Set(pendingPayments.map((p: any) => p.student_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, phone, full_name')
      .in('id', studentIds)

    const phoneMap: Record<string, string> = {}
    ;(profiles || []).forEach((p: any) => {
      if (p.phone) phoneMap[p.id] = p.phone
    })

    // ── 3. Check which ones already got a reminder in the last 24 hours ──
    const now24hAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: recentLogs } = await supabase
      .from('whatsapp_reminder_logs')
      .select('payment_id')
      .eq('template_key', 'fee_reminder')
      .gte('sent_at', now24hAgo)

    const recentlySent = new Set((recentLogs || []).map((l: any) => l.payment_id))

    // ── 4. Send reminders ──
    const results: { payment_id: string; success: boolean; error?: string }[] = []

    for (const pay of pendingPayments as any[]) {
      if (recentlySent.has(pay.id)) continue

      const phone = phoneMap[pay.student_id]
      if (!phone) continue

      const normalizedPhone = normalizePhone(phone)
      if (!normalizedPhone) continue

      const remaining = Math.max(Number(pay.amount) - Number(pay.amount_paid || 0), 0)
      if (remaining <= 0) continue

      const dueDateStr = pay.due_date
        ? new Date(pay.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : '-'

      try {
        await sendWhatsAppTemplate(
          phoneNumberId,
          accessToken,
          normalizedPhone,
          templateName,
          [
            pay.student_name || 'Student',
            pay.course_name || 'Course',
            String(remaining),
            dueDateStr,
          ],
          graphVersion
        )

        // Log the successful send
        await supabase.from('whatsapp_reminder_logs').insert({
          student_id: pay.student_id,
          payment_id: pay.id,
          template_key: 'fee_reminder',
          sent_at: new Date().toISOString(),
          phone: normalizedPhone,
        })

        results.push({ payment_id: pay.id, success: true })
      } catch (err: any) {
        console.error(`Failed to send reminder for payment ${pay.id}:`, err.message)
        results.push({ payment_id: pay.id, success: false, error: err.message })
      }
    }

    const sentCount = results.filter((r) => r.success).length
    const failCount = results.filter((r) => !r.success).length

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, failed: failCount, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('auto-fee-reminder error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
