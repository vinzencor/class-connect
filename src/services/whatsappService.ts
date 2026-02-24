import { supabase } from '@/lib/supabase';

// ─── Wabis WhatsApp API Service ───
// All messages are sent via Wabis (https://bot.wabis.in) through Supabase edge functions.
// Required Supabase secrets:
//   WABIS_API_TOKEN                    – Your Wabis API key
//   WABIS_PHONE_NUMBER_ID             – Your Wabis WhatsApp phone number ID
//   WABIS_TEMPLATE_FEE_REMINDER       – botTemplateID for fee reminders
//   WABIS_TEMPLATE_FEE_RECEIPT        – botTemplateID for fee receipts
//   WABIS_TEMPLATE_ATTENDANCE_REMINDER – botTemplateID for attendance reminders
//   WABIS_TEMPLATE_LEAVE_REMINDER     – botTemplateID for leave reminders

export type WhatsAppTemplateKey =
  | 'fee_reminder'
  | 'fee_receipt'
  | 'attendance_reminder'
  | 'leave_reminder';

export interface SendWhatsAppTemplatePayload {
  to: string;
  templateKey: WhatsAppTemplateKey;
  bodyParams: string[];
}

function normalizePhone(value: string) {
  // Strip non-digits, ensure starts with country code (no + sign)
  let phone = String(value || '').replace(/\D/g, '');
  // If Indian number without country code, prefix 91
  if (phone.length === 10) phone = '91' + phone;
  return phone;
}

async function sendTemplate(payload: SendWhatsAppTemplatePayload) {
  const { data, error } = await supabase.functions.invoke('send-whatsapp-template', {
    body: {
      ...payload,
      to: normalizePhone(payload.to),
    },
  });

  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'Failed to send WhatsApp message');
  return data;
}

export async function sendFeeReminder(input: {
  to: string;
  studentName: string;
  courseName: string;
  dueAmount: number;
  dueDate?: string | null;
}) {
  return sendTemplate({
    to: input.to,
    templateKey: 'fee_reminder',
    bodyParams: [
      input.studentName || 'Student',
      input.courseName || 'Course',
      String(input.dueAmount ?? 0),
      input.dueDate || '-',
    ],
  });
}

export async function sendFeeReceipt(input: {
  to: string;
  studentName: string;
  courseName: string;
  paidAmount: number;
  paymentDate: string;
  remainingAmount: number;
}) {
  return sendTemplate({
    to: input.to,
    templateKey: 'fee_receipt',
    bodyParams: [
      input.studentName || 'Student',
      input.courseName || 'Course',
      String(input.paidAmount ?? 0),
      input.paymentDate || '-',
      String(input.remainingAmount ?? 0),
    ],
  });
}

export async function sendAttendanceReminder(input: {
  to: string;
  studentName: string;
  attendancePercent: number;
}) {
  return sendTemplate({
    to: input.to,
    templateKey: 'attendance_reminder',
    bodyParams: [
      input.studentName || 'Student',
      String(input.attendancePercent ?? 0),
    ],
  });
}

export async function sendLeaveReminder(input: {
  to: string;
  studentName: string;
  leaveDate: string;
  reason: string;
}) {
  return sendTemplate({
    to: input.to,
    templateKey: 'leave_reminder',
    bodyParams: [
      input.studentName || 'Student',
      input.leaveDate || '-',
      input.reason || '-',
    ],
  });
}
