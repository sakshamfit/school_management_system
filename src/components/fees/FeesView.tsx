import React, { useState, useMemo } from 'react';
import {
  CreditCard,
  Phone,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Filter,
  DollarSign,
  Receipt,
  Download,
  Share2,
  Printer,
} from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';
import { Student } from '../../types';
import { formatDate } from '../../utils/helpers';
import { openWhatsAppFeeMessage } from '../../utils/whatsapp';

interface FeesViewProps {
  onSelectStudent: (studentId: string) => void;
  onOpenCollectFee: (student: Student) => void;
}

export const FeesView: React.FC<FeesViewProps> = ({
  onSelectStudent,
  onOpenCollectFee,
}) => {
  const { db } = useSchool();
  const [activeTab, setActiveTab] = useState<'accounts' | 'transactions'>('accounts');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'due' | 'partial' | 'paid'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Overall Financial Statistics
  const totalBilled = db.feeAccounts.reduce((acc, curr) => acc + (curr.totalFee || 0), 0);
  const totalCollected = db.feeAccounts.reduce((acc, curr) => acc + (curr.paidAmount || 0), 0);
  const totalPending = db.feeAccounts.reduce((acc, curr) => acc + (curr.dueAmount || 0), 0);
  const dueStudentsCount = db.feeAccounts.filter(fa => (fa.dueAmount || 0) > 0).length;

  // Filtered Accounts
  const filteredAccounts = useMemo(() => {
    return db.feeAccounts.filter(acc => {
      if (selectedClassId !== 'all' && acc.classId !== selectedClassId) return false;
      if (statusFilter !== 'all' && acc.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = acc.studentName.toLowerCase().includes(q);
        const matchesRoll = acc.rollNumber.includes(q);
        if (!matchesName && !matchesRoll) return false;
      }
      return true;
    });
  }, [db.feeAccounts, selectedClassId, statusFilter, searchQuery]);

  return (
    <div className="space-y-4 pb-16">
      {/* Header Bar */}
      <div className="rounded-3xl border border-orange-100 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">
                School Fees & WhatsApp Hub
              </h2>
              <p className="text-xs text-slate-500">
                Live fee ledgers, instant 1-tap WhatsApp parent reminders & receipts
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('accounts')}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                activeTab === 'accounts'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Fee Accounts
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                activeTab === 'transactions'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Payment Receipts ({db.feeTransactions.length})
            </button>
          </div>
        </div>
      </div>

      {/* Financial Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Billed</span>
          <p className="mt-1 text-xl sm:text-2xl font-black text-slate-900">
            ₹{(totalBilled / 1000).toFixed(0)}k
          </p>
          <span className="text-[10px] text-slate-500">All student accounts</span>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Collected Fee</span>
          <p className="mt-1 text-xl sm:text-2xl font-black text-emerald-700">
            ₹{(totalCollected / 1000).toFixed(0)}k
          </p>
          <span className="text-[10px] text-emerald-600 font-semibold">
            {totalBilled > 0 ? `${((totalCollected / totalBilled) * 100).toFixed(1)}% collected` : '0%'}
          </span>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Pending Dues</span>
          <p className="mt-1 text-xl sm:text-2xl font-black text-rose-700">
            ₹{(totalPending / 1000).toFixed(0)}k
          </p>
          <span className="text-[10px] text-rose-600 font-bold">{dueStudentsCount} Students with Dues</span>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Collection Rate</span>
          <p className="mt-1 text-xl sm:text-2xl font-black text-blue-800">
            {totalBilled > 0 ? ((totalCollected / totalBilled) * 100).toFixed(0) : 0}%
          </p>
          <span className="text-[10px] text-blue-600">Session {db.schoolInfo.currentAcademicYear}</span>
        </div>
      </div>

      {activeTab === 'accounts' ? (
        <>
          {/* Filters */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search student or roll..."
                className="w-full rounded-xl border border-slate-200 py-1.5 pl-9 pr-3 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <select
                value={selectedClassId}
                onChange={e => setSelectedClassId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-1.5 px-3 text-xs font-bold text-slate-800 focus:border-emerald-500 focus:outline-none"
              >
                <option value="all">All Classes</option>
                {db.classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} - Sec {c.section}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="w-full rounded-xl border border-slate-200 bg-white py-1.5 px-3 text-xs font-bold text-slate-800 focus:border-emerald-500 focus:outline-none"
              >
                <option value="all">All Statuses ({db.feeAccounts.length})</option>
                <option value="due">Due Only</option>
                <option value="partial">Partial Paid</option>
                <option value="paid">Fully Paid</option>
              </select>
            </div>
          </div>

          {/* Accounts List */}
          <div className="space-y-2.5">
            {filteredAccounts.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-xs text-slate-400">
                No fee accounts match the selected filter.
              </div>
            ) : (
              filteredAccounts.map(fa => {
                const student = db.students.find(s => s.id === fa.studentId);
                const isDue = (fa.dueAmount || 0) > 0;

                return (
                  <div
                    key={fa.id}
                    className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs hover:border-emerald-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div
                      onClick={() => onSelectStudent(fa.studentId)}
                      className="flex items-center space-x-3 cursor-pointer group flex-1 min-w-0"
                    >
                      <img
                        src={
                          student?.photoUrl ||
                          `https://api.dicebear.com/7.x/adventurer/svg?seed=${fa.studentName}`
                        }
                        alt={fa.studentName}
                        className="h-11 w-11 shrink-0 rounded-2xl object-cover border border-slate-200"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 group-hover:text-emerald-700 truncate">
                            {fa.studentName}
                          </h4>
                          <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-700">
                            #{fa.rollNumber}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">
                          {fa.className} • Parent: {student?.parentName || 'N/A'}
                        </p>
                      </div>
                    </div>

                    {/* Financial Amounts Breakdown */}
                    <div className="flex items-center justify-between sm:justify-end space-x-4 shrink-0 text-xs">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Total / Paid</span>
                        <span className="font-bold text-slate-700">
                          ₹{fa.paidAmount} / ₹{fa.totalFee}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Due Amount</span>
                        <span
                          className={`font-black text-sm ${
                            isDue ? 'text-rose-600' : 'text-emerald-600'
                          }`}
                        >
                          ₹{fa.dueAmount}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center space-x-1.5 pl-2 border-l border-slate-100">
                        {student && student.parentPhone && (
                          <button
                            onClick={() => openWhatsAppFeeMessage(db.schoolInfo, student, fa)}
                            className="inline-flex items-center space-x-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-xs active:scale-95 transition-all"
                            title="Send WhatsApp Notice"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">WhatsApp</span>
                          </button>
                        )}

                        {student && (
                          <button
                            onClick={() => onOpenCollectFee(student)}
                            className="inline-flex items-center space-x-1 rounded-xl bg-orange-600 hover:bg-orange-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs active:scale-95 transition-all"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            <span>Collect</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : (
        /* Transactions & Receipts Ledger */
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <Receipt className="h-5 w-5 text-emerald-600" />
              <h3 className="font-extrabold text-slate-900 text-sm">
                Official Fee Receipts & Transactions
              </h3>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {db.feeTransactions.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">
                No payment transactions recorded yet.
              </p>
            ) : (
              db.feeTransactions.map(tx => (
                <div
                  key={tx.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-slate-800 text-xs">
                        {tx.receiptNumber}
                      </span>
                      <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        {tx.paymentMethod}
                      </span>
                    </div>
                    <p className="font-bold text-slate-900 mt-0.5">
                      {tx.studentName} • {tx.className} (Roll No: {tx.rollNumber})
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Date: {formatDate(tx.paymentDate)} • Recorded by: {tx.collectedBy}
                    </p>
                    {tx.notes && <p className="text-[10px] text-slate-400 mt-0.5">Ref: {tx.notes}</p>}
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className="text-base font-black text-emerald-700">
                      ₹{tx.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
