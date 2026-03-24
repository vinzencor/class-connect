export interface EsslConfig {
  baseUrl: string
  apiKey: string
  serialNumber: string
  userName: string
  userPassword: string
}

const DEFAULT_BASE_URL = 'http://182.76.161.219:81/iclock/WebAPIService.asmx'

export const getEsslConfig = (): EsslConfig => ({
  baseUrl: normalizeEsslBaseUrl(
    Deno.env.get('ESSL_BASE_URL') ?? DEFAULT_BASE_URL,
  ),
  apiKey: Deno.env.get('ESSL_API_KEY') ?? '11',
  serialNumber: Deno.env.get('ESSL_SERIAL_NUMBER') ?? 'CGKK190264523',
  userName: Deno.env.get('ESSL_USERNAME') ?? 'SUHAD',
  userPassword: Deno.env.get('ESSL_PASSWORD') ?? 'Suhad@123',
})

export const normalizeEsslBaseUrl = (value: string) =>
  value.replace(/\?op=.*$/i, '').replace(/\/+$/, '')

export const soapEscape = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')

export const decodeXmlEntities = (value: string) =>
  value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&')

export const extractXmlTagValue = (xml: string, tagName: string) => {
  const matcher = new RegExp(
    `<(?:\\w+:)?${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${tagName}>`,
    'i',
  )
  const match = xml.match(matcher)
  return match?.[1]?.trim() ?? ''
}

export const extractSoapFault = (xml: string) => {
  const faultString = extractXmlTagValue(xml, 'faultstring')
  if (faultString) return decodeXmlEntities(faultString)

  const faultCode = extractXmlTagValue(xml, 'faultcode')
  if (faultCode) return decodeXmlEntities(faultCode)

  return ''
}

export const wrapSoapEnvelope = (body: string) => `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
${body}
  </soap:Body>
</soap:Envelope>`

export const postEsslSoap = async (operation: string, envelope: string) => {
  const config = getEsslConfig()
  const response = await fetch(`${config.baseUrl}?op=${operation}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: `http://tempuri.org/${operation}`,
    },
    body: envelope,
  })

  const responseText = await response.text()
  const soapFault = extractSoapFault(responseText)

  if (!response.ok) {
    throw new Error(soapFault || `ESSL ${operation} failed with HTTP ${response.status}`)
  }

  if (soapFault) {
    throw new Error(soapFault)
  }

  return responseText
}