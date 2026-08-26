import React, { useState } from 'react';
import { SchoolProvider, useSchool } from './context/SchoolContext';
import { AuthScreen } from './components/auth/AuthScreen';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { PrincipalDashboard } from './components/dashboard/PrincipalDashboard';
import { TeacherDashboard } from './components/dashboard/TeacherDashboard';
import { AttendanceView } from './components/attendance/AttendanceView';
import { StudentsView } from './components/students/StudentsView';
import { StudentProfileModal } from './components/students/StudentProfileModal';
import { AddEditStudentModal } from './components/students/AddEditStudentModal';
import { FeesView } from './components/fees/FeesView';
import { CollectFeeModal } from './components/fees/CollectFeeModal';
import { TeachersView } from './components/teachers/TeachersView';
import { AddTeacherModal } from './components/teachers/AddTeacherModal';
import { TeacherAttendanceView } from './components/teachers/TeacherAttendanceView';
import { ClassesView } from './components/classes/ClassesView';
import { ResultsView } from './components/results/ResultsView';
import { AddResultModal } from './components/results/AddResultModal';
import { PerformanceView } from './components/performance/PerformanceView';
import { AddPerformanceModal } from './components/performance/AddPerformanceModal';
import { ReportsView } from './components/reports/ReportsView';
import { AcademicYearView } from './components/academic/AcademicYearView';
import { ActivityLogsView } from './components/activity/ActivityLogsView';
import { SchoolSettingsView } from './components/settings/SchoolSettingsView';
import { QuickSearchModal } from './components/QuickSearchModal';
import { Student } from './types';

