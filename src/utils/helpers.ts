export function generateTeacherCode(): string {
  // Simple 6-digit code (e.g. 582914) that can be set or customized by Principal
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function generateReceiptNumber(): string {
  const year = new Date().getFullYear().toString().slice(-2);
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `MSPS/REC/${year}/${randomNum}`;
}

export function generateAdmissionNumber(year = '2026'): string {
  const randomNum = Math.floor(100 + Math.random() * 900);
  return `MSPS-${year}-${randomNum}`;
}

export function calculateGrade(percentage: number): { grade: string; remarks: string } {
  if (percentage >= 95) return { grade: 'A1+', remarks: 'Outstanding / Exceptional' };
  if (percentage >= 90) return { grade: 'A1', remarks: 'Excellent performance' };
  if (percentage >= 80) return { grade: 'A2', remarks: 'Very Good performance' };
  if (percentage >= 70) return { grade: 'B1', remarks: 'Good performance' };
  if (percentage >= 60) return { grade: 'B2', remarks: 'Above Average' };
  if (percentage >= 50) return { grade: 'C1', remarks: 'Average' };
  if (percentage >= 40) return { grade: 'C2', remarks: 'Pass' };
  if (percentage >= 33) return { grade: 'D', remarks: 'Marginal' };
  return { grade: 'E', remarks: 'Needs Significant Improvement' };
}

export function formatDate(dateString: string): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csvContent = [
    headers.join(','),
    ...rows.map(row => 
      row.map(item => {
        const str = String(item ?? '').replace(/"/g, '""');
        return `"${str}"`;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
