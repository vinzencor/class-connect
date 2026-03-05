/**
 * Shared payment method options used across the application.
 * Used in student registration, admissions enrollment, fee payment dialogs, and reports.
 */
export const PAYMENT_METHODS = [
  'Cash',
  'UPI',
  'NEFT',
  'IMPS',
  'Cheque',
  'Card',
  'Credit Card',
  'Debit Card',
  'Bajaj EMI',
  'Other EMI',
  'Online',
  'Bank Transfer',
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
