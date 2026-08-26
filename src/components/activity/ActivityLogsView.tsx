import React, { useState } from 'react';
import {
  History,
  Download,
  Upload,
  RefreshCw,
  Clock,
  ShieldCheck,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';
import { formatDate } from '../../utils/helpers';

export const ActivityLogsView: React.FC = () => {
  const { db, resetDatabaseToDemo } = useSchool();
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedData, setCopiedData] = useState(false);

  const filteredLogs = db.activityLogs.filter(log => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.userName.toLowerCase().includes(q) ||
      log.details.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q)
    );
  });

  const exportBackupJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(db, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `ms_public_school_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-5 pb-16">
      {/* Header */}
      <div className="rounded-3xl border border-orange-100 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">
                School Audit Logs & Data Safety
              </h2>
              <p className="text-xs text-slate-500">
                Non-destructive audit trails, real-time activity tracking & complete database backup
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={exportBackupJSON}
              className="inline-flex items-center space-x-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 active:scale-95 transition-all shadow-xs"
            >
              <Download className="h-4 w-4" />
              <span>Export Full Backup</span>
            </button>
          </div>
        </div>
      </div>

      {/* Safety Banner */}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 flex items-center space-x-3 text-xs text-emerald-900">
        <ShieldCheck className="h-6 w-6 text-emerald-600 shrink-0" />
        <div>
          <span className="font-bold">Protected School Data Policy:</span> All teacher actions, attendance submissions, fee receipts, and marksheet modifications are immutable and audited. Student records use soft-archiving to protect lifelong records.
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search audit trail..."
              className="w-full rounded-xl border border-slate-200 py-1.5 pl-9 pr-3 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:outline-none"
            />
          </div>

          <button
            onClick={resetDatabaseToDemo}
            className="text-xs font-bold text-orange-600 hover:underline flex items-center space-x-1"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Reset Demo DB</span>
          </button>
        </div>

        <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto pr-1">
          {filteredLogs.map(log => (
            <div key={log.id} className="py-3 flex items-start justify-between text-xs gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-slate-900">{log.userName}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-mono text-slate-600">
                    {log.action}
                  </span>
                </div>
                <p className="text-slate-600">{log.details}</p>
              </div>

              <span className="text-[11px] text-slate-400 shrink-0 font-medium">
                {formatDate(log.timestamp.slice(0, 10))} • {log.timestamp.slice(11, 16)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
