// Supabase Edge Function: WhatsApp Webhook Handler
// Handles:
//   GET  → Meta webhook verification challenge (hub.challenge)
//   POST → Incoming delivery status updates / read receipts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // ── CORS preflight ──
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // ── GET: Meta webhook verification ──
  // Meta sends: GET ?hub.mode=subscribe&hub.verify_token=XXX&hub.challenge=YYY
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const mode      = url.searchParams.get('hub.mode')
    const token     = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    const verifyToken = Deno.env.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN')

    if (mode === 'subscribe' && token === verifyToken && challenge) {
      // Return the challenge PLAIN TEXT — Meta requires 200 + raw challenge
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    return new Response('Forbidden: invalid verify token', {
      status: 403,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  // ── POST: Incoming webhook events (delivery, read, reply) ──
  if (req.method === 'POST') {
    try {
      const body = await req.json()
      // Log for debugging in Supabase edge function logs
      console.log('WhatsApp webhook event:', JSON.stringify(body, null, 2))

      // You can extend this to save delivery logs, read receipts etc.
      // For now we just acknowledge receipt (Meta expects 200 quickly)
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch (_err) {
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  return new Response('Method not allowed', { status: 405 })
})
