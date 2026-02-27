import { supabase } from '@/lib/supabase';

// ─── Wabis WhatsApp API Service ───
// All messages are sent via Wabis (https://bot.wabis.in) through Supabase edge functions.
// Required Supabase secrets:
//   WABIS_API_TOKEN                       – Your Wabis API key
//   WABIS_PHONE_NUMBER_ID                – Your Wabis WhatsApp phone number ID
//   WABIS_TEMPLATE_STUDENT_REGISTRATION  – botTemplateID for student registration welcome
//   WABIS_TEMPLATE_FEE_REMINDER          – botTemplateID for fee reminders
//   WABIS_TEMPLATE_FEE_RECEIPT           – botTemplateID for fee receipts
//   WABIS_TEMPLATE_ATTENDANCE_REMINDER   – botTemplateID for attendance reminders
//   WABIS_TEMPLATE_LEAVE_REMINDER        – botTemplateID for leave reminders
//
// ── WABIS Template Texts (submit these for Meta review) ──
//
// 1. student_registration  (ID: student_account_creation)
//    Hi {{text}},
//    Your account has been created successfully at {{text}}.
//    Email: {{text}}
//    Password: {{text}}
//    Course: {{text}}
//    Please login at {{text}} to get started.
//
// 2. fee_reminder  (ID: fee_payment_due_reminder)
//    Hi {{text}}, your {{text}} fee of {{amount}} is due on {{date}}.
//    Pay now to avoid service disruption. Ignore if already paid.
//
// 3. fee_receipt  (ID: fee_payment_confirmation)
//    Hi {{text}},
//    We have received your payment of {{amount}} for {{text}}.
//    Your payment date was {{date}}.
//    Remaining balance: {{amount}}.
//    Thank you.

export type WhatsAppTemplateKey =
  | 'student_registration'
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

// Template: Hi {{1:text}}, Your account has been created successfully at {{2:text}}.
//           Email: {{3:text}} Password: {{4:text}} Course: {{5:text}}
//           Please login at {{6:text}} to get started.
export async function sendRegistrationMessage(input: {
  to: string;
  studentName: string;
  email: string;
  password: string;
  courseName?: string;
  organizationName?: string;
  appLink?: string;
}) {
  return sendTemplate({
    to: input.to,
    templateKey: 'student_registration',
    bodyParams: [
      input.studentName || 'Student',                  // {{1:text}} – name
      input.organizationName || 'Our Institute',       // {{2:text}} – org
      input.email || '',                               // {{3:text}} – email
      input.password || '',                            // {{4:text}} – password
      input.courseName || 'N/A',                       // {{5:text}} – course
      input.appLink || 'https://app.ecraftz.in',       // {{6:text}} – login link
    ],
  });
}

// Template: Hi {{1:text}}, your {{2:text}} fee of {{3:amount}} is due on {{4:date}}.
//           Pay now to avoid service disruption. Ignore if already paid.
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
      input.studentName || 'Student',                  // {{1:text}}   – name
      input.courseName || 'Course',                    // {{2:text}}   – course
      `₹${(input.dueAmount ?? 0).toLocaleString('en-IN')}`,  // {{3:amount}} – due amount
      input.dueDate || 'N/A',                          // {{4:date}}   – due date
    ],
  });
}

// Template: Hi {{1:text}}, We have received your payment of {{2:amount}} for {{3:text}}.
//           Your payment date was {{4:date}}. Remaining balance: {{5:amount}}. Thank you.
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
      input.studentName || 'Student',                  // {{1:text}}   – name
      `₹${(input.paidAmount ?? 0).toLocaleString('en-IN')}`,  // {{2:amount}} – paid
      input.courseName || 'Course',                    // {{3:text}}   – course
      input.paymentDate || '-',                        // {{4:date}}   – payment date
      `₹${(input.remainingAmount ?? 0).toLocaleString('en-IN')}`,  // {{5:amount}} – remaining
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
