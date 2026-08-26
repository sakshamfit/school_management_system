import React, { useState, useEffect } from 'react';
import {
  X,
  Camera,
  GraduationCap,
  User,
  Phone,
  Calendar,
  MapPin,
  FileText,
  Save,
  Upload,
} from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';
import { Student } from '../../types';
import { CameraCaptureModal } from '../CameraCaptureModal';
import { getTodayDateString } from '../../utils/helpers';

interface AddEditStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentToEdit?: Student | null;
  defaultClassId?: string;
}

export const AddEditStudentModal: React.FC<AddEditStudentModalProps> = ({
  isOpen,
  onClose,
  studentToEdit,
  defaultClassId,
}) => {
  const { db, addStudent, updateStudent, currentUser } = useSchool();
  const [showCameraModal, setShowCameraModal] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [classId, setClassId] = useState(defaultClassId || db.classes[0]?.id || 'cls_05');
  const [rollNumber, setRollNumber] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [dob, setDob] = useState('2015-05-15');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentRelation, setParentRelation] = useState('Father');
  const [address, setAddress] = useState('');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [photoUrl, setPhotoUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [annualFee, setAnnualFee] = useState<number>(24000);

  useEffect(() => {
    if (studentToEdit) {
      setName(studentToEdit.name);
      setClassId(studentToEdit.classId);
      setRollNumber(studentToEdit.rollNumber);
      setGender(studentToEdit.gender || 'Male');
      setDob(studentToEdit.dob || '2015-05-15');
      setParentName(studentToEdit.parentName);
      setParentPhone(studentToEdit.parentPhone || '');
      setParentRelation(studentToEdit.parentRelation || 'Father');
      setAddress(studentToEdit.address || '');
      setBloodGroup(studentToEdit.bloodGroup || 'O+');
      setPhotoUrl(studentToEdit.photoUrl || '');
      setNotes(studentToEdit.notes || '');
    } else {
      // Auto compute next roll number in selected class
      const classStudents = db.students.filter(s => s.classId === classId);
      const nextRoll = classStudents.length + 1;
      setRollNumber(String(nextRoll));
      setName('');
      setParentName('');
      setParentPhone('');
      setAddress('');
      setPhotoUrl('');
      setNotes('');
      if (defaultClassId) setClassId(defaultClassId);
    }
  }, [studentToEdit, isOpen, classId, defaultClassId, db.students]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const selectedClass = db.classes.find(c => c.id === classId);
    const className = selectedClass?.name || 'Class 5';

    if (studentToEdit) {
      updateStudent(studentToEdit.id, {
        name,
        classId,
        className,
        rollNumber,
        gender,
        dob,
        parentName,
        parentPhone,
        parentRelation,
        address,
        bloodGroup,
        photoUrl: photoUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${name}`,
        notes,
      });
    } else {
      addStudent({
        name,
        classId,
        className,
        rollNumber,
        gender,
        dob,
        parentName,
        parentPhone,
        parentRelation,
        address,
        bloodGroup,
        photoUrl: photoUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${name}`,
        notes,
        totalFee: annualFee,
      });
    }

    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in overflow-y-auto">
        <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-orange-500 to-amber-600 p-5 text-white shrink-0">
            <div className="flex items-center space-x-2">
              <GraduationCap className="h-6 w-6" />
              <h3 className="text-base sm:text-lg font-black">
                {studentToEdit ? 'Edit Student Profile' : 'Enroll New Student'}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="rounded-full bg-white/20 p-1.5 text-white hover:bg-white/30"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            {/* Student Photo Picker with Camera option */}
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-orange-50/60 p-4 rounded-2xl border border-orange-100">
              <img
                src={
                  photoUrl ||
                  (name ? `https://api.dicebear.com/7.x/adventurer/svg?seed=${name}` : 'https://api.dicebear.com/7.x/adventurer/svg?seed=student')
                }
                alt="Student preview"
                className="h-20 w-20 rounded-2xl object-cover border-2 border-orange-200 shadow-sm shrink-0 bg-white"
              />

              <div className="flex-1 space-y-2 text-center sm:text-left">
                <p className="text-xs font-bold text-slate-800">Student Profile Photo</p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCameraModal(true)}
                    className="inline-flex items-center space-x-1.5 rounded-xl bg-orange-600 px-3 py-2 text-xs font-extrabold text-white shadow-xs hover:bg-orange-700 active:scale-95 transition-all"
                  >
                    <Camera className="h-4 w-4" />
                    <span>Take Camera Photo</span>
                  </button>

                  <label className="inline-flex cursor-pointer items-center space-x-1.5 rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all">
                    <Upload className="h-4 w-4 text-slate-400" />
                    <span>Upload Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            if (typeof reader.result === 'string') {
                              setPhotoUrl(reader.result);
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Aarav Sharma"
                  className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs font-bold text-slate-800 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Assigned Class *
                </label>
                <select
                  value={classId}
                  onChange={e => setClassId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs font-bold text-slate-800 focus:border-orange-500 focus:outline-none bg-white"
                >
                  {db.classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} - Section {c.section}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Roll Number *
                </label>
                <input
                  type="text"
                  required
                  value={rollNumber}
                  onChange={e => setRollNumber(e.target.value)}
                  placeholder="e.g. 1"
                  className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs font-bold text-slate-800 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={e => setGender(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs font-bold text-slate-800 focus:border-orange-500 focus:outline-none bg-white"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={dob}
                  onChange={e => setDob(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs font-bold text-slate-800 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Blood Group
                </label>
                <select
                  value={bloodGroup}
                  onChange={e => setBloodGroup(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs font-bold text-slate-800 focus:border-orange-500 focus:outline-none bg-white"
                >
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>
            </div>

            {/* Parent & Contact Information */}
            <div className="pt-2 border-t border-slate-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                Parent / Guardian Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Parent / Guardian Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={parentName}
                    onChange={e => setParentName(e.target.value)}
                    placeholder="e.g. Ramesh Sharma"
                    className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs font-bold text-slate-800 focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Parent Phone (WhatsApp enabled)
                  </label>
                  <input
                    type="tel"
                    value={parentPhone}
                    onChange={e => setParentPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs font-bold text-slate-800 focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Residential Address
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="e.g. House No. 42, Civil Lines, School Road"
                    className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs font-bold text-slate-800 focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {!studentToEdit && (
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Annual Tuition Fee Structure (₹)
                </label>
                <input
                  type="number"
                  value={annualFee}
                  onChange={e => setAnnualFee(Number(e.target.value))}
                  placeholder="24000"
                  className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs font-bold text-slate-800 focus:border-orange-500 focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Additional Notes / Medical Info
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any special remarks, medical alerts, or transport details..."
                className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs font-medium text-slate-800 focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 py-3 text-xs font-black text-white shadow-lg shadow-orange-500/25 hover:from-orange-600 hover:to-amber-700 active:scale-95 transition-all flex items-center justify-center space-x-2"
              >
                <Save className="h-4 w-4" />
                <span>{studentToEdit ? 'Save Changes' : 'Enroll Student'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Embedded Live Camera Modal */}
      <CameraCaptureModal
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onCapture={capturedDataUrl => {
          setPhotoUrl(capturedDataUrl);
          setShowCameraModal(false);
        }}
        title={`Take Photo for ${name || 'Student'}`}
      />
    </>
  );
};