const MainLayout: React.FC = () => {
  const { currentUser, adminImpersonation } = useSchool();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [extraParam, setExtraParam] = useState<any>(null);

  // Global Modals State
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
  const [collectFeeStudent, setCollectFeeStudent] = useState<Student | null>(null);
  const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
  const [addResultStudent, setAddResultStudent] = useState<Student | null>(null);
  const [addPerformanceStudent, setAddPerformanceStudent] = useState<Student | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  if (!currentUser) {
    return <AuthScreen />;
  }

  const isPrincipal = currentUser.role === 'principal' && !adminImpersonation;

  const navigateTab = (tab: string, extra?: any) => {
    setCurrentTab(tab);
    setExtraParam(extra || null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenEditStudent = (student: Student) => {
    setStudentToEdit(student);
    setIsAddStudentOpen(true);
  };

  const handleOpenAddStudent = () => {
    setStudentToEdit(null);
    setIsAddStudentOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#FFF9F0] text-[#1A2B48] font-sans flex flex-col antialiased selection:bg-orange-200 selection:text-orange-900 relative overflow-x-hidden">
      {/* Frosted Glass Ambient Lighting Orbs */}
      <div className="fixed inset-0 z-0 opacity-40 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-5%] w-[450px] sm:w-[600px] h-[450px] sm:h-[600px] bg-[#F27D26] rounded-full blur-[130px]" />
        <div className="absolute bottom-[-10%] right-[2%] w-[500px] sm:w-[700px] h-[500px] sm:h-[700px] bg-[#FFD93D] rounded-full blur-[160px]" />
        <div className="absolute top-[35%] right-[20%] w-[350px] sm:w-[450px] h-[350px] sm:h-[450px] bg-[#FF8A3D] rounded-full blur-[140px] opacity-30" />
      </div>

      {/* Top Application Navbar */}
      <div className="relative z-30">
        <Navbar
          currentTab={currentTab}
          setCurrentTab={navigateTab}
          onOpenQuickSearch={() => setIsSearchOpen(true)}
        />
      </div>

      {/* Main Body with Sidebar + Workspace Content */}
      <div className="relative z-10 flex-1 flex max-w-7xl w-full mx-auto">
        {/* Desktop Sidebar Navigation */}
        <Sidebar currentTab={currentTab} setCurrentTab={navigateTab} />

        {/* Dynamic Main Stage View */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 min-w-0 overflow-x-hidden">
          {/* Principal & Teacher Views Routing */}
          {currentTab === 'dashboard' && (
            isPrincipal ? (
              <PrincipalDashboard
                onNavigate={navigateTab}
                onOpenAddStudent={handleOpenAddStudent}
                onOpenAddTeacher={() => setIsAddTeacherOpen(true)}
                onOpenQuickSearch={() => setIsSearchOpen(true)}
                onSelectStudent={id => setSelectedStudentId(id)}
              />
            ) : (
              <TeacherDashboard
                onNavigate={navigateTab}
                onOpenAddStudent={handleOpenAddStudent}
                onSelectStudent={id => setSelectedStudentId(id)}
              />
            )
          )}

          {currentTab === 'attendance' && (
            <AttendanceView
              initialClassId={extraParam?.classId}
              onSelectStudent={id => setSelectedStudentId(id)}
            />
          )}

          {currentTab === 'students' && (
            <StudentsView
              initialClassId={extraParam?.classId}
              onSelectStudent={id => setSelectedStudentId(id)}
              onOpenAddStudent={handleOpenAddStudent}
              onOpenEditStudent={handleOpenEditStudent}
              onOpenCollectFee={s => setCollectFeeStudent(s)}
            />
          )}

          {currentTab === 'fees' && (
            <FeesView
              onSelectStudent={id => setSelectedStudentId(id)}
              onOpenCollectFee={s => setCollectFeeStudent(s)}
            />
          )}

          {currentTab === 'teachers' && (
            <TeachersView
              onOpenAddTeacher={() => setIsAddTeacherOpen(true)}
              onNavigateToClass={classId => navigateTab('students', { classId })}
            />
          )}

          {currentTab === 'teacher-attendance' && <TeacherAttendanceView />}

          {currentTab === 'classes' && (
            <ClassesView
              onNavigateToStudents={classId => navigateTab('students', { classId })}
            />
          )}

          {currentTab === 'results' && (
            <ResultsView
              onSelectStudent={id => setSelectedStudentId(id)}
              onOpenAddResult={s => setAddResultStudent(s)}
            />
          )}

          {currentTab === 'performance' && (
            <PerformanceView
              onSelectStudent={id => setSelectedStudentId(id)}
              onOpenAddPerformance={s => setAddPerformanceStudent(s)}
            />
          )}

          {currentTab === 'reports' && <ReportsView />}

          {currentTab === 'academic-year' && <AcademicYearView />}

          {currentTab === 'activity-logs' && <ActivityLogsView />}

          {currentTab === 'settings' && <SchoolSettingsView />}

          {currentTab === 'my-attendance' && (
            <TeacherDashboard
              onNavigate={navigateTab}
              onOpenAddStudent={handleOpenAddStudent}
              onSelectStudent={id => setSelectedStudentId(id)}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Thumb Zone Bar */}
      <MobileBottomNav currentTab={currentTab} setCurrentTab={navigateTab} />

      {/* Global Modals & Overlays */}
      {selectedStudentId && (
        <StudentProfileModal
          studentId={selectedStudentId}
          onClose={() => setSelectedStudentId(null)}
          onOpenCollectFee={s => {
            setSelectedStudentId(null);
            setCollectFeeStudent(s);
          }}
          onOpenAddResult={s => {
            setSelectedStudentId(null);
            setAddResultStudent(s);
          }}
          onOpenAddPerformance={s => {
            setSelectedStudentId(null);
            setAddPerformanceStudent(s);
          }}
          onOpenEditStudent={s => {
            setSelectedStudentId(null);
            handleOpenEditStudent(s);
          }}
        />
      )}

      {isAddStudentOpen && (
        <AddEditStudentModal
          isOpen={isAddStudentOpen}
          onClose={() => {
            setIsAddStudentOpen(false);
            setStudentToEdit(null);
          }}
          studentToEdit={studentToEdit}
          defaultClassId={extraParam?.classId}
        />
      )}

      {collectFeeStudent && (
        <CollectFeeModal
          isOpen={!!collectFeeStudent}
          onClose={() => setCollectFeeStudent(null)}
          student={collectFeeStudent}
        />
      )}

      {isAddTeacherOpen && (
        <AddTeacherModal
          isOpen={isAddTeacherOpen}
          onClose={() => setIsAddTeacherOpen(false)}
        />
      )}

      {addResultStudent && (
        <AddResultModal
          isOpen={!!addResultStudent}
          onClose={() => setAddResultStudent(null)}
          student={addResultStudent}
        />
      )}

      {addPerformanceStudent && (
        <AddPerformanceModal
          isOpen={!!addPerformanceStudent}
          onClose={() => setAddPerformanceStudent(null)}
          student={addPerformanceStudent}
        />
      )}

      {isSearchOpen && (
        <QuickSearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onSelectStudent={id => setSelectedStudentId(id)}
          onNavigateTab={navigateTab}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <SchoolProvider>
      <MainLayout />
    </SchoolProvider>
  );
}
