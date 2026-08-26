import React, { useState } from 'react';
import {
  Settings,
  School,
  Mail,
  Phone,
  MapPin,
  Save,
  CheckCircle2,
  Database,
  Wifi,
  Laptop,
  Download,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';
import { ClientHandoverModal } from './ClientHandoverModal';
import { exportDatabaseToJson } from '../../utils/helpers';

export const SchoolSettingsView: React.FC = () => {
  const {
    db,
    updateSchoolSettings,
    lastCloudSyncTime,
  } = useSchool();

  // School name is permanently locked to "M.S. PUBLIC SCHOOL"
  const LOCKED_SCHOOL_NAME = 'M.S. PUBLIC SCHOOL';
  const [tagline, setTagline] = useState(db.schoolInfo.tagline || 'Knowledge is Power • Empowering Young Minds');
  const [phone, setPhone] = useState(db.schoolInfo.phone || '+91 98765 43210');
  const [email, setEmail] = useState(db.schoolInfo.email || 'info@mspublicschool.edu.in');
  const [address, setAddress] = useState(db.schoolInfo.address || 'Civil Lines, Station Road, Main City');
  const [affiliationNo, setAffiliationNo] = useState(db.schoolInfo.affiliationNumber || 'CBSE/AFF/2024/93821');
  const [principalName, setPrincipalName] = useState(db.schoolInfo.principalName || 'Dr. R.K. Mishra');
  const [currentAcademicYear, setCurrentAcademicYear] = useState(db.schoolInfo.currentAcademicYear);
  const [currencySymbol, setCurrencySymbol] = useState(db.schoolInfo.currencySymbol || '₹');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showHandoverModal, setShowHandoverModal] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSchoolSettings({
      name: LOCKED_SCHOOL_NAME,
      tagline,
      phone,
      email,
      address,
      affiliationNumber: affiliationNo,
      principalName,
      currentAcademicYear,
      currencySymbol,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 pb-16 text-[#1d1d1f]">
      {/* Header */}
      <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0066cc]/10 text-[#0066cc]">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.022em] text-[#1d1d1f]">
              School Profile & General Settings
            </h2>
            <p className="text-xs text-[#86868b]">
              Institutional metadata, official headers, and academic session settings
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowHandoverModal(true)}
          className="apple-btn-primary py-2.5 px-4 text-xs shrink-0 flex items-center space-x-2"
        >
          <Laptop className="h-4 w-4 shrink-0" />
          <span>Desktop App & Client Handover</span>
        </button>
      </div>

      {/* Desktop App & Backup Quick Access Card */}
      <div className="bg-gradient-to-r from-[#0066cc]/5 via-white to-[#30d158]/5 rounded-[18px] border border-[#0066cc]/20 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-4 w-4 text-[#0066cc] shrink-0" />
            <h3 className="font-semibold text-sm text-[#1d1d1f]">Client Delivery & Offline Backup</h3>
          </div>
          <p className="text-xs text-[#86868b] max-w-xl leading-relaxed">
            Ready to hand over to the school. Includes 1-click Windows/Mac desktop installer, master principal access credentials, 6-digit teacher codes, and automated WhatsApp templates.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => exportDatabaseToJson(db, `MSPS_School_Database_${new Date().toISOString().slice(0, 10)}.json`)}
            className="apple-btn-secondary py-2 px-3 text-xs"
          >
            <Download className="h-3.5 w-3.5 mr-1 shrink-0" />
            <span>Export JSON</span>
          </button>
          <button
            onClick={() => setShowHandoverModal(true)}
            className="apple-btn-primary py-2 px-4 text-xs"
          >
            <span>Open Client Hub</span>
          </button>
        </div>
      </div>

      {/* Cloud Sync Status Card */}
      <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#f0f0f0]">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#30d158]/10 text-[#30d158]">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-sm text-[#1d1d1f]">
                  Firestore Real-Time Cloud Sync
                </h3>
                <span className="inline-flex items-center gap-1.5 bg-[#30d158]/10 text-[#30d158] px-2.5 py-0.5 rounded-full text-[10px] font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#30d158] animate-pulse"></span>
                  Active & Synced
                </span>
              </div>
              <p className="text-xs text-[#86868b] mt-0.5">
                Bidirectional offline-first sync enabled across all devices
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-[#f5f5f7] p-3.5 rounded-xl border border-[#e5e5ea]">
            <span className="text-[11px] text-[#86868b] block">Protocol</span>
            <span className="font-semibold text-[#30d158] flex items-center gap-1 mt-1 text-xs">
              <Wifi className="h-3.5 w-3.5 shrink-0" />
              WebSocket Live
            </span>
          </div>

          <div className="bg-[#f5f5f7] p-3.5 rounded-xl border border-[#e5e5ea]">
            <span className="text-[11px] text-[#86868b] block">Active Students</span>
            <span className="font-semibold text-[#1d1d1f] mt-1 block text-xs">
              {db.students.filter(s => s.status === 'active').length} Records
            </span>
          </div>

          <div className="bg-[#f5f5f7] p-3.5 rounded-xl border border-[#e5e5ea]">
            <span className="text-[11px] text-[#86868b] block">Staff Accounts</span>
            <span className="font-semibold text-[#1d1d1f] mt-1 block text-xs">
              {db.users.length} Users
            </span>
          </div>

          <div className="bg-[#f5f5f7] p-3.5 rounded-xl border border-[#e5e5ea]">
            <span className="text-[11px] text-[#86868b] block">Last Sync</span>
            <span className="font-semibold text-[#86868b] mt-1 block text-xs">
              {lastCloudSyncTime || 'Live Continuous'}
            </span>
          </div>
        </div>
      </div>

      {savedSuccess && (
        <div className="bg-[#30d158]/10 border border-[#30d158]/30 rounded-xl p-4 text-xs font-semibold text-[#30d158] flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>School settings updated and saved successfully.</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 space-y-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-[#86868b]">
                School Name
              </label>
              <span className="inline-flex items-center space-x-1 text-[10px] font-semibold text-[#86868b] bg-[#f5f5f7] px-2 py-0.5 rounded-full border border-[#e5e5ea]">
                <Lock className="h-3 w-3 text-[#86868b] shrink-0" />
                <span>Locked Permanently</span>
              </span>
            </div>
            <div className="relative">
              <School className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#86868b]" />
              <input
                type="text"
                readOnly
                disabled
                value={LOCKED_SCHOOL_NAME}
                className="apple-input pl-10 bg-[#f5f5f7] cursor-not-allowed font-semibold text-[#1d1d1f] select-none opacity-90"
              />
            </div>
            <p className="text-[11px] text-[#86868b] mt-1">
              Institutional name is locked to <strong>M.S. PUBLIC SCHOOL</strong> and cannot be altered.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#86868b] mb-1">
              School Motto / Tagline
            </label>
            <input
              type="text"
              value={tagline}
              onChange={e => setTagline(e.target.value)}
              className="apple-input"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#86868b] mb-1">
              Principal / Headmaster Name *
            </label>
            <input
              type="text"
              required
              value={principalName}
              onChange={e => setPrincipalName(e.target.value)}
              className="apple-input"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#86868b] mb-1">
              Affiliation / Registration No
            </label>
            <input
              type="text"
              value={affiliationNo}
              onChange={e => setAffiliationNo(e.target.value)}
              className="apple-input"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#86868b] mb-1">
              Official Helpline / WhatsApp Number
            </label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#86868b]" />
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="apple-input pl-10"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#86868b] mb-1">
              Official Email Address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#86868b]" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="apple-input pl-10"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[#86868b] mb-1">
              School Address
            </label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#86868b]" />
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="apple-input pl-10"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#86868b] mb-1">
              Current Academic Session
            </label>
            <input
              type="text"
              value={currentAcademicYear}
              onChange={e => setCurrentAcademicYear(e.target.value)}
              className="apple-input"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#86868b] mb-1">
              Currency Symbol
            </label>
            <input
              type="text"
              value={currencySymbol}
              onChange={e => setCurrencySymbol(e.target.value)}
              className="apple-input"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-[#f0f0f0] flex justify-end">
          <button
            type="submit"
            className="apple-btn-primary"
          >
            <Save className="h-4 w-4 mr-2 shrink-0" />
            <span>Save Settings</span>
          </button>
        </div>
      </form>

      {/* Client Handover Modal */}
      <ClientHandoverModal
        isOpen={showHandoverModal}
        onClose={() => setShowHandoverModal(false)}
      />
    </div>
  );
};
