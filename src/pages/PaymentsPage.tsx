import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  Plus,
  Download,
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpCircle,
  ArrowDownCircle,
  Filter,
  Pause,
  Play,
  Trash2,
  DollarSign,
  ReceiptText,
  FileText,
  CalendarDays,
  CreditCard,
  AlertTriangle,
  IndianRupee,
  MessageCircle,
} from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { sendFeeReceipt, sendFeeReminder } from '@/services/whatsappService';

// ── Types ──────────────────────────────────────────────────
interface Transaction {
  id: string;
  type: 'income' | 'expense';
  description: string;
  amount: number;
  category: string;
  date: string;
  mode: string;
  recurrence: 'one-time' | 'monthly';
  paused: boolean;
  parentId?: string;
}

interface StudentFeePayment {
  id: string;
  amount: number;
  date: string;
  mode: string;
}

interface StudentFee {
  id: string;
  studentId: string | null;
  studentName: string;
  studentNumber?: string | null;
  enrollmentId?: string | null;
  courseName: string;
  batchName?: string | null;
  branchName?: string | null;
  totalFee: number;
  discountAmount: number;
  finalAmount: number;
  dueDate: string;
  payments: StudentFeePayment[];
  status: 'pending' | 'partial' | 'paid';
  installmentCount: number;
  createdAt: string;
  studentPhone?: string | null;
}

interface OrgInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string | null;
  gstNumber?: string | null;
}

const INCOME_CATEGORIES = ['Salary', 'Student Fees', 'Consultation', 'Investment', 'Course Fee', 'Other Income'];
const EXPENSE_CATEGORIES = ['Subscription', 'Rent', 'Utilities', 'Marketing', 'Equipment', 'Staff Salary', 'Other Expense'];
const PAYMENT_MODES = ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Cheque'];

// ── Helpers ────────────────────────────────────────────────
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

const formatDate = (dateStr: string) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getMonthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// ── Amount to words helper ──────────────────────────────────
function numberToWords(num: number): string {
  if (num === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  }

  const intPart = Math.floor(num);
  const decPart = Math.round((num - intPart) * 100);
  let result = convert(intPart) + ' Rupees';
  if (decPart > 0) result += ' and ' + convert(decPart) + ' Paise';
  result += ' Only';
  return result;
}

// ── PDF Generators ─────────────────────────────────────────
function generateInvoicePDF(fee: StudentFee, orgInfo: OrgInfo) {
  const paidAmount = fee.payments.reduce((s, p) => s + p.amount, 0);
  const remaining = fee.finalAmount - paidAmount;
  // GST calculation: 18% total (9% CGST + 9% SGST) — compute base from final amount
  const baseAmount = Math.round(fee.finalAmount / 1.18 * 100) / 100;
  const cgst = Math.round(baseAmount * 0.09 * 100) / 100;
  const sgst = Math.round(baseAmount * 0.09 * 100) / 100;
  const totalWithGst = Math.round((baseAmount + cgst + sgst) * 100) / 100;

  const html = `<!DOCTYPE html>
<html><head><title>Invoice - ${fee.studentName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; color: #222; background: #fff; font-size: 13px; }
  .inv-border { border: 2px solid #222; padding: 0; }
  .header-row { display: flex; align-items: center; border-bottom: 2px solid #222; }
  .logo-cell { width: 100px; padding: 12px; text-align: center; border-right: 2px solid #222; }
  .logo-cell img { max-height: 70px; max-width: 80px; object-fit: contain; }
  .org-cell { flex: 1; padding: 12px; text-align: center; }
  .org-cell h2 { font-size: 18px; margin-bottom: 2px; text-transform: uppercase; }
  .org-cell p { font-size: 11px; color: #444; margin-bottom: 1px; }
  .title-row { text-align: center; padding: 6px; border-bottom: 2px solid #222; font-size: 16px; font-weight: 700; letter-spacing: 2px; background: #f5f5f5; }
  .detail-grid { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #222; }
  .detail-grid .left, .detail-grid .right { padding: 8px 12px; }
  .detail-grid .right { border-left: 1px solid #222; }
  .detail-grid p { margin-bottom: 3px; font-size: 12px; }
  .detail-grid strong { font-weight: 600; }
  table.fee-table { width: 100%; border-collapse: collapse; }
  table.fee-table th, table.fee-table td { border: 1px solid #222; padding: 6px 10px; font-size: 12px; }
  table.fee-table th { background: #f0f0f0; font-weight: 600; text-align: center; }
  table.fee-table td.right { text-align: right; }
  table.fee-table td.center { text-align: center; }
  .words-row { padding: 8px 12px; border-top: 1px solid #222; font-size: 11px; font-style: italic; }
  .footer-section { display: flex; justify-content: space-between; padding: 16px 12px 8px; margin-top: 8px; }
  .footer-section .left-note { font-size: 10px; color: #c00; font-weight: 600; }
  .footer-section .right-sign { text-align: center; }
  .footer-section .right-sign .line { border-top: 1px solid #222; width: 160px; margin-bottom: 4px; }
  .footer-section .right-sign p { font-size: 11px; font-weight: 600; }
  @media print { body { padding: 12px; } }
</style>
</head><body>
<div class="inv-border">
  <!-- Header: Logo + Org Info -->
  <div class="header-row">
    <div class="logo-cell">
      ${orgInfo.logoUrl ? `<img src="${orgInfo.logoUrl}" alt="Logo" />` : '<div style="height:50px;"></div>'}
    </div>
    <div class="org-cell">
      <h2>${orgInfo.name}</h2>
      ${orgInfo.address ? `<p>${orgInfo.address}</p>` : ''}
      ${orgInfo.phone ? `<p>Phone: ${orgInfo.phone}</p>` : ''}
      ${orgInfo.email ? `<p>Email: ${orgInfo.email}</p>` : ''}
      ${orgInfo.gstNumber ? `<p>GST No: ${orgInfo.gstNumber}</p>` : ''}
    </div>
  </div>

  <!-- Title -->
  <div class="title-row">FEE INVOICE</div>

  <!-- Student + Invoice Details -->
  <div class="detail-grid">
    <div class="left">
      <p><strong>Student Name:</strong> ${fee.studentName}</p>
      ${fee.studentNumber ? `<p><strong>Student No:</strong> ${fee.studentNumber}</p>` : ''}
      <p><strong>Course:</strong> ${fee.courseName}</p>
      ${fee.batchName ? `<p><strong>Batch:</strong> ${fee.batchName}</p>` : ''}
      ${fee.branchName ? `<p><strong>Branch:</strong> ${fee.branchName}</p>` : ''}
    </div>
    <div class="right">
      <p><strong>Invoice No:</strong> ${fee.id.slice(0, 8).toUpperCase()}</p>
      <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
      <p><strong>Due Date:</strong> ${fee.dueDate ? formatDate(fee.dueDate) : '—'}</p>
      <p><strong>Status:</strong> ${fee.status.toUpperCase()}</p>
    </div>
  </div>

  <!-- Fee Table -->
  <table class="fee-table">
    <thead>
      <tr><th>S.No</th><th>Description</th><th>Amount (₹)</th></tr>
    </thead>
    <tbody>
      <tr><td class="center">1</td><td>Course Fee — ${fee.courseName}</td><td class="right">${fee.totalFee.toLocaleString('en-IN')}</td></tr>
      ${fee.discountAmount > 0 ? `<tr><td class="center">2</td><td>Discount</td><td class="right">-${fee.discountAmount.toLocaleString('en-IN')}</td></tr>` : ''}
      <tr><td></td><td><strong>Taxable Amount</strong></td><td class="right"><strong>${baseAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td></tr>
      <tr><td></td><td>CGST @ 9%</td><td class="right">${cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
      <tr><td></td><td>SGST @ 9%</td><td class="right">${sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
      <tr><td></td><td><strong>Total Amount</strong></td><td class="right"><strong>₹${totalWithGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td></tr>
      <tr><td></td><td><strong>Amount Paid</strong></td><td class="right"><strong>₹${paidAmount.toLocaleString('en-IN')}</strong></td></tr>
      <tr><td></td><td><strong>Balance Due</strong></td><td class="right"><strong>₹${remaining.toLocaleString('en-IN')}</strong></td></tr>
    </tbody>
  </table>

  <!-- Amount in words -->
  <div class="words-row">
    <strong>Amount in words:</strong> ${numberToWords(fee.finalAmount)}
  </div>

  <!-- Payment History -->
  ${fee.payments.length > 0 ? `
  <div style="padding: 8px 12px; font-size: 12px;">
    <strong>Payment History:</strong>
    <table class="fee-table" style="margin-top: 4px;">
      <thead><tr><th>#</th><th>Date</th><th>Amount (₹)</th><th>Mode</th></tr></thead>
      <tbody>
        ${fee.payments.map((p, i) =>
          `<tr><td class="center">${i + 1}</td><td class="center">${formatDate(p.date)}</td><td class="right">${p.amount.toLocaleString('en-IN')}</td><td class="center">${p.mode}</td></tr>`
        ).join('')}
      </tbody>
    </table>
  </div>` : ''}

  <!-- Footer -->
  <div class="footer-section">
    <div class="left-note">* FEE IS NOT REFUNDABLE</div>
    <div class="right-sign">
      <div class="line"></div>
      <p>Authorised Signatory</p>
    </div>
  </div>
</div>
</body></html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  }
}

function generateReceiptPDF(fee: StudentFee, payment: StudentFeePayment, paymentIndex: number, orgInfo: OrgInfo) {
  const paidBefore = fee.payments.slice(0, paymentIndex).reduce((s, p) => s + p.amount, 0);
  const paidAfter = paidBefore + payment.amount;
  const remaining = fee.finalAmount - paidAfter;
  const baseAmount = Math.round(payment.amount / 1.18 * 100) / 100;
  const cgst = Math.round(baseAmount * 0.09 * 100) / 100;
  const sgst = Math.round(baseAmount * 0.09 * 100) / 100;

  const html = `<!DOCTYPE html>
<html><head><title>Receipt - ${fee.studentName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; color: #222; background: #fff; font-size: 13px; }
  .inv-border { border: 2px solid #222; padding: 0; }
  .header-row { display: flex; align-items: center; border-bottom: 2px solid #222; }
  .logo-cell { width: 100px; padding: 12px; text-align: center; border-right: 2px solid #222; }
  .logo-cell img { max-height: 70px; max-width: 80px; object-fit: contain; }
  .org-cell { flex: 1; padding: 12px; text-align: center; }
  .org-cell h2 { font-size: 18px; margin-bottom: 2px; text-transform: uppercase; }
  .org-cell p { font-size: 11px; color: #444; margin-bottom: 1px; }
  .title-row { text-align: center; padding: 6px; border-bottom: 2px solid #222; font-size: 16px; font-weight: 700; letter-spacing: 2px; background: #f5f5f5; }
  .detail-grid { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #222; }
  .detail-grid .left, .detail-grid .right { padding: 8px 12px; }
  .detail-grid .right { border-left: 1px solid #222; }
  .detail-grid p { margin-bottom: 3px; font-size: 12px; }
  table.fee-table { width: 100%; border-collapse: collapse; }
  table.fee-table th, table.fee-table td { border: 1px solid #222; padding: 6px 10px; font-size: 12px; }
  table.fee-table th { background: #f0f0f0; font-weight: 600; text-align: center; }
  table.fee-table td.right { text-align: right; }
  table.fee-table td.center { text-align: center; }
  .words-row { padding: 8px 12px; border-top: 1px solid #222; font-size: 11px; font-style: italic; }
  .footer-section { display: flex; justify-content: space-between; padding: 16px 12px 8px; margin-top: 8px; }
  .footer-section .left-note { font-size: 10px; color: #c00; font-weight: 600; }
  .footer-section .right-sign { text-align: center; }
  .footer-section .right-sign .line { border-top: 1px solid #222; width: 160px; margin-bottom: 4px; }
  .footer-section .right-sign p { font-size: 11px; font-weight: 600; }
  @media print { body { padding: 12px; } }
</style>
</head><body>
<div class="inv-border">
  <div class="header-row">
    <div class="logo-cell">
      ${orgInfo.logoUrl ? `<img src="${orgInfo.logoUrl}" alt="Logo" />` : '<div style="height:50px;"></div>'}
    </div>
    <div class="org-cell">
      <h2>${orgInfo.name}</h2>
      ${orgInfo.address ? `<p>${orgInfo.address}</p>` : ''}
      ${orgInfo.phone ? `<p>Phone: ${orgInfo.phone}</p>` : ''}
      ${orgInfo.email ? `<p>Email: ${orgInfo.email}</p>` : ''}
      ${orgInfo.gstNumber ? `<p>GST No: ${orgInfo.gstNumber}</p>` : ''}
    </div>
  </div>

  <div class="title-row">FEE RECEIPT</div>

  <div class="detail-grid">
    <div class="left">
      <p><strong>Student Name:</strong> ${fee.studentName}</p>
      ${fee.studentNumber ? `<p><strong>Student No:</strong> ${fee.studentNumber}</p>` : ''}
      <p><strong>Course:</strong> ${fee.courseName}</p>
      ${fee.batchName ? `<p><strong>Batch:</strong> ${fee.batchName}</p>` : ''}
      ${fee.branchName ? `<p><strong>Branch:</strong> ${fee.branchName}</p>` : ''}
    </div>
    <div class="right">
      <p><strong>Receipt No:</strong> ${payment.id.slice(0, 8).toUpperCase()}</p>
      <p><strong>Date:</strong> ${formatDate(payment.date)}</p>
      <p><strong>Payment Mode:</strong> ${payment.mode}</p>
      <p><strong>Installment:</strong> ${paymentIndex + 1} of ${fee.payments.length}</p>
    </div>
  </div>

  <table class="fee-table">
    <thead><tr><th>S.No</th><th>Description</th><th>Amount (₹)</th></tr></thead>
    <tbody>
      <tr><td class="center">1</td><td>Fee Payment — ${fee.courseName}</td><td class="right">${baseAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
      <tr><td></td><td>CGST @ 9%</td><td class="right">${cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
      <tr><td></td><td>SGST @ 9%</td><td class="right">${sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
      <tr><td></td><td><strong>Amount Paid</strong></td><td class="right"><strong>₹${payment.amount.toLocaleString('en-IN')}</strong></td></tr>
      <tr><td></td><td>Total Paid Till Date</td><td class="right">₹${paidAfter.toLocaleString('en-IN')}</td></tr>
      <tr><td></td><td><strong>Balance Due</strong></td><td class="right"><strong>₹${remaining.toLocaleString('en-IN')}</strong></td></tr>
    </tbody>
  </table>

  <div class="words-row">
    <strong>Amount in words:</strong> ${numberToWords(payment.amount)}
  </div>

  <div class="footer-section">
    <div class="left-note">* FEE IS NOT REFUNDABLE</div>
    <div class="right-sign">
      <div class="line"></div>
      <p>Authorised Signatory</p>
    </div>
  </div>
</div>
</body></html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  }
}

function generateStatementPDF(fee: StudentFee, orgInfo: OrgInfo) {
  const paidAmount = fee.payments.reduce((s, p) => s + p.amount, 0);
  const remaining = fee.finalAmount - paidAmount;

  let runningBalance = 0;
  const rows = fee.payments
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((p, i) => {
      runningBalance += p.amount;
      const balanceRemaining = fee.finalAmount - runningBalance;
      return `
        <tr>
          <td>${i + 1}</td>
          <td>${formatDate(p.date)}</td>
          <td>${p.mode}</td>
          <td class="credit">₹${p.amount.toLocaleString('en-IN')}</td>
          <td>₹${runningBalance.toLocaleString('en-IN')}</td>
          <td class="${balanceRemaining > 0 ? 'pending' : 'clear'}">₹${balanceRemaining.toLocaleString('en-IN')}</td>
        </tr>`;
    }).join('');

  const html = `
    <!DOCTYPE html>
    <html><head><title>Statement - ${fee.studentName}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #1a1a2e; background: #fff; }
      .header { border-bottom: 3px solid #4f46e5; padding-bottom: 20px; margin-bottom: 24px; }
      .header h1 { font-size: 22px; color: #4f46e5; }
      .header p { color: #666; font-size: 13px; margin-top: 4px; }
      .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
      .meta-box { background: #f8f9fa; padding: 14px 16px; border-radius: 8px; }
      .meta-box .label { font-size: 11px; text-transform: uppercase; color: #999; letter-spacing: 0.5px; margin-bottom: 4px; }
      .meta-box .value { font-size: 18px; font-weight: 700; }
      .meta-box .value.paid { color: #059669; }
      .meta-box .value.pending { color: #d97706; }
      .meta-box .value.total { color: #4f46e5; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
      th { background: #4f46e5; color: white; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
      td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
      tr:nth-child(even) { background: #f8f9fa; }
      .credit { color: #059669; font-weight: 600; }
      .pending { color: #d97706; font-weight: 600; }
      .clear { color: #059669; font-weight: 600; }
      .summary-bar { display: flex; gap: 0; margin-bottom: 24px; border-radius: 8px; overflow: hidden; height: 8px; }
      .summary-bar .paid-bar { background: #059669; }
      .summary-bar .pending-bar { background: #fbbf24; }
      .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 11px; }
      .empty { text-align: center; padding: 32px; color: #999; }
      @media print { body { padding: 20px; } }
    </style>
    </head><body>
      <div class="header">
        ${orgInfo.logoUrl ? `<img src="${orgInfo.logoUrl}" alt="Logo" style="max-height:60px;max-width:180px;margin-bottom:12px;" />` : ''}
        <h1>📊 STUDENT FEE STATEMENT</h1>
        <p>Complete payment history and balance statement</p>
      </div>

      <div class="meta">
        <div class="meta-box">
          <div class="label">Student Name</div>
          <div class="value">${fee.studentName}</div>
        </div>
        <div class="meta-box">
          <div class="label">Course</div>
          <div class="value">${fee.courseName}</div>
        </div>
        <div class="meta-box">
          <div class="label">Total Fee</div>
          <div class="value total">₹${fee.finalAmount.toLocaleString('en-IN')}</div>
        </div>
        <div class="meta-box">
          <div class="label">Total Paid</div>
          <div class="value paid">₹${paidAmount.toLocaleString('en-IN')}</div>
        </div>
      </div>

      <div class="summary-bar">
        <div class="paid-bar" style="width: ${fee.finalAmount > 0 ? (paidAmount / fee.finalAmount * 100) : 0}%"></div>
        <div class="pending-bar" style="width: ${fee.finalAmount > 0 ? (remaining / fee.finalAmount * 100) : 0}%"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#666;margin-bottom:24px;">
        <span>Paid: ₹${paidAmount.toLocaleString('en-IN')} (${fee.finalAmount > 0 ? Math.round(paidAmount / fee.finalAmount * 100) : 0}%)</span>
        <span>Balance: ₹${remaining.toLocaleString('en-IN')}</span>
      </div>

      ${fee.installmentCount > 0 ? `<p style="font-size:13px;color:#666;margin-bottom:16px;">Installment Plan: ${fee.payments.length} of ${fee.installmentCount} EMIs completed</p>` : ''}

      <table>
        <thead><tr><th>#</th><th>Date</th><th>Payment Mode</th><th>Amount Paid</th><th>Total Paid</th><th>Balance</th></tr></thead>
        <tbody>
          ${fee.payments.length === 0
            ? '<tr><td colspan="6" class="empty">No payments recorded yet</td></tr>'
            : rows
          }
        </tbody>
      </table>

      ${fee.dueDate ? `<p style="font-size:12px;color:#666;">Due Date: ${formatDate(fee.dueDate)} ${remaining > 0 && new Date(fee.dueDate) < new Date() ? '⚠️ OVERDUE' : ''}</p>` : ''}

      <div class="meta" style="margin-top:16px;">
        <div class="meta-box" style="border-left:4px solid #059669;">
          <div class="label">Total Paid</div>
          <div class="value paid">₹${paidAmount.toLocaleString('en-IN')}</div>
        </div>
        <div class="meta-box" style="border-left:4px solid ${remaining > 0 ? '#d97706' : '#059669'};">
          <div class="label">Balance Pending</div>
          <div class="value ${remaining > 0 ? 'pending' : 'paid'}">₹${remaining.toLocaleString('en-IN')}</div>
        </div>
      </div>

      <div class="footer">
        <p>Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })} • This is a computer-generated statement.</p>
      </div>
    </body></html>
  `;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  }
}

// ── Component ──────────────────────────────────────────────
export default function PaymentsPage() {
  const { user } = useAuth();
  const { currentBranchId, branches, isLoading: branchLoading, branchVersion } = useBranch();
  const { toast } = useToast();

  // === Transaction State ===
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  // === Student Fees State ===
  const [studentFees, setStudentFees] = useState<StudentFee[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [recurrenceFilter, setRecurrenceFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [feeSearch, setFeeSearch] = useState('');
  const [feeStatusFilter, setFeeStatusFilter] = useState('all');
  const [feeModeFilter, setFeeModeFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'income' | 'expense'>('income');

  // Record Payment dialog
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payingFeeId, setPayingFeeId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('UPI');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);

  // Due date dialog
  const [dueDateDialogOpen, setDueDateDialogOpen] = useState(false);
  const [dueDateFeeId, setDueDateFeeId] = useState<string | null>(null);
  const [newDueDate, setNewDueDate] = useState('');

  // Installment setup dialog
  const [installmentDialogOpen, setInstallmentDialogOpen] = useState(false);
  const [installmentFeeId, setInstallmentFeeId] = useState<string | null>(null);
  const [installmentCount, setInstallmentCount] = useState('3');

  // Form state
  const [formDesc, setFormDesc] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formMode, setFormMode] = useState('UPI');
  const [formRecurrence, setFormRecurrence] = useState<'one-time' | 'monthly'>('one-time');
  const [saving, setSaving] = useState(false);

  // Organization info for PDFs
  const [orgInfo, setOrgInfo] = useState<OrgInfo>({ name: '', address: '', phone: '', email: '', logoUrl: null });

  useEffect(() => {
    async function loadOrgInfo() {
      if (!user?.organizationId) return;
      // Load org info
      const { data: org } = await supabase.from('organizations').select('name, address, phone, email, logo_url, metadata').eq('id', user.organizationId).single();
      if (!org) return;
      let logoUrl = org.logo_url || null;
      let gstNumber = (org.metadata as any)?.gst_number || null;
      // Try branch logo override
      if (currentBranchId) {
        const { data: branch } = await supabase.from('branches').select('logo_url').eq('id', currentBranchId).single();
        if (branch?.logo_url) logoUrl = branch.logo_url;
      }
      // Convert logo URL to base64 data URL for reliable rendering in print windows
      let logoDataUrl: string | null = null;
      if (logoUrl) {
        try {
          const resp = await fetch(logoUrl);
          const blob = await resp.blob();
          logoDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          console.error('Failed to convert logo to base64:', e);
        }
      }
      setOrgInfo({
        name: org.name || '',
        address: org.address || '',
        phone: org.phone || '',
        email: org.email || '',
        logoUrl: logoDataUrl || logoUrl,
        gstNumber,
      });
    }
    loadOrgInfo();
  }, [currentBranchId, user?.organizationId]);

  // ── Load data from Supabase ──────────────────────────────
  const loadData = useCallback(async () => {
    if (!user?.organizationId) return;
    setLoading(true);
    try {
      // ── Load Transactions ──
      let txnQuery = supabase
        .from('transactions')
        .select('*')
        .eq('organization_id', user.organizationId)
        .order('date', { ascending: false });
      if (currentBranchId) {
        txnQuery = txnQuery.eq('branch_id', currentBranchId);
      }
      const { data: txnData, error: txnError } = await txnQuery;
      if (txnError) {
        console.error('Transactions query error:', txnError);
        toast({ title: 'Error loading transactions', description: txnError.message, variant: 'destructive' });
      }
      const loadedTxns: Transaction[] = (txnData || []).map((t: any) => ({
        id: t.id,
        type: t.type,
        description: t.description,
        amount: Number(t.amount),
        category: t.category,
        date: t.date,
        mode: t.mode,
        recurrence: t.recurrence || 'one-time',
        paused: t.paused || false,
        parentId: t.parent_id || undefined,
      }));
      setTransactions(loadedTxns);

      // ── Load Student Fees (from payments table) ──
      let feeQuery = supabase
        .from('payments')
        .select('*')
        .eq('organization_id', user.organizationId)
        .order('created_at', { ascending: false });
      if (currentBranchId) {
        feeQuery = feeQuery.eq('branch_id', currentBranchId);
      }
      const { data: feeData, error: feeError } = await feeQuery;
      if (feeError) {
        console.error('Payments query error:', feeError);
        toast({ title: 'Error loading student fees', description: feeError.message, variant: 'destructive' });
      }

      // Build student name map from profiles (for records without student_name)
      const studentIds = [...new Set((feeData || []).map((f: any) => f.student_id).filter(Boolean))];
      const studentNameMap: Record<string, string> = {};
      const studentNumberMap: Record<string, string> = {};
      const studentPhoneMap: Record<string, string> = {};
      if (studentIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, student_number')
          .in('id', studentIds);
        for (const p of profilesData || []) {
          studentNameMap[p.id] = p.full_name || 'Unknown';
          if ((p as any).student_number) studentNumberMap[p.id] = (p as any).student_number;
        }
        // Fetch student phone numbers from student_details
        const { data: detailsData } = await supabase
          .from('student_details')
          .select('student_id, mobile, whatsapp')
          .in('student_id', studentIds);
        for (const d of detailsData || []) {
          studentPhoneMap[d.student_id] = (d as any).whatsapp || d.mobile || '';
        }
      }

      // Load all fee_payments for these payment IDs
      const paymentIds = (feeData || []).map((f: any) => f.id);
      let feePaymentsMap: Record<string, StudentFeePayment[]> = {};
      if (paymentIds.length > 0) {
        const { data: fpData, error: fpError } = await supabase
          .from('fee_payments')
          .select('*')
          .in('payment_id', paymentIds)
          .order('date', { ascending: true });
        if (fpError) {
          console.error('Fee payments query error:', fpError);
        }
        for (const fp of fpData || []) {
          if (!feePaymentsMap[fp.payment_id]) feePaymentsMap[fp.payment_id] = [];
          feePaymentsMap[fp.payment_id].push({
            id: fp.id,
            amount: Number(fp.amount),
            date: fp.date,
            mode: fp.mode || 'Cash',
          });
        }
      }

      // Fetch enrollment numbers for payments linked to enrollments
      const enrollmentIds = [...new Set((feeData || []).map((f: any) => f.enrollment_id).filter(Boolean))];
      const enrollmentNumberMap: Record<string, string> = {};
      if (enrollmentIds.length > 0) {
        const { data: enrollData } = await supabase
          .from('student_enrollments')
          .select('id, enrollment_number')
          .in('id', enrollmentIds);
        for (const e of enrollData || []) {
          enrollmentNumberMap[e.id] = e.enrollment_number;
        }
      }

      // Build batch name map from student metadata.batch_id
      const studentBatchMap: Record<string, string> = {};
      if (studentIds.length > 0) {
        const { data: profilesWithMeta } = await supabase
          .from('profiles')
          .select('id, metadata')
          .in('id', studentIds);
        const allBatchIds: string[] = [];
        for (const p of profilesWithMeta || []) {
          const meta = p.metadata as any;
          const batchId = meta?.batch_id || meta?.batchId || meta?.batch || null;
          if (batchId) allBatchIds.push(batchId);
        }
        if (allBatchIds.length > 0) {
          const { data: batchesData } = await supabase
            .from('batches')
            .select('id, name')
            .in('id', [...new Set(allBatchIds)]);
          const batchNameMap: Record<string, string> = {};
          for (const b of batchesData || []) batchNameMap[b.id] = b.name;
          for (const p of profilesWithMeta || []) {
            const meta = p.metadata as any;
            const batchId = meta?.batch_id || meta?.batchId || meta?.batch || null;
            if (batchId && batchNameMap[batchId]) studentBatchMap[p.id] = batchNameMap[batchId];
          }
        }
      }

      // Build branch name map from payment branch_id
      const branchIds = [...new Set((feeData || []).map((f: any) => f.branch_id).filter(Boolean))];
      const branchNameMap: Record<string, string> = {};
      if (branchIds.length > 0) {
        const { data: branchesData } = await supabase
          .from('branches')
          .select('id, name')
          .in('id', branchIds);
        for (const b of branchesData || []) branchNameMap[b.id] = b.name;
      }

      const loadedFees: StudentFee[] = (feeData || []).map((f: any) => ({
        id: f.id,
        studentId: f.student_id,
        studentName: f.student_name || (f.student_id ? studentNameMap[f.student_id] : null) || 'Unknown Student',
        studentNumber: f.student_id ? studentNumberMap[f.student_id] : null,
        enrollmentId: f.enrollment_id ? enrollmentNumberMap[f.enrollment_id] || f.enrollment_id : null,
        courseName: f.course_name || (f.notes ? f.notes.replace(/^Course:\s*/, '').split('|')[0].trim() : 'Unknown Course'),
        batchName: f.student_id ? studentBatchMap[f.student_id] || null : null,
        branchName: f.branch_id ? branchNameMap[f.branch_id] || null : null,
        totalFee: Number(f.total_fee || f.amount || 0),
        discountAmount: Number(f.discount_amount || 0),
        finalAmount: Number(f.amount || 0),
        dueDate: f.due_date || '',
        payments: feePaymentsMap[f.id] || [],
        status: f.status === 'completed' ? 'paid' : (f.status as any) || 'pending',
        installmentCount: f.installment_count || 0,
        createdAt: f.created_at,
        studentPhone: f.student_id ? studentPhoneMap[f.student_id] : null,
      }));
      setStudentFees(loadedFees);
    } catch (err: any) {
      console.error('Failed to load payments data:', err);
      toast({ title: 'Error', description: err?.message || 'Failed to load payments data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user?.organizationId, currentBranchId]);

  useEffect(() => {
    loadData();
  }, [loadData, branchVersion]);

  // === Transaction Handlers ===
  const openDialog = useCallback((type: 'income' | 'expense') => {
    setDialogType(type);
    setFormDesc('');
    setFormAmount('');
    setFormCategory('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormMode('UPI');
    setFormRecurrence('one-time');
    setDialogOpen(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!formDesc || !formAmount || !formCategory || !user?.organizationId) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from('transactions').insert({
        organization_id: user.organizationId,
        branch_id: currentBranchId || null,
        type: dialogType,
        description: formDesc,
        amount: parseFloat(formAmount),
        category: formCategory,
        date: new Date(formDate).toISOString(),
        mode: formMode,
        recurrence: formRecurrence,
        paused: false,
        created_by: user.id,
        sales_staff_id: user.role === 'sales_staff' ? user.id : null,
      }).select().single();

      if (error) throw error;

      const newTxn: Transaction = {
        id: data.id,
        type: data.type,
        description: data.description,
        amount: Number(data.amount),
        category: data.category,
        date: data.date,
        mode: data.mode,
        recurrence: data.recurrence,
        paused: false,
      };
      setTransactions(prev => [newTxn, ...prev]);
      setDialogOpen(false);
      toast({ title: 'Success', description: `${dialogType === 'income' ? 'Income' : 'Expense'} recorded successfully` });
    } catch (err) {
      console.error('Failed to save transaction:', err);
      toast({ title: 'Error', description: 'Failed to save transaction', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [formDesc, formAmount, formCategory, formDate, formMode, formRecurrence, dialogType, user?.organizationId, user?.id, user?.role, currentBranchId]);

  const handlePauseToggle = useCallback(async (id: string) => {
    const txn = transactions.find(t => t.id === id);
    if (!txn) return;
    try {
      await supabase.from('transactions').update({ paused: !txn.paused }).eq('id', id);
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, paused: !t.paused } : t));
    } catch (err) {
      console.error('Failed to toggle pause:', err);
    }
  }, [transactions]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await supabase.from('transactions').delete().eq('id', id);
      // Also delete children
      await supabase.from('transactions').delete().eq('parent_id', id);
      setTransactions(prev => prev.filter(t => t.id !== id && t.parentId !== id));
      toast({ title: 'Deleted', description: 'Transaction deleted' });
    } catch (err) {
      console.error('Failed to delete transaction:', err);
    }
  }, []);

  // === Student Fee Handlers ===
  const openPayDialog = (feeId: string) => {
    setPayingFeeId(feeId);
    setPayAmount('');
    setPayMode('UPI');
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayDialogOpen(true);
  };

  const handleRecordPayment = async () => {
    if (!payingFeeId || !payAmount || !user?.organizationId) return;
    const amt = parseFloat(payAmount);
    if (amt <= 0) return;
    setSaving(true);

    const fee = studentFees.find(f => f.id === payingFeeId);
    if (!fee) { setSaving(false); return; }

    try {
      // 1. Insert fee_payment record
      const { data: fpData, error: fpError } = await supabase.from('fee_payments').insert({
        payment_id: payingFeeId,
        organization_id: user.organizationId,
        amount: amt,
        date: payDate,
        mode: payMode,
        sales_staff_id: user.role === 'sales_staff' ? user.id : null,
      }).select().single();

      if (fpError) throw fpError;

      // 2. Update the parent payments record
      const totalPaidBefore = fee.payments.reduce((s, p) => s + p.amount, 0);
      const newTotalPaid = totalPaidBefore + amt;
      const newStatus = newTotalPaid >= fee.finalAmount ? 'completed' : 'partial';

      await supabase.from('payments').update({
        amount_paid: newTotalPaid,
        status: newStatus,
        payment_method: payMode,
        updated_at: new Date().toISOString(),
      }).eq('id', payingFeeId);

      // 3. Also add as income transaction
      await supabase.from('transactions').insert({
        organization_id: user.organizationId,
        branch_id: currentBranchId || null,
        type: 'income',
        description: `Fee Payment: ${fee.courseName} — ${fee.studentName}`,
        amount: amt,
        category: 'Course Fee',
        date: new Date(payDate).toISOString(),
        mode: payMode,
        recurrence: 'one-time',
        paused: false,
        created_by: user.id,
        sales_staff_id: user.role === 'sales_staff' ? user.id : null,
      });

      // 4. Update local state
      const newPayment: StudentFeePayment = {
        id: fpData.id,
        amount: amt,
        date: payDate,
        mode: payMode,
      };
      setStudentFees(prev => prev.map(f => {
        if (f.id !== payingFeeId) return f;
        const updatedPayments = [...f.payments, newPayment];
        return { ...f, payments: updatedPayments, status: newTotalPaid >= f.finalAmount ? 'paid' : 'partial' };
      }));

      // Also refresh transactions to show the new income
      const { data: txnData } = await supabase
        .from('transactions')
        .select('*')
        .eq('organization_id', user.organizationId)
        .order('date', { ascending: false })
        .limit(200);
      if (txnData) {
        setTransactions(txnData.map((t: any) => ({
          id: t.id, type: t.type, description: t.description,
          amount: Number(t.amount), category: t.category, date: t.date,
          mode: t.mode, recurrence: t.recurrence || 'one-time',
          paused: t.paused || false, parentId: t.parent_id || undefined,
        })));
      }

      // Send WhatsApp receipt
      if (fee.studentPhone) {
        const remainingAfterPayment = Math.max(fee.finalAmount - newTotalPaid, 0);
        try {
          await sendFeeReceipt({
            to: fee.studentPhone,
            studentName: fee.studentName,
            courseName: fee.courseName,
            paidAmount: amt,
            paymentDate: payDate,
            remainingAmount: remainingAfterPayment,
          });
        } catch (waErr) {
          console.error('WhatsApp receipt failed:', waErr);
        }
      }

      setPayDialogOpen(false);
      toast({ title: 'Payment Recorded', description: `${formatCurrency(amt)} payment recorded for ${fee.studentName}` });
    } catch (err) {
      console.error('Failed to record payment:', err);
      toast({ title: 'Error', description: 'Failed to record payment. Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Send fee reminder via WhatsApp
  const handleSendFeeReminder = async (fee: StudentFee) => {
    if (!fee.studentPhone) {
      toast({ title: 'Error', description: 'Student phone number is missing', variant: 'destructive' });
      return;
    }
    const paidAmount = fee.payments.reduce((s, p) => s + p.amount, 0);
    const remaining = fee.finalAmount - paidAmount;
    try {
      await sendFeeReminder({
        to: fee.studentPhone,
        studentName: fee.studentName,
        courseName: fee.courseName,
        dueAmount: remaining,
        dueDate: fee.dueDate || null,
      });
      toast({ title: 'Reminder Sent', description: `Fee reminder sent to ${fee.studentName}` });
    } catch (err) {
      console.error('Failed to send fee reminder:', err);
      toast({ title: 'Error', description: 'Failed to send fee reminder', variant: 'destructive' });
    }
  };

  const openDueDateDialog = (feeId: string) => {
    const fee = studentFees.find(f => f.id === feeId);
    setDueDateFeeId(feeId);
    setNewDueDate(fee?.dueDate || '');
    setDueDateDialogOpen(true);
  };

  const handleSetDueDate = async () => {
    if (!dueDateFeeId) return;
    try {
      await supabase.from('payments').update({ due_date: newDueDate || null }).eq('id', dueDateFeeId);
      setStudentFees(prev => prev.map(fee =>
        fee.id === dueDateFeeId ? { ...fee, dueDate: newDueDate } : fee
      ));
      setDueDateDialogOpen(false);
    } catch (err) {
      console.error('Failed to set due date:', err);
    }
  };

  const handleDeleteFee = async (feeId: string) => {
    try {
      await supabase.from('fee_payments').delete().eq('payment_id', feeId);
      await supabase.from('payments').delete().eq('id', feeId);
      setStudentFees(prev => prev.filter(f => f.id !== feeId));
      toast({ title: 'Deleted', description: 'Fee record deleted' });
    } catch (err) {
      console.error('Failed to delete fee:', err);
    }
  };

  // === Installment Setup ===
  const openInstallmentDialog = (feeId: string) => {
    const fee = studentFees.find(f => f.id === feeId);
    setInstallmentFeeId(feeId);
    setInstallmentCount(String(fee?.installmentCount || 3));
    setInstallmentDialogOpen(true);
  };

  const handleSetInstallments = async () => {
    if (!installmentFeeId) return;
    const count = parseInt(installmentCount) || 0;
    try {
      await supabase.from('payments').update({ installment_count: count }).eq('id', installmentFeeId);
      setStudentFees(prev => prev.map(f =>
        f.id === installmentFeeId ? { ...f, installmentCount: count } : f
      ));
      setInstallmentDialogOpen(false);
      toast({ title: 'Updated', description: `Set ${count} installments` });
    } catch (err) {
      console.error('Failed to set installments:', err);
    }
  };

  // === Filtered Data ===
  const filtered = transactions
    .filter((t) => {
      const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === 'all' || t.type === typeFilter;
      const matchesRecurrence = recurrenceFilter === 'all' || t.recurrence === recurrenceFilter;
      const matchesDateFrom = !dateFrom || t.date >= dateFrom;
      const matchesDateTo = !dateTo || t.date <= dateTo;
      return matchesSearch && matchesType && matchesRecurrence && matchesDateFrom && matchesDateTo;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredFees = studentFees
    .filter(f => {
      const matchesSearch = f.studentName.toLowerCase().includes(feeSearch.toLowerCase()) ||
        f.courseName.toLowerCase().includes(feeSearch.toLowerCase()) ||
        (f.enrollmentId || '').toLowerCase().includes(feeSearch.toLowerCase()) ||
        (f.studentNumber || '').toLowerCase().includes(feeSearch.toLowerCase());
      const matchesStatus = feeStatusFilter === 'all' || f.status === feeStatusFilter;
      const matchesMode =
        feeModeFilter === 'all' ||
        f.payments.some((payment) => payment.mode === feeModeFilter);
      const matchesDateFrom = !dateFrom || f.createdAt >= dateFrom;
      const matchesDateTo = !dateTo || f.createdAt <= dateTo;
      return matchesSearch && matchesStatus && matchesMode && matchesDateFrom && matchesDateTo;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // === Stats ===
  const totalIncome = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const netBalance = totalIncome - totalExpense;
  const recurringCount = transactions.filter((t) => t.recurrence === 'monthly' && !t.parentId).length;

  const totalFees = studentFees.reduce((s, f) => s + f.finalAmount, 0);
  const totalCollected = studentFees.reduce((s, f) => s + f.payments.reduce((ps, p) => ps + p.amount, 0), 0);
  const totalPending = totalFees - totalCollected;
  const overdueCount = studentFees.filter(f => f.dueDate && new Date(f.dueDate) < new Date() && f.status !== 'paid').length;

  const categories = dialogType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleExport = useCallback(() => {
    const headers = ['Date', 'Type', 'Description', 'Category', 'Amount', 'Mode', 'Recurrence'];
    const rows = filtered.map((t) => [
      formatDate(t.date),
      t.type,
      t.description,
      t.category,
      t.amount.toString(),
      t.mode,
      t.recurrence,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  const handleExportFees = useCallback(() => {
    const headers = ['Student', 'Student ID', 'Course', 'Enrollment ID', 'Total Fee', 'Discount', 'Final Amount', 'Paid', 'Remaining', 'Due Date', 'Status'];
    const rows = filteredFees.map((f) => {
      const paid = f.payments.reduce((s, p) => s + p.amount, 0);
      return [f.studentName, f.studentNumber || '', f.courseName, f.enrollmentId || '', f.totalFee, f.discountAmount, f.finalAmount, paid, f.finalAmount - paid, f.dueDate || '', f.status];
    });
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `student_fees_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredFees]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Payments
          </h1>
          <p className="text-muted-foreground mt-1">
            Track income, expenses, and student fee collections
          </p>
        </div>
      </div>

      <Tabs defaultValue="transactions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="transactions" className="flex items-center gap-2">
            <Wallet className="w-4 h-4" /> Income & Expenses
          </TabsTrigger>
          <TabsTrigger value="student-fees" className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> Student Fees
            {totalPending > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs px-1.5 py-0">
                {studentFees.filter(f => f.status !== 'paid').length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════ INCOME & EXPENSES TAB ═══════════════ */}
        <TabsContent value="transactions" className="space-y-6">
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />Export
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => openDialog('income')}>
              <ArrowUpCircle className="w-4 h-4 mr-2" /> + Income
            </Button>
            <Button className="bg-rose-600 hover:bg-rose-700 text-white" onClick={() => openDialog('expense')}>
              <ArrowDownCircle className="w-4 h-4 mr-2" /> + Expense
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Income</p>
                    <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalIncome)}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Expense</p>
                    <p className="text-2xl font-bold text-rose-600">{formatCurrency(totalExpense)}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center">
                    <TrendingDown className="w-6 h-6 text-rose-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Net Balance</p>
                    <p className={`text-2xl font-bold ${netBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {formatCurrency(netBalance)}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Wallet className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Monthly Recurring</p>
                    <p className="text-2xl font-bold text-violet-600">{recurringCount}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
                    <ReceiptText className="w-6 h-6 text-violet-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters & Table */}
          <Card className="border shadow-card">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search transactions..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-40"><Filter className="w-4 h-4 mr-2" /><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={recurrenceFilter} onValueChange={setRecurrenceFilter}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Recurrence" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="one-time">One-time</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Date Range Filter */}
              <div className="flex flex-col sm:flex-row gap-3 mt-3 items-end">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">From:</span>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40 h-9" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">To:</span>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40 h-9" />
                </div>
                {(dateFrom || dateTo) && (
                  <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setDateFrom(''); setDateTo(''); }}>
                    Clear Dates
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="hidden md:table-cell">Mode</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Recurrence</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <DollarSign className="w-10 h-10 text-muted-foreground/40" />
                            <p>No transactions yet. Click <strong>+ Income</strong> or <strong>+ Expense</strong> to add one.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    {filtered.map((txn, index) => {
                      const isParent = txn.recurrence === 'monthly' && !txn.parentId;
                      return (
                        <TableRow key={txn.id} className={`animate-fade-in ${txn.paused ? 'opacity-50' : ''}`} style={{ animationDelay: `${index * 30}ms` }}>
                          <TableCell className="text-muted-foreground text-sm">{formatDate(txn.date)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {txn.type === 'income' ? <ArrowUpCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <ArrowDownCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />}
                              <span className="font-medium text-foreground">{txn.description}</span>
                              {txn.paused && <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Paused</Badge>}
                            </div>
                          </TableCell>
                          <TableCell><Badge variant="outline">{txn.category}</Badge></TableCell>
                          <TableCell className={`text-right font-semibold ${txn.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {txn.type === 'income' ? '+' : '-'}{formatCurrency(txn.amount)}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">{txn.mode}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={txn.type === 'income' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border-rose-500/20'}>
                              {txn.type === 'income' ? 'Income' : 'Expense'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={txn.recurrence === 'monthly' ? 'bg-violet-500/10 text-violet-600 border-violet-500/20' : 'bg-muted text-muted-foreground'}>
                              {txn.recurrence === 'monthly' ? 'Monthly' : 'One-time'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {isParent && (
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePauseToggle(txn.id)} title={txn.paused ? 'Resume' : 'Pause'}>
                                  {txn.paused ? <Play className="w-4 h-4 text-emerald-600" /> : <Pause className="w-4 h-4 text-yellow-600" />}
                                </Button>
                              )}
                              {!txn.parentId && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(txn.id)} title="Delete">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════ STUDENT FEES TAB ═══════════════ */}
        <TabsContent value="student-fees" className="space-y-6">
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleExportFees}>
              <Download className="w-4 h-4 mr-2" />Export Fees
            </Button>
          </div>

          {/* Fee Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Fees</p>
                    <p className="text-2xl font-bold text-primary">{formatCurrency(totalFees)}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <IndianRupee className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Collected</p>
                    <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalCollected)}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-2xl font-bold text-amber-600">{formatCurrency(totalPending)}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Overdue</p>
                    <p className="text-2xl font-bold text-rose-600">{overdueCount}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-rose-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Fee Filters & Table */}
          <Card className="border shadow-card">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search by student or course..." value={feeSearch} onChange={(e) => setFeeSearch(e.target.value)} className="pl-10" />
                </div>
                <Select value={feeStatusFilter} onValueChange={setFeeStatusFilter}>
                  <SelectTrigger className="w-44"><Filter className="w-4 h-4 mr-2" /><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={feeModeFilter} onValueChange={setFeeModeFilter}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Payment Mode" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modes</SelectItem>
                    {PAYMENT_MODES.map((mode) => (
                      <SelectItem key={mode} value={mode}>{mode}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Student</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead className="text-right">Fee</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-48">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFees.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <CreditCard className="w-10 h-10 text-muted-foreground/40" />
                            <p>No student fees yet. Add a student with a course to generate fee records.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredFees.map((fee, index) => {
                      const paidAmount = fee.payments.reduce((s, p) => s + p.amount, 0);
                      const remaining = fee.finalAmount - paidAmount;
                      const isOverdue = fee.dueDate && new Date(fee.dueDate) < new Date() && remaining > 0;
                      return (
                        <TableRow key={fee.id} className="animate-fade-in" style={{ animationDelay: `${index * 30}ms` }}>
                          <TableCell>
                            <div>
                              <span className="font-medium text-foreground">{fee.studentName}</span>
                              {fee.studentNumber && (
                                <span className="block text-xs font-mono text-violet-600">{fee.studentNumber}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            <div>
                              <span>{fee.courseName}</span>
                              {fee.enrollmentId && (
                                <span className="block text-xs font-mono text-indigo-600">{fee.enrollmentId}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div>
                              <span className="font-semibold">{formatCurrency(fee.finalAmount)}</span>
                              {fee.discountAmount > 0 && (
                                <span className="block text-xs text-emerald-600">-{formatCurrency(fee.discountAmount)} disc.</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-emerald-600">
                            {formatCurrency(paidAmount)}
                          </TableCell>
                          <TableCell className={`text-right font-semibold ${remaining > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {formatCurrency(remaining)}
                          </TableCell>
                          <TableCell>
                            <button
                              onClick={() => openDueDateDialog(fee.id)}
                              className="flex items-center gap-1 text-sm hover:underline cursor-pointer"
                            >
                              <CalendarDays className="w-3.5 h-3.5" />
                              {fee.dueDate ? (
                                <span className={isOverdue ? 'text-rose-600 font-medium' : ''}>{formatDate(fee.dueDate)} {isOverdue && '⚠️'}</span>
                              ) : (
                                <span className="text-muted-foreground">Set date</span>
                              )}
                            </button>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              fee.status === 'paid' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                : fee.status === 'partial' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                  : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                            }>
                              {fee.status === 'paid' ? 'Paid' : fee.status === 'partial' ? 'Partial' : 'Pending'}
                            </Badge>
                            {fee.installmentCount > 0 && (
                              <span className="block text-xs text-muted-foreground mt-0.5">
                                {fee.payments.length}/{fee.installmentCount} EMIs
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 flex-wrap">
                              {fee.status !== 'paid' && (
                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openPayDialog(fee.id)}>
                                  <IndianRupee className="w-3 h-3 mr-1" /> Pay
                                </Button>
                              )}
                              {fee.status !== 'paid' && fee.studentPhone && (
                                <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600" onClick={() => handleSendFeeReminder(fee)} title="Send WhatsApp reminder">
                                  <MessageCircle className="w-3 h-3 mr-1" /> Remind
                                </Button>
                              )}
                              {fee.status !== 'paid' && (
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openInstallmentDialog(fee.id)} title="Set installments">
                                  <CalendarDays className="w-3 h-3 mr-1" /> EMI
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => generateInvoicePDF(fee, orgInfo)} title="Download Invoice">
                                <FileText className="w-3 h-3 mr-1" /> Invoice
                              </Button>
                              {fee.payments.length > 0 && (
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => generateReceiptPDF(fee, fee.payments[fee.payments.length - 1], fee.payments.length - 1, orgInfo)} title="Download latest receipt">
                                  <ReceiptText className="w-3 h-3 mr-1" /> Receipt
                                </Button>
                              )}
                              {fee.payments.length > 0 && (
                                <Button variant="ghost" size="sm" className="h-7 text-xs text-primary" onClick={() => generateStatementPDF(fee, orgInfo)} title="Download fee statement">
                                  <FileText className="w-3 h-3 mr-1" /> Statement
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteFee(fee.id)} title="Delete">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Payment history expandable section */}
              {filteredFees.filter(f => f.payments.length > 0).length > 0 && (
                <div className="mt-6 space-y-4">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <ReceiptText className="w-4 h-4" /> Recent Payment Receipts
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredFees.flatMap(fee =>
                      fee.payments.map((p, i) => ({ fee, payment: p, index: i }))
                    ).sort((a, b) => new Date(b.payment.date).getTime() - new Date(a.payment.date).getTime())
                      .slice(0, 9)
                      .map(({ fee, payment, index }) => (
                        <Card key={payment.id} className="border hover:shadow-md transition-shadow cursor-pointer" onClick={() => generateReceiptPDF(fee, payment, index, orgInfo)}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">{fee.studentName}</p>
                                <p className="text-xs text-muted-foreground">{fee.courseName} • {formatDate(payment.date)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-emerald-600">{formatCurrency(payment.amount)}</p>
                                <p className="text-xs text-muted-foreground">{payment.mode}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    }
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══════ Add Transaction Dialog ═══════ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {dialogType === 'income' ? <ArrowUpCircle className="w-5 h-5 text-emerald-600" /> : <ArrowDownCircle className="w-5 h-5 text-rose-600" />}
              Add {dialogType === 'income' ? 'Income' : 'Expense'}
            </DialogTitle>
            <DialogDescription>
              Fill in the details to record a new {dialogType} transaction.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="txn-desc">Description *</Label>
              <Input id="txn-desc" placeholder={dialogType === 'income' ? 'e.g. Monthly Salary' : 'e.g. Netflix Subscription'} value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="txn-amount">Amount (₹) *</Label>
                <Input id="txn-amount" type="number" min="0" placeholder="0" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="txn-date">Date</Label>
                <Input id="txn-date" type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Payment Mode</Label>
                <Select value={formMode} onValueChange={setFormMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Recurrence</Label>
              <Select value={formRecurrence} onValueChange={(v) => setFormRecurrence(v as 'one-time' | 'monthly')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="one-time">One-time</SelectItem>
                  <SelectItem value="monthly">Monthly (Salary / Subscription)</SelectItem>
                </SelectContent>
              </Select>
              {formRecurrence === 'monthly' && (
                <p className="text-xs text-muted-foreground">This entry will automatically repeat every month. You can pause it anytime.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!formDesc || !formAmount || !formCategory || saving}
              className={dialogType === 'income' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'}>
              <Plus className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : `Add ${dialogType === 'income' ? 'Income' : 'Expense'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════ Record Payment Dialog ═══════ */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-emerald-600" /> Record Payment
            </DialogTitle>
            <DialogDescription>
              {(() => {
                const fee = studentFees.find(f => f.id === payingFeeId);
                if (!fee) return 'Record an installment payment';
                const paid = fee.payments.reduce((s, p) => s + p.amount, 0);
                const rem = fee.finalAmount - paid;
                const emiInfo = fee.installmentCount > 0
                  ? ` • EMI ${fee.payments.length + 1}/${fee.installmentCount}`
                  : '';
                return `${fee.studentName} • ${fee.courseName}${emiInfo} — Remaining: ${formatCurrency(rem)}`;
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Show suggested EMI amount */}
            {(() => {
              const fee = studentFees.find(f => f.id === payingFeeId);
              if (!fee || fee.installmentCount <= 0) return null;
              const paid = fee.payments.reduce((s, p) => s + p.amount, 0);
              const remaining = fee.finalAmount - paid;
              const remainingEMIs = Math.max(fee.installmentCount - fee.payments.length, 1);
              const suggestedAmount = Math.ceil(remaining / remainingEMIs);
              return (
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Suggested EMI amount: <strong>{formatCurrency(suggestedAmount)}</strong>
                    <span className="ml-2">({remainingEMIs} EMIs remaining)</span>
                  </p>
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs text-blue-600"
                    onClick={() => setPayAmount(suggestedAmount.toString())}>
                    Use suggested amount
                  </Button>
                </div>
              );
            })()}
            <div className="space-y-2">
              <Label>Amount (₹) *</Label>
              <Input type="number" min="0" placeholder="Enter payment amount" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment Date</Label>
                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Mode</Label>
                <Select value={payMode} onValueChange={setPayMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleRecordPayment} disabled={!payAmount || saving}>
              <Plus className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════ Set Due Date Dialog ═══════ */}
      <Dialog open={dueDateDialogOpen} onOpenChange={setDueDateDialogOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" /> Set Due Date
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDueDateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSetDueDate}>Save Due Date</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════ Installment Setup Dialog ═══════ */}
      <Dialog open={installmentDialogOpen} onOpenChange={setInstallmentDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" /> Setup Installments (EMI)
            </DialogTitle>
            <DialogDescription>
              {(() => {
                const fee = studentFees.find(f => f.id === installmentFeeId);
                if (!fee) return 'Set the number of installments for this fee';
                const paid = fee.payments.reduce((s, p) => s + p.amount, 0);
                const remaining = fee.finalAmount - paid;
                const count = parseInt(installmentCount) || 1;
                const emi = Math.ceil(remaining / count);
                return `${fee.studentName} • Remaining: ${formatCurrency(remaining)} → ${formatCurrency(emi)}/EMI × ${count}`;
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Number of Installments</Label>
              <Input type="number" min="1" max="36" value={installmentCount} onChange={(e) => setInstallmentCount(e.target.value)} />
            </div>
            {(() => {
              const fee = studentFees.find(f => f.id === installmentFeeId);
              if (!fee) return null;
              const paid = fee.payments.reduce((s, p) => s + p.amount, 0);
              const remaining = fee.finalAmount - paid;
              const count = parseInt(installmentCount) || 1;
              const emi = Math.ceil(remaining / count);
              return (
                <div className="bg-muted rounded-lg p-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Fee</span>
                    <span className="font-medium">{formatCurrency(fee.finalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Already Paid</span>
                    <span className="font-medium text-emerald-600">{formatCurrency(paid)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Remaining</span>
                    <span className="font-medium text-amber-600">{formatCurrency(remaining)}</span>
                  </div>
                  <hr className="my-1" />
                  <div className="flex justify-between text-sm font-semibold">
                    <span>EMI Amount</span>
                    <span className="text-primary">{formatCurrency(emi)} × {count}</span>
                  </div>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInstallmentDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSetInstallments}>Save Installments</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
