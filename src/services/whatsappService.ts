import { supabase } from '@/lib/supabase';

export type WhatsAppTemplateKey =
  | 'fee_reminder'
  | 'fee_receipt'
  | 'attendance_reminder'
  | 'leave_reminder';

export interface SendWhatsAppTemplatePayload {
  to: string;
  templateKey: WhatsAppTemplateKey;
  bodyParams: string[];
  languageCode?: string;
}

function normalizePhone(value: string) {
  return String(value || '').replace(/\D/g, '');
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
