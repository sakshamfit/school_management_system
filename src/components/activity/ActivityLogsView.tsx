import React, { useState } from 'react';
import {
  History,
  Download,
  RefreshCw,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';
import { formatDate } from '../../utils/helpers';

export const ActivityLogsView: React.FC = () => {
  const { db, resetDatabaseToDemo } = useSchool();
  const [searchQuery, setSearchQuery] = useState('');

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
    <div className="space-y-6 pb-16 text-[#1d1d1f]">
      {/* Header */}
      <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0066cc]/10 text-[#0066cc]">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.022em] text-[#1d1d1f]">
                System Activity & Audit Logs
              </h2>
              <p className="text-xs text-[#86868b]">
                Real-time activity audit trails, faculty action logs, and data backups
              </p>
            </div>
          </div>

          <button
            onClick={exportBackupJSON}
            className="apple-btn-primary"
          >
            <Download className="h-4 w-4 mr-2 shrink-0" />
            <span>Export Full Backup</span>
          </button>
        </div>
      </div>

      {/* Security Banner */}
      <div className="bg-[#30d158]/10 border border-[#30d158]/30 rounded-[18px] p-4 flex items-center space-x-3.5 text-xs text-[#1d1d1f]">
        <ShieldCheck className="h-5 w-5 text-[#30d158] shrink-0" />
        <div>
          <span className="font-semibold text-[#30d158]">Secure Audit Trail:</span> All teacher submissions, fee collections, and report card revisions are timestamped and logged for administrative compliance.
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-[#f0f0f0]">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#86868b]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search audit trail..."
              className="apple-input pl-10"
            />
          </div>

          <button
            onClick={resetDatabaseToDemo}
            className="text-xs font-semibold text-[#ff3b30] hover:underline flex items-center space-x-1.5 px-3 py-1.5 rounded-full hover:bg-[#ff3b30]/10 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5 shrink-0" />
            <span>Reset Demo DB</span>
          </button>
        </div>

        <div className="divide-y divide-[#f0f0f0] max-h-[60vh] overflow-y-auto pr-1">
          {filteredLogs.map(log => (
            <div key={log.id} className="py-3.5 flex items-start justify-between text-xs gap-3">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-[#1d1d1f]">{log.userName}</span>
                  <span className="bg-[#f5f5f7] px-2 py-0.5 rounded-full text-[10px] font-semibold text-[#0066cc]">
                    {log.action}
                  </span>
                </div>
                <p className="text-[#86868b] text-xs">{log.details}</p>
              </div>

              <span className="text-[11px] text-[#86868b] shrink-0">
                {formatDate(log.timestamp.slice(0, 10))} • {log.timestamp.slice(11, 16)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
