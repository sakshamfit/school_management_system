import React from 'react';
import {
  BarChart3,
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
    { name: 'Collected', value: totalCollected, color: '#30d158' },
    { name: 'Pending Due', value: totalDue, color: '#ff3b30' },
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
    <div className="space-y-6 pb-16 text-[#1d1d1f]">
      {/* Header */}
      <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0066cc]/10 text-[#0066cc]">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.022em] text-[#1d1d1f]">
                School Analytics & Reports
              </h2>
              <p className="text-xs text-[#86868b]">
                Attendance trends, fee recovery metrics, and academic grade distribution
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Class-wise Attendance & Students */}
        <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-[#f0f0f0] pb-3">
            <h3 className="font-semibold text-sm text-[#1d1d1f]">
              Class Attendance Rate (%)
            </h3>
            <span className="text-xs font-semibold text-[#0066cc]">Real-Time Feed</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#86868b' }} stroke="#e5e5ea" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#86868b' }} stroke="#e5e5ea" />
                <Tooltip
                  formatter={(val: any) => [`${val}%`, 'Attendance']}
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e5e5ea', borderRadius: '12px', fontSize: '12px', color: '#1d1d1f', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                />
                <Bar dataKey="attendance" fill="#0066cc" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fee Collection Pie Chart */}
        <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-[#f0f0f0] pb-3">
            <h3 className="font-semibold text-sm text-[#1d1d1f]">
              Fee Collection vs Pending Dues
            </h3>
            <span className="text-xs font-semibold text-[#30d158]">
              ₹{(totalCollected / 1000).toFixed(0)}k Recovered
            </span>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={feePieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                >
                  <Cell fill="#30d158" />
                  <Cell fill="#ff3b30" />
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Amount']}
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e5e5ea', borderRadius: '12px', fontSize: '12px', color: '#1d1d1f', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-center space-x-6 text-xs pt-3 border-t border-[#f0f0f0]">
            <div className="flex items-center space-x-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#30d158]"></span>
              <span className="font-medium text-[#1d1d1f]">Collected: ₹{totalCollected.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff3b30]"></span>
              <span className="font-medium text-[#1d1d1f]">Due: ₹{totalDue.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Academic Grade Distribution */}
        <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between mb-4 border-b border-[#f0f0f0] pb-3">
            <h3 className="font-semibold text-sm text-[#1d1d1f]">
              Grade Distribution
            </h3>
            <span className="text-xs text-[#86868b]">All Recorded Sessions</span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gradeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="grade" tick={{ fontSize: 11, fill: '#86868b' }} stroke="#e5e5ea" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#86868b' }} stroke="#e5e5ea" />
                <Tooltip
                  formatter={(val: any) => [val, 'Students']}
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e5e5ea', borderRadius: '12px', fontSize: '12px', color: '#1d1d1f', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                />
                <Bar dataKey="count" fill="#0066cc" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
