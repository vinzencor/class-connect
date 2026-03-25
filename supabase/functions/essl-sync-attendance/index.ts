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

type ParsedRecord = Record<string, string>

const normalizeKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

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

const extractFieldsFromXmlBlock = (xmlBlock: string) => {
  const fields: ParsedRecord = {}
  const fieldRegex = /<(?:\w+:)?([A-Za-z0-9_]+)(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?\1>/g
  let match: RegExpExecArray | null = null

  while ((match = fieldRegex.exec(xmlBlock)) !== null) {
    const value = decodeXmlEntities(match[2]).trim()
    if (!value || value.includes('<')) continue
    fields[match[1]] = value
  }

  return fields
}

const parseLineRecord = (line: string) => {
  const record: ParsedRecord = {}
  const pairs = line.split(/[;,|]/)
  for (const pair of pairs) {
    const [rawKey, ...rest] = pair.split(/[:=]/)
    if (!rawKey || rest.length === 0) continue
    record[rawKey.trim()] = rest.join(':').trim()
  }
  return record
}

const parseTransactionRecords = (rawValue: string) => {
  const decoded = decodeXmlEntities(rawValue).trim()
  if (!decoded || decoded.toLowerCase() === 'balnk' || decoded.toLowerCase() === 'blank') {
    return [] as ParsedRecord[]
  }

  if (decoded.startsWith('[') || decoded.startsWith('{')) {
    try {
      const parsed = JSON.parse(decoded)
      const items = Array.isArray(parsed) ? parsed : [parsed]
      return items.filter((item) => item && typeof item === 'object' && !Array.isArray(item)) as ParsedRecord[]
    } catch {
      // Continue with non-JSON parsing.
    }
  }

  if (decoded.includes('<')) {
    const containerTags = ['Row', 'Transaction', 'Table', 'Log', 'Attendance', 'Record']
    for (const tag of containerTags) {
      const regex = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'gi')
      const records = Array.from(decoded.matchAll(regex))
        .map((match) => extractFieldsFromXmlBlock(match[0]))
        .filter((item) => Object.keys(item).length > 0)
      if (records.length > 0) {
        return records
      }
    }

    const singleRecord = extractFieldsFromXmlBlock(decoded)
    if (Object.keys(singleRecord).length > 0) {
      return [singleRecord]
    }
  }

  return decoded
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseLineRecord)
    .filter((item) => Object.keys(item).length > 0)
}

const pickValue = (record: ParsedRecord, candidates: string[]) => {
  const normalizedEntries = Object.entries(record).map(([key, value]) => [normalizeKey(key), value] as const)
  for (const candidate of candidates.map(normalizeKey)) {
    const match = normalizedEntries.find(([key]) => key === candidate)
    if (match?.[1]) return match[1]
  }
  return ''
}

