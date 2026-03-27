import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import {
  decodeXmlEntities,
  extractXmlTagValue,
  getEsslConfig,
  postEsslSoap,
  soapEscape,
  wrapSoapEnvelope,
} from '../_shared/essl.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const parseMetadataObject = (value: unknown): Record<string, unknown> => {
  if (!value) return {}
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {}
    } catch {
      return {}
    }
  }

  return typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

const sanitizeCardNumber = (value: string) => value.replace(/\D/g, '').slice(0, 9)

const syncEmployeeToEssl = async (employeeCode: string, fullName: string, cardNumber: string) => {
  const config = getEsslConfig()
  const responseXml = await postEsslSoap(
    'AddEmployee',
    wrapSoapEnvelope(`    <AddEmployee xmlns="http://tempuri.org/">
      <APIKey>${soapEscape(config.apiKey)}</APIKey>
      <EmployeeCode>${soapEscape(employeeCode)}</EmployeeCode>
      <EmployeeName>${soapEscape(fullName)}</EmployeeName>
      <CardNumber>${soapEscape(cardNumber)}</CardNumber>
      <SerialNumber>${soapEscape(config.serialNumber)}</SerialNumber>
      <UserName>${soapEscape(config.userName)}</UserName>
      <UserPassword>${soapEscape(config.userPassword)}</UserPassword>
      <CommandId>1</CommandId>
    </AddEmployee>`),
  )

  const result = extractXmlTagValue(responseXml, 'AddEmployeeResult')
  return decodeXmlEntities(result || 'Employee synced successfully')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const callerRole = callerProfile?.role
    if (!callerRole || !['admin', 'super_admin', 'staff', 'head', 'front_office', 'sales_staff'].includes(callerRole)) {
      return new Response(JSON.stringify({ error: 'Forbidden: ESSL user sync is only available to staff users' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : ''
    const nfcId = typeof body?.nfcId === 'string' ? sanitizeCardNumber(body.nfcId) : ''

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!/^\d{9}$/.test(nfcId)) {
      return new Response(JSON.stringify({ error: 'A valid 9-digit nfcId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: targetProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, student_number, metadata')
      .eq('id', userId)
      .single()

    if (profileError || !targetProfile) {
      return new Response(JSON.stringify({ error: profileError?.message || 'Target user not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const metadata = parseMetadataObject(targetProfile.metadata)
    const employeeCodeCandidates = [
      typeof targetProfile.student_number === 'string' ? targetProfile.student_number.trim() : '',
      typeof metadata.essl_employee_code === 'string' ? metadata.essl_employee_code.trim() : '',
    ].filter(Boolean)

    const employeeCode = employeeCodeCandidates[0] || ''
    if (!employeeCode) {
      return new Response(JSON.stringify({ error: 'No ESSL employee code found for this user' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const fullName = typeof targetProfile.full_name === 'string' && targetProfile.full_name.trim()
      ? targetProfile.full_name.trim()
      : 'Unknown User'

    const resultMessage = await syncEmployeeToEssl(employeeCode, fullName, nfcId)

    return new Response(JSON.stringify({
      success: true,
      resultMessage,
      employeeCode,
      cardNumber: nfcId,
      fullName,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('ESSL user card sync failed:', error)
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown ESSL user card sync error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})