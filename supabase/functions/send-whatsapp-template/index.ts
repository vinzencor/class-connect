// ─── Wabis WhatsApp Template Sender ───────────────────────────────────────
// Sends template messages via Wabis (https://bot.wabis.in).
// Required Supabase secrets:
//   WABIS_API_TOKEN, WABIS_PHONE_NUMBER_ID,
//   WABIS_TEMPLATE_FEE_REMINDER, WABIS_TEMPLATE_FEE_RECEIPT,
//   WABIS_TEMPLATE_ATTENDANCE_REMINDER, WABIS_TEMPLATE_LEAVE_REMINDER

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type TemplateKey =
	| 'fee_reminder'
	| 'fee_receipt'
	| 'attendance_reminder'
	| 'leave_reminder'

const TEMPLATE_ENV_MAP: Record<TemplateKey, string> = {
	fee_reminder: 'WABIS_TEMPLATE_FEE_REMINDER',
	fee_receipt: 'WABIS_TEMPLATE_FEE_RECEIPT',
	attendance_reminder: 'WABIS_TEMPLATE_ATTENDANCE_REMINDER',
	leave_reminder: 'WABIS_TEMPLATE_LEAVE_REMINDER',
}

const WABIS_TEMPLATE_URL = 'https://bot.wabis.in/api/v1/whatsapp/send/template'
const WABIS_TEXT_URL = 'https://bot.wabis.in/api/v1/whatsapp/send'

function normalizePhoneNumber(value: string): string {
	let phone = String(value || '').replace(/\D/g, '')
	// Auto-prefix Indian country code for 10-digit numbers
	if (phone.length === 10) phone = '91' + phone
	return phone
}

serve(async (req) => {
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders })
	}

	try {
		const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
		const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

		if (!supabaseUrl || !serviceRoleKey) {
			return new Response(
				JSON.stringify({ error: 'Server configuration missing' }),
				{ status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
			)
		}

		const supabaseAdmin = createClient(
			supabaseUrl,
			serviceRoleKey,
			{ auth: { autoRefreshToken: false, persistSession: false } }
		)

		const {
			to,
			templateKey,
			bodyParams = [],
			// Optional: for plain-text messages instead of templates
			plainText,
		}: {
			to: string
			templateKey?: TemplateKey
			bodyParams?: string[]
			plainText?: string
		} = await req.json()

		// ── Auth check ──────────────────────────────────────────────────
		const authHeader = req.headers.get('Authorization')
		const token = authHeader?.startsWith('Bearer ')
			? authHeader.replace('Bearer ', '')
			: ''

		if (!token) {
			return new Response(
				JSON.stringify({ error: 'Unauthorized: Missing token' }),
				{ status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
			)
		}

		const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
		if (authError || !user) {
			return new Response(
				JSON.stringify({ error: 'Unauthorized: Invalid token' }),
				{ status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
			)
		}

		const { data: profile } = await supabaseAdmin
			.from('profiles')
			.select('role')
			.eq('id', user.id)
			.maybeSingle()

		if (!profile || !['admin', 'sales_staff'].includes(profile.role)) {
			return new Response(
				JSON.stringify({ error: 'Forbidden: Admin or Sales Staff access required' }),
				{ status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
			)
		}

		// ── Input validation ────────────────────────────────────────────
		if (!to || (!templateKey && !plainText)) {
			return new Response(
				JSON.stringify({ error: 'Missing required fields: to, and either templateKey or plainText' }),
				{ status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
			)
		}

		const normalizedTo = normalizePhoneNumber(to)
		if (!normalizedTo) {
			return new Response(
				JSON.stringify({ error: 'Invalid recipient phone number' }),
				{ status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
			)
		}

		// ── Wabis credentials ───────────────────────────────────────────
		const apiToken = Deno.env.get('WABIS_API_TOKEN')
		const phoneNumberId = Deno.env.get('WABIS_PHONE_NUMBER_ID')

		if (!apiToken || !phoneNumberId) {
			return new Response(
				JSON.stringify({ error: 'Missing Wabis server secrets (WABIS_API_TOKEN / WABIS_PHONE_NUMBER_ID)' }),
				{ status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
			)
		}

		let response: Response

		if (plainText) {
			// ── Plain-text message via Wabis ────────────────────────────
			const form = new URLSearchParams()
			form.append('apiToken', apiToken)
			form.append('phoneNumberID', phoneNumberId)
			form.append('to', normalizedTo)
			form.append('message', plainText)

			response = await fetch(WABIS_TEXT_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: form.toString(),
			})
		} else {
			// ── Template message via Wabis ──────────────────────────────
			const templateEnvKey = TEMPLATE_ENV_MAP[templateKey!]
			const botTemplateID = Deno.env.get(templateEnvKey)

			if (!botTemplateID) {
				return new Response(
					JSON.stringify({ error: `Missing template configuration: ${templateEnvKey}` }),
					{ status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
				)
			}

			const form = new URLSearchParams()
			form.append('apiToken', apiToken)
			form.append('phoneNumberID', phoneNumberId)
			form.append('to', normalizedTo)
			form.append('botTemplateID', botTemplateID)

			// Map bodyParams to Wabis templateVariable pattern:
			// templateVariable-variable1-1, templateVariable-variable2-2, ...
			bodyParams.forEach((value, idx) => {
				const n = idx + 1
				form.append(`templateVariable-variable${n}-${n}`, String(value ?? ''))
			})

			response = await fetch(WABIS_TEMPLATE_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: form.toString(),
			})
		}

		const result = await response.json()

		// Wabis returns { status: "1", ... } on success
		if (result.status !== '1' && result.status !== 1) {
			console.error('Wabis API error:', JSON.stringify(result))
			return new Response(
				JSON.stringify({ error: result.message || result.error || 'Wabis API error', details: result }),
				{ status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
			)
		}

		return new Response(
			JSON.stringify({ success: true, data: result }),
			{ status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
		)
	} catch (error) {
		console.error('send-whatsapp-template error:', error)
		return new Response(
			JSON.stringify({ error: error instanceof Error ? error.message : 'Unexpected error' }),
			{ status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
		)
	}
})
