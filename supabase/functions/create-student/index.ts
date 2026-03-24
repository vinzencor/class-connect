// Supabase Edge Function to create users (students/faculty) with auto-confirmation
// Uses service_role key so the trigger doesn't block user creation and keeps the ESSL sync server-side.

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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const parseMetadataObject = (value: unknown): Record<string, unknown> => {
  if (!value) return {}
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }

  return typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

const reserveEmployeeNumber = async (supabaseAdmin: ReturnType<typeof createClient>, organizationId: string) => {
  // Try using the dedicated next_employee_number counter (requires migration 20260323)
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: organization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('next_employee_number')
      .eq('id', organizationId)
      .single()

    // If the column doesn't exist yet, fall back to count-based derivation
    if (orgError?.message?.includes('column') || orgError?.message?.includes('next_employee_number')) {
      break
    }

    if (orgError || !organization) {
      throw new Error(orgError?.message || 'Organization not found for employee number generation')
    }

    const nextNumber = Math.max(Number(organization.next_employee_number ?? 101), 101)
    const employeeCode = String(nextNumber)

    const { data: updatedOrg, error: updateError } = await supabaseAdmin
      .from('organizations')
      .update({ next_employee_number: nextNumber + 1 })
      .eq('id', organizationId)
      .eq('next_employee_number', nextNumber)
      .select('id')
      .maybeSingle()

    if (updateError) {
      throw new Error(updateError.message)
    }

    if (updatedOrg?.id) {
      return employeeCode
    }
  }

  // Fallback: count existing non-student profiles to derive the next number
  const { count } = await supabaseAdmin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .neq('role', 'student')

  return String(Math.max(101, (count ?? 0) + 101))
}

const sanitizeCardNumber = (value: string) => value.replace(/\D/g, '').slice(0, 9)

const generateNineDigitCardNumber = () => String(Math.floor(100000000 + Math.random() * 900000000))

const reserveCardNumber = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  requestedValue?: string | null,
) => {
  const candidatePool = requestedValue?.trim()
    ? [sanitizeCardNumber(requestedValue)]
    : []

  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = candidatePool[attempt] || generateNineDigitCardNumber()
    if (!/^\d{9}$/.test(candidate)) {
      continue
    }

    const { data: profileMatch, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('nfc_id', candidate)
      .maybeSingle()

    if (profileError) {
      throw new Error(`Failed to validate generated card number: ${profileError.message}`)
    }

    if (!profileMatch) {
      return candidate
    }
  }

  throw new Error('Failed to generate a unique 9-digit card number')
}

const reserveStudentNumber = async (supabaseAdmin: ReturnType<typeof createClient>, organizationId: string) => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: organization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('name, next_student_number')
      .eq('id', organizationId)
      .single()

    if (orgError || !organization) {
      throw new Error(orgError?.message || 'Organization not found for student number generation')
    }

    const prefix = (organization.name || 'ORG')
      .replace(/[^A-Za-z]/g, '')
      .slice(0, 3)
      .toUpperCase() || 'STU'
    const nextNumber = Number(organization.next_student_number ?? 1)
    const studentNumber = `${prefix}-${String(nextNumber).padStart(4, '0')}`

    const { data: updatedOrg, error: updateError } = await supabaseAdmin
      .from('organizations')
      .update({ next_student_number: nextNumber + 1 })
      .eq('id', organizationId)
      .eq('next_student_number', nextNumber)
      .select('id')
      .maybeSingle()

    if (updateError) {
      throw new Error(updateError.message)
    }

    if (updatedOrg?.id) {
      return studentNumber
    }
  }

  throw new Error('Failed to reserve a unique student number after multiple attempts')
}

const assignStudentNumber = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  profileId: string,
  organizationId: string,
  currentProfile?: Record<string, unknown> | null,
) => {
  const existingValue = currentProfile?.student_number
  if (typeof existingValue === 'string' && existingValue.trim()) {
    return existingValue.trim()
  }

  const studentNumber = await reserveStudentNumber(supabaseAdmin, organizationId)
  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ student_number: studentNumber })
    .eq('id', profileId)

  if (updateError) {
    throw new Error(`Failed to assign student number: ${updateError.message}`)
  }

  return studentNumber
}

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

const ensureProfile = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  input: {
    userId: string
    email: string
    fullName: string
    role: string
    roleId?: string | null
    organizationId: string
    branchId: string | null
    metadata: Record<string, unknown>
  },
) => {
  let existingProfile: Record<string, unknown> | null = null

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', input.userId)
      .maybeSingle()

    if (profile) {
      existingProfile = profile
      break
    }

    await wait(300)
  }

  if (!existingProfile) {
    // Retry the upsert — auth.admin.createUser may return before the row is
    // fully committed in auth.users, causing FK violation (23503).
    let manualProfile: Record<string, unknown> | null = null
    let manualError: { code?: string; message: string } | null = null

    for (let upsertAttempt = 0; upsertAttempt < 8; upsertAttempt++) {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: input.userId,
          email: input.email,
          full_name: input.fullName,
          role: input.role,
          role_id: input.roleId ?? null,
          organization_id: input.organizationId,
          branch_id: input.branchId,
          is_active: true,
          metadata: input.metadata,
        }, { onConflict: 'id' })
        .select('*')
        .single()

      if (!error) {
        manualProfile = data as Record<string, unknown>
        manualError = null
        break
      }

      manualError = error as { code?: string; message: string }

      // FK violation means auth.users row isn't visible yet — wait and retry
      if ((error as any).code === '23503') {
        await wait(500 * (upsertAttempt + 1))
        continue
      }

      // Any other error is non-retryable
      break
    }

    if (manualError) {
      throw new Error(`User created but profile creation failed: ${manualError.message}`)
    }

    return manualProfile as Record<string, unknown>
  }

  return existingProfile
}

