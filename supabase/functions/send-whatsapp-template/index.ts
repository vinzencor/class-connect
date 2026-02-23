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
	fee_reminder: 'WHATSAPP_TEMPLATE_FEE_REMINDER',
	fee_receipt: 'WHATSAPP_TEMPLATE_FEE_RECEIPT',
	attendance_reminder: 'WHATSAPP_TEMPLATE_ATTENDANCE_REMINDER',
	leave_reminder: 'WHATSAPP_TEMPLATE_LEAVE_REMINDER',
}

function normalizePhoneNumber(value: string): string {
	return String(value || '').replace(/\D/g, '')
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
			languageCode = 'en',
		}: {
			to: string
			templateKey: TemplateKey
			bodyParams?: string[]
			languageCode?: string
		} = await req.json()

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

		if (!to || !templateKey) {
			return new Response(
				JSON.stringify({ error: 'Missing required fields: to, templateKey' }),
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

		const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
		const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
		const graphVersion = Deno.env.get('WHATSAPP_GRAPH_VERSION') || 'v22.0'

		if (!accessToken || !phoneNumberId) {
			return new Response(
				JSON.stringify({ error: 'Missing WhatsApp server secrets' }),
				{ status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
			)
		}

		const templateEnvKey = TEMPLATE_ENV_MAP[templateKey]
		const templateName = Deno.env.get(templateEnvKey)

		if (!templateName) {
			return new Response(
				JSON.stringify({ error: `Missing template configuration: ${templateEnvKey}` }),
				{ status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
			)
		}

		const payload = {
			messaging_product: 'whatsapp',
			to: normalizedTo,
			type: 'template',
			template: {
				name: templateName,
				language: { code: languageCode },
				components: [
					{
						type: 'body',
						parameters: bodyParams.map((value) => ({ type: 'text', text: String(value ?? '') })),
					},
				],
			},
		}

		const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload),
		})

		const result = await response.json()

		if (!response.ok) {
			return new Response(
				JSON.stringify({ error: result }),
				{ status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
			)
		}

		return new Response(
			JSON.stringify({ success: true, data: result }),
			{ status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
		)
	} catch (error) {
		return new Response(
			JSON.stringify({ error: error instanceof Error ? error.message : 'Unexpected error' }),
			{ status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
		)
	}
})
