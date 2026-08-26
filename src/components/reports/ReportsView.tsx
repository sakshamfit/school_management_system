import React from 'react';
import {
  BarChart3,
  TrendingUp,
  Download,
  Calendar,
  CreditCard,
  Award,
  GraduationCap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { useSchool } from '../../context/SchoolContext';

export const ReportsView: React.FC = () => {
  const { db } = useSchool();

  // Class-wise student count and attendance rate
  const classData = db.classes.map(c => {
    const students = db.students.filter(s => s.classId === c.id && s.status === 'active');
    const records = db.attendance.filter(a => a.classId === c.id);
    const present = records.filter(a => a.status === 'present').length;
    const attPct = records.length > 0 ? Number(((present / records.length) * 100).toFixed(0)) : 88;

    return {
      name: c.name,
      students: students.length,
      attendance: attPct,
    };
  });

  // Fee collection pie chart data
  const totalBilled = db.feeAccounts.reduce((acc, curr) => acc + (curr.totalFee || 0), 0);
  const totalCollected = db.feeAccounts.reduce((acc, curr) => acc + (curr.paidAmount || 0), 0);
  const totalDue = db.feeAccounts.reduce((acc, curr) => acc + (curr.dueAmount || 0), 0);

  const feePieData = [
    { name: 'Collected', value: totalCollected, color: '#10B981' },
    { name: 'Pending Due', value: totalDue, color: '#EF4444' },
  ];

  // Grade breakdown
  const gradeCounts: Record<string, number> = { 'A+': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0 };
  db.results.forEach(r => {
    if (gradeCounts[r.grade] !== undefined) {
      gradeCounts[r.grade] += 1;
    }
  });

  const gradeData = Object.keys(gradeCounts).map(g => ({
    grade: g,
    count: gradeCounts[g] || 1,
  }));

  return (
    <div className="space-y-5 pb-16">
      {/* Header */}
      <div className="rounded-3xl border border-orange-100 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">
                School Analytics & Reports
              </h2>
              <p className="text-xs text-slate-500">
                Data insights, attendance metrics, revenue collections and academic grades
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Class-wise Attendance & Students */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-slate-900 text-sm">
              Class-wise Attendance Rate (%)
            </h3>
            <span className="text-xs font-bold text-orange-600">Live Breakdown</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val: any) => [`${val}%`, 'Attendance Rate']}
                  contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                />
                <Bar dataKey="attendance" fill="#F97316" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fee Collection Pie Chart */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-slate-900 text-sm">
              Fee Collection vs Pending Dues
            </h3>
            <span className="text-xs font-bold text-emerald-600">
              ₹{(totalCollected / 1000).toFixed(0)}k Collected
            </span>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={feePieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {feePieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Amount']}
                  contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-center space-x-6 text-xs font-bold pt-2">
            <div className="flex items-center space-x-2">
              <span className="h-3 w-3 rounded-full bg-emerald-500"></span>
              <span>Collected: ₹{totalCollected.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="h-3 w-3 rounded-full bg-rose-500"></span>
              <span>Due: ₹{totalDue.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Academic Grade Distribution */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-slate-900 text-sm">
              Academic Grade Distribution
            </h3>
            <span className="text-xs font-bold text-purple-600">All Examination Records</span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gradeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="grade" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val: any) => [val, 'Students']}
                  contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                />
                <Bar dataKey="count" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