const parseTimestamp = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null

  const normalized = trimmed
    .replace(/\//g, '-')
    .replace(' ', 'T')

  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const buildTransactionEnvelope = (fromDate: string, toDate: string, useLegacyTagNames = false) => {
  const config = getEsslConfig()
  const fromTag = useLegacyTagNames ? 'FromDate' : 'FromDateTime'
  const toTag = useLegacyTagNames ? 'ToDate' : 'ToDateTime'

  return wrapSoapEnvelope(`    <GetTransactionsLog xmlns="http://tempuri.org/">
      <${fromTag}>${soapEscape(fromDate)}</${fromTag}>
      <${toTag}>${soapEscape(toDate)}</${toTag}>
      <SerialNumber>${soapEscape(config.serialNumber)}</SerialNumber>
      <UserName>${soapEscape(config.userName)}</UserName>
      <UserPassword>${soapEscape(config.userPassword)}</UserPassword>
      <strDataList>Blank</strDataList>
    </GetTransactionsLog>`)
}

const fetchTransactionsXml = async (fromDate: string, toDate: string) => {
  try {
    return await postEsslSoap('GetTransactionsLog', buildTransactionEnvelope(fromDate, toDate))
  } catch (error) {
    const fallbackXml = await postEsslSoap('GetTransactionsLog', buildTransactionEnvelope(fromDate, toDate, true))
    if (!fallbackXml && error instanceof Error) {
      throw error
    }
    return fallbackXml
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

    const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single()

    if (callerProfileError || !callerProfile?.organization_id || callerProfile.role === 'student') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Attendance sync is only available to staff users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { fromDate, toDate } = await req.json() as { fromDate?: string; toDate?: string }
    if (!fromDate || !toDate) {
      return new Response(
        JSON.stringify({ error: 'fromDate and toDate are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const responseXml = await fetchTransactionsXml(fromDate, toDate)
    const resultMessage = decodeXmlEntities(extractXmlTagValue(responseXml, 'GetTransactionsLogResult'))
    const rawDataList = extractXmlTagValue(responseXml, 'strDataList')
    const parsedRecords = parseTransactionRecords(rawDataList)

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, branch_id, nfc_id, student_number, metadata')
      .eq('organization_id', callerProfile.organization_id)
      .eq('is_active', true)

    if (profilesError) {
      throw new Error(`Failed to load profiles for attendance sync: ${profilesError.message}`)
    }

    const employeeCodeMap = new Map<string, Record<string, unknown>>()
    const cardMap = new Map<string, Record<string, unknown>>()

    for (const profile of profiles || []) {
      const metadata = parseMetadataObject(profile.metadata)
      const employeeCodeCandidates = [profile.student_number, metadata.essl_employee_code]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

      for (const code of employeeCodeCandidates) {
        employeeCodeMap.set(code.trim().toUpperCase(), profile as Record<string, unknown>)
      }

      if (typeof profile.nfc_id === 'string' && profile.nfc_id.trim()) {
        cardMap.set(profile.nfc_id.trim().toUpperCase(), profile as Record<string, unknown>)
      }
    }

    const aggregatedPunches = new Map<string, {
      profile: Record<string, unknown>
      employeeCode: string
      cardNumber: string
      timestamp: Date
    }>()
    const preview: Array<{
      personName: string
      employeeCode: string
      cardNumber: string
      timestamp: string
      matched: boolean
    }> = []

    let matchedLogs = 0

    for (const record of parsedRecords) {
      const employeeCode = pickValue(record, ['EmployeeCode', 'EmpCode', 'EnrollNumber', 'UserID', 'EmployeeNo'])
      const cardNumber = pickValue(record, ['CardNumber', 'CardNo', 'RFID', 'NFCID'])
      const timestampValue = pickValue(record, ['PunchDateTime', 'DateTime', 'TransactionTime', 'LogDateTime', 'CheckTime', 'Time'])
      const timestamp = parseTimestamp(timestampValue)

      const matchedProfile =
        (cardNumber ? cardMap.get(cardNumber.trim().toUpperCase()) : undefined)
        || (employeeCode ? employeeCodeMap.get(employeeCode.trim().toUpperCase()) : undefined)

      preview.push({
        personName: matchedProfile?.full_name ? String(matchedProfile.full_name) : 'Unmatched',
        employeeCode,
        cardNumber,
        timestamp: timestamp?.toISOString() || timestampValue || '',
        matched: Boolean(matchedProfile && timestamp),
      })

      if (!matchedProfile || !timestamp) {
        continue
      }

      matchedLogs += 1
      const dateKey = timestamp.toISOString().slice(0, 10)
      const aggregateKey = `${matchedProfile.id}:${dateKey}`
      const existing = aggregatedPunches.get(aggregateKey)

      if (!existing || timestamp < existing.timestamp) {
        aggregatedPunches.set(aggregateKey, {
          profile: matchedProfile,
          employeeCode,
          cardNumber,
          timestamp,
        })
      }
    }

    let syncedRecords = 0
    for (const punch of aggregatedPunches.values()) {
      const attendanceDate = punch.timestamp.toISOString().slice(0, 10)
      const { data: existingAttendance } = await supabaseAdmin
        .from('attendance')
        .select('id, marked_at, status')
        .eq('organization_id', callerProfile.organization_id)
        .eq('student_id', punch.profile.id)
        .eq('date', attendanceDate)
        .or('session.is.null,session.eq.full')
        .maybeSingle()

      const attendancePayload = {
        organization_id: callerProfile.organization_id,
        branch_id: punch.profile.branch_id ?? null,
        student_id: punch.profile.id,
        date: attendanceDate,
        status: 'present',
        attendance_source: 'essl',
        marked_at: punch.timestamp.toISOString(),
        marked_by: user.id,
        session: null,
        notes: `ESSL sync: ${punch.employeeCode || 'unknown employee code'}${punch.cardNumber ? ` / ${punch.cardNumber}` : ''}`,
      }

      if (existingAttendance?.id) {
        const { error: updateError } = await supabaseAdmin
          .from('attendance')
          .update(attendancePayload)
          .eq('id', existingAttendance.id)

        if (updateError) {
          throw new Error(`Failed to update attendance: ${updateError.message}`)
        }
      } else {
        const { error: insertError } = await supabaseAdmin
          .from('attendance')
          .insert(attendancePayload as Record<string, unknown>)

        if (insertError) {
          throw new Error(`Failed to insert attendance: ${insertError.message}`)
        }
      }

      syncedRecords += 1
    }

    return new Response(
      JSON.stringify({
        success: true,
        resultMessage: resultMessage || 'ESSL transactions fetched successfully',
        totalLogs: parsedRecords.length,
        matchedLogs,
        syncedRecords,
        unmatchedLogs: Math.max(parsedRecords.length - matchedLogs, 0),
        preview: preview.slice(0, 20),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('ESSL attendance sync failed:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})