import React, { useState } from 'react';
import {
  X,
  CreditCard,
  CheckCircle2,
  Phone,
  Receipt,
  DollarSign,
  Calendar,
  Save,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useSchool } from '../../context/SchoolContext';
import { Student } from '../../types';
import { getTodayDateString, generateReceiptNumber } from '../../utils/helpers';
import { openWhatsAppFeeMessage } from '../../utils/whatsapp';

interface CollectFeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
}

export const CollectFeeModal: React.FC<CollectFeeModalProps> = ({
  isOpen,
  onClose,
  student,
}) => {
  const { db, recordFeePayment } = useSchool();

  if (!isOpen || !student) return null;

  const feeAccount = db.feeAccounts.find(fa => fa.studentId === student.id) || {
    id: `fee_${student.id}`,
    studentId: student.id,
    studentName: student.name,
    rollNumber: student.rollNumber,
    classId: student.classId,
    className: student.className,
    totalFee: 24000,
    paidAmount: 0,
    dueAmount: 24000,
    status: 'due' as const,
  };

  const [amount, setAmount] = useState<number>(feeAccount.dueAmount || 5000);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Online' | 'Cheque'>('UPI');
  const [paymentDate, setPaymentDate] = useState(getTodayDateString());
  const [notes, setNotes] = useState('');
  const [receiptNumber] = useState(generateReceiptNumber());
  const [sendWhatsAppOnSuccess, setSendWhatsAppOnSuccess] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;

    recordFeePayment({
      studentId: student.id,
      amount: Number(amount),
      paymentMethod,
      receiptNumber,
      notes,
      paymentDate,
    });

    try {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.7 },
      });
    } catch {}

    if (sendWhatsAppOnSuccess && student.parentPhone) {
      // Updated fee account simulated for instant receipt
      const updatedAccount = {
        ...feeAccount,
        paidAmount: feeAccount.paidAmount + amount,
        dueAmount: Math.max(0, feeAccount.dueAmount - amount),
      };
      openWhatsAppFeeMessage(db.schoolInfo, student, updatedAccount);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600 p-5 text-white shrink-0">
          <div className="flex items-center space-x-2">
            <CreditCard className="h-6 w-6" />
            <div>
              <h3 className="text-base font-black">Collect Fee Payment</h3>
              <p className="text-[11px] text-emerald-100">{student.name} • {student.className}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-white/20 p-1.5 text-white hover:bg-white/30"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {/* Current Fee Overview */}
          <div className="rounded-2xl bg-emerald-50/70 p-4 border border-emerald-100 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Total Billed Fee:</span>
              <span className="font-bold text-slate-800">
                ₹{(feeAccount.totalFee || 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Already Paid:</span>
              <span className="font-bold text-emerald-700">
                ₹{(feeAccount.paidAmount || 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between text-xs pt-1 border-t border-emerald-200/60 font-black">
              <span className="text-slate-800">Outstanding Due:</span>
              <span className="text-rose-600 text-sm">
                ₹{(feeAccount.dueAmount || 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Amount to Pay with fast presets */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Payment Amount (₹) *
            </label>
            <input
              type="number"
              required
              min={1}
              max={feeAccount.dueAmount || 100000}
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              placeholder="5000"
              className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-base font-black text-slate-900 focus:border-emerald-500 focus:outline-none"
            />

            {feeAccount.dueAmount > 0 && (
              <div className="mt-2 flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setAmount(feeAccount.dueAmount)}
                  className="rounded-lg bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-800 hover:bg-emerald-200"
                >
                  Pay Full Due (₹{feeAccount.dueAmount})
                </button>
                <button
                  type="button"
                  onClick={() => setAmount(Math.round(feeAccount.dueAmount / 2))}
                  className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-200"
                >
                  Pay Half (₹{Math.round(feeAccount.dueAmount / 2)})
                </button>
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Payment Method *
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['UPI', 'Cash', 'Online', 'Cheque'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPaymentMethod(mode)}
                  className={`rounded-xl py-2 text-xs font-bold transition-all ${
                    paymentMethod === mode
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Receipt Number
              </label>
              <input
                type="text"
                disabled
                value={receiptNumber}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 px-3 text-xs font-mono font-bold text-slate-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Payment Date
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs font-bold text-slate-800 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Remarks / Transaction ID
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. GooglePay Ref: 394829381"
              className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs font-medium text-slate-800 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* WhatsApp toggle */}
          {student.parentPhone && (
            <label className="flex items-center space-x-2 rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-900 cursor-pointer border border-emerald-200">
              <input
                type="checkbox"
                checked={sendWhatsAppOnSuccess}
                onChange={e => setSendWhatsAppOnSuccess(e.target.checked)}
                className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <div className="flex items-center space-x-1.5">
                <Phone className="h-3.5 w-3.5 text-emerald-600" />
                <span>Open WhatsApp receipt to parent on submit</span>
              </div>
            </label>
          )}

          <div className="pt-2">
            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-xs font-black text-white shadow-lg shadow-emerald-600/25 hover:from-emerald-700 hover:to-teal-700 active:scale-95 transition-all flex items-center justify-center space-x-2"
            >
              <Save className="h-4 w-4" />
              <span>CONFIRM & RECORD PAYMENT (₹{amount})</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
