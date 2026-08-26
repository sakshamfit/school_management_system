import React, { useState } from 'react';
import {
  Settings,
  School,
  Mail,
  Phone,
  MapPin,
  FileText,
  Save,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';

export const SchoolSettingsView: React.FC = () => {
  const { db, updateSchoolSettings, currentUser } = useSchool();

  const [name, setName] = useState(db.schoolInfo.name);
  const [tagline, setTagline] = useState(db.schoolInfo.tagline || 'Knowledge is Power • Empowering Young Minds');
  const [phone, setPhone] = useState(db.schoolInfo.phone || '+91 98765 43210');
  const [email, setEmail] = useState(db.schoolInfo.email || 'info@mspublicschool.edu.in');
  const [address, setAddress] = useState(db.schoolInfo.address || 'Civil Lines, Station Road, Main City');
  const [affiliationNo, setAffiliationNo] = useState(db.schoolInfo.affiliationNumber || 'CBSE/AFF/2024/93821');
  const [principalName, setPrincipalName] = useState(db.schoolInfo.principalName || 'Dr. R.K. Mishra');
  const [currentAcademicYear, setCurrentAcademicYear] = useState(db.schoolInfo.currentAcademicYear);
  const [currencySymbol, setCurrencySymbol] = useState(db.schoolInfo.currencySymbol || '₹');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSchoolSettings({
      name,
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
    <div className="space-y-5 pb-16">
      {/* Header */}
      <div className="rounded-3xl border border-orange-100 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex items-center space-x-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">
              School Configuration & Settings
            </h2>
            <p className="text-xs text-slate-500">
              Update institutional details, official WhatsApp contact numbers, and academic presets
            </p>
          </div>
        </div>
      </div>

      {savedSuccess && (
        <div className="rounded-2xl bg-emerald-600 p-4 text-xs font-bold text-white shadow-md flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>School configurations updated and synced successfully!</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              School Official Name *
            </label>
            <div className="relative">
              <School className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 py-2 pl-10 pr-3 text-xs font-bold text-slate-900 focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              School Motto / Tagline
            </label>
            <input
              type="text"
              value={tagline}
              onChange={e => setTagline(e.target.value)}
              className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs font-medium text-slate-800 focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Principal / Director Name *
            </label>
            <input
              type="text"
              required
              value={principalName}
              onChange={e => setPrincipalName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs font-bold text-slate-900 focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              CBSE / State Affiliation Number
            </label>
            <input
              type="text"
              value={affiliationNo}
              onChange={e => setAffiliationNo(e.target.value)}
              className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs font-mono font-bold text-slate-800 focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Official Helpline / WhatsApp Phone
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full rounded-xl border border-slate-200 py-2 pl-10 pr-3 text-xs font-bold text-slate-900 focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Official School Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 py-2 pl-10 pr-3 text-xs font-medium text-slate-800 focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              School Campus Address
            </label>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="w-full rounded-xl border border-slate-200 py-2 pl-10 pr-3 text-xs font-medium text-slate-800 focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Active Academic Session
            </label>
            <input
              type="text"
              value={currentAcademicYear}
              onChange={e => setCurrentAcademicYear(e.target.value)}
              className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs font-mono font-bold text-slate-800 focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Currency Symbol
            </label>
            <input
              type="text"
              value={currencySymbol}
              onChange={e => setCurrencySymbol(e.target.value)}
              className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs font-bold text-slate-800 focus:border-orange-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 px-6 py-2.5 text-xs font-black text-white shadow-md hover:from-orange-600 hover:to-amber-700 active:scale-95 transition-all flex items-center space-x-2"
          >
            <Save className="h-4 w-4" />
            <span>Save School Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
};
