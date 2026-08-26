export type UserRole = 'principal' | 'teacher';

export type StatusType = 'active' | 'archived';

export interface SchoolInfo {
  id: string;
  name: string;
  tagline: string;
  affiliationNumber?: string;
  address: string;
  phone: string;
  email: string;
  logoUrl?: string;
  currentAcademicYear: string;
  setupCompleted: boolean;
  principalName?: string;
  currencySymbol?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  password?: string;
  teacherCode?: string;
  assignedClassId?: string;
  assignedClassName?: string;
  subject?: string;
  phone?: string;
  photoUrl?: string;
  status: StatusType;
  joiningDate?: string;
  createdAt: string;
}

export interface ClassRoom {
  id: string;
  name: string;
  section: string;
  classTeacherId?: string;
  classTeacherName?: string;
  roomNumber?: string;
  capacity?: number;
  totalStudents?: number;
}

export interface Student {
  id: string;
  name: string;
  rollNumber: string;
  classId: string;
  className: string;
  age?: number;
  dob?: string;
  gender?: 'Male' | 'Female' | 'Other';
  parentName: string;
  parentPhone?: string;
  parentRelation?: string;
  address?: string;
  admissionNumber: string;
  admissionDate: string;
  photoUrl?: string;
  status: StatusType;
  notes?: string;
  bloodGroup?: string;
  academicYear: string;
  createdAt: string;
  updatedAt?: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'leave' | 'late';

export interface AttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  classId: string;
  className: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  status: AttendanceStatus;
  markedByUserId: string;
  markedByUserName: string;
  markedByRole: UserRole;
  timestamp: string;
  remarks?: string;
}

export type TeacherAttendanceStatus = 'present' | 'absent' | 'leave' | 'half_day';

export interface TeacherAttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  teacherId: string;
  teacherName: string;
  teacherCode: string;
  status: TeacherAttendanceStatus;
  remarks?: string;
  markedAt: string;
}

export type FeeStatus = 'paid' | 'partial' | 'due';

export interface FeeAccount {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  classId: string;
  className: string;
  totalFee: number;
  paidAmount: number;
  dueAmount: number;
  status: FeeStatus;
  lastPaymentDate?: string;
}

export interface FeeTransaction {
  id: string;
  feeAccountId: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  amount: number;
  paymentDate: string;
  paymentMethod: 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Online';
  receiptNumber: string;
  notes?: string;
  recordedByName: string;
  recordedByUserId: string;
  timestamp: string;
}

export interface SubjectMarks {
  subject: string;
  maxMarks: number;
  obtainedMarks: number;
  grade: string;
}

export type SubjectResult = SubjectMarks;

export interface StudentResult {
  id: string;
  examId?: string;
  examName: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  classId: string;
  className: string;
  academicYear: string;
  examDate?: string;
  subjects: SubjectMarks[];
  totalMarks: number;
  totalMaxMarks: number;
  percentage: number;
  grade: string;
  remarks?: string;
  createdAt?: string;
}

export interface ExamSubjectConfig {
  name: string;
  maxMarks: number;
  passingMarks?: number;
}

export interface Exam {
  id: string;
  name: string;
  academicYear: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  status?: 'upcoming' | 'ongoing' | 'completed';
  classId?: string;
  className?: string;
  classesIncluded?: string[];
  subjects?: ExamSubjectConfig[];
}

export type PerformanceRating = 'outstanding' | 'excellent' | 'good' | 'satisfactory' | 'needs_attention' | 'needs_improvement';
export type PerformanceCategory = 'academic' | 'homework' | 'behavior' | 'participation' | 'general' | 'attendance' | 'sports' | 'creativity' | 'leadership';

export interface PerformanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  className?: string;
  teacherId?: string;
  teacherName?: string;
  date: string;
  category: PerformanceCategory;
  rating: PerformanceRating;
  remarks?: string;
  strengths?: string;
  areasToImprove?: string;
  createdAt?: string;
}

export interface AcademicYear {
  id: string;
  name: string;
  isCurrent: boolean;
  startDate: string;
  endDate: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  details: string;
  timestamp: string;
  entityType?: 'student' | 'teacher' | 'attendance' | 'fee' | 'result' | 'class' | 'academic_year' | 'system';
  entityId?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'fee' | 'attendance' | 'alert' | 'success';
  isRead: boolean;
  createdAt: string;
  linkAction?: string;
  targetId?: string;
}

export interface SchoolDatabase {
  schoolInfo: SchoolInfo;
  users: User[];
  classes: ClassRoom[];
  students: Student[];
  attendance: AttendanceRecord[];
  teacherAttendance: TeacherAttendanceRecord[];
  feeAccounts: FeeAccount[];
  feeTransactions: FeeTransaction[];
  exams: Exam[];
  results: StudentResult[];
  performance: PerformanceRecord[];
  academicYears: AcademicYear[];
  activityLogs: ActivityLog[];
  notifications: AppNotification[];
}