const finalizeProfile = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  input: {
    profile: Record<string, unknown>
    role: string
    roleId?: string | null
    fullName: string
    organizationId: string
    branchId: string | null
    metadata: Record<string, unknown>
    nfcId?: string | null
  },
) => {
  const mergedMetadata = {
    ...parseMetadataObject(input.profile.metadata),
    ...input.metadata,
  }

  const employeeCode = input.role === 'student'
    ? await assignStudentNumber(supabaseAdmin, String(input.profile.id), input.organizationId, input.profile)
    : await (async () => {
      const existingCode = mergedMetadata.essl_employee_code
      if (typeof existingCode === 'string' && existingCode.trim()) {
        return existingCode.trim()
      }
      return await reserveEmployeeNumber(supabaseAdmin, input.organizationId)
    })()

  mergedMetadata.essl_employee_code = employeeCode
  const cardNumber = await reserveCardNumber(supabaseAdmin, input.nfcId)

  const profilePatch: Record<string, unknown> = {
    organization_id: input.organizationId,
    role: input.role,
    role_id: input.roleId ?? null,
    full_name: input.fullName,
    metadata: mergedMetadata,
    nfc_id: cardNumber,
  }

  if (!input.profile.branch_id && input.branchId) {
    profilePatch.branch_id = input.branchId
  }

  const { data: updatedProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .update(profilePatch)
    .eq('id', input.profile.id)
    .select('*')
    .single()

  if (profileError) {
    throw new Error(`Profile finalization failed: ${profileError.message}`)
  }

  try {
    const resultMessage = await syncEmployeeToEssl(employeeCode, input.fullName, cardNumber)
    return {
      profile: updatedProfile,
      essl: {
        synced: true,
        employeeCode,
        cardNumber,
        message: resultMessage,
      },
    }
  } catch (error) {
    return {
      profile: updatedProfile,
      essl: {
        synced: false,
        employeeCode,
        cardNumber,
        error: error instanceof Error ? error.message : 'Unknown ESSL sync error',
      },
    }
  }
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
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, organization_id, branch_id')
      .eq('id', user.id)
      .single()

    if (profileError || !['admin', 'sales_staff'].includes(callerProfile.role)) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin or Sales Staff access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const requestBody = await req.json()
    const {
      email,
      password,
      full_name,
      role,
      organization_id,
      metadata,
      branch_id,
      role_id,
      nfc_id,
    } = requestBody as {
      email: string
      password: string
      full_name: string
      role: string
      organization_id?: string
      metadata?: unknown
      branch_id?: string | null
      role_id?: string | null
      nfc_id?: string | null
    }

    if (!email || !password || !full_name || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, full_name, role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const orgId = organization_id || callerProfile.organization_id
    if (!orgId) {
      return new Response(
        JSON.stringify({ error: 'No organization found for this user' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const parsedMetadata = parseMetadataObject(metadata)

    let resolvedBranchId = branch_id || callerProfile.branch_id || null
    if (!resolvedBranchId) {
      const { data: mainBranch } = await supabaseAdmin
        .from('branches')
        .select('id')
        .eq('organization_id', orgId)
        .eq('is_main_branch', true)
        .maybeSingle()
      resolvedBranchId = mainBranch?.id || null
    }

    const createUserPayload = {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role,
        role_id,
        organization_id: orgId,
        ...(parsedMetadata || {}),
      },
    }

    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser(createUserPayload)

    let authUser = createdUser?.user ?? null

    if (createError) {
      console.warn('auth.admin.createUser failed, trying with trigger disabled:', createError.message)

      try {
        await supabaseAdmin.rpc('exec_sql', {
          query: 'ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;',
        }).throwOnError()
      } catch (_disableErr) {
        console.warn('Could not disable trigger via RPC')
      }

      const { data: retryUser, error: retryError } = await supabaseAdmin.auth.admin.createUser(createUserPayload)

      try {
        await supabaseAdmin.rpc('exec_sql', {
          query: 'ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;',
        })
      } catch (_enableErr) {
        console.warn('Could not re-enable trigger via RPC')
      }

      if (retryError || !retryUser?.user) {
        console.error('Retry also failed:', retryError)
        return new Response(
          JSON.stringify({ error: retryError?.message || createError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      authUser = retryUser.user
    }

    if (!authUser) {
      throw new Error('User creation did not return a user record')
    }

    const profile = await ensureProfile(supabaseAdmin, {
      userId: authUser.id,
      email,
      fullName: full_name,
      role,
      roleId: role_id,
      organizationId: orgId,
      branchId: resolvedBranchId,
      metadata: parsedMetadata,
    })

    const finalized = await finalizeProfile(supabaseAdmin, {
      profile,
      role,
      roleId: role_id,
      fullName: full_name,
      organizationId: orgId,
      branchId: resolvedBranchId,
      metadata: parsedMetadata,
      nfcId: nfc_id,
    })

    return new Response(
      JSON.stringify({ success: true, user: authUser, profile: finalized.profile, essl: finalized.essl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

