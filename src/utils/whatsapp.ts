import { Student, FeeAccount, SchoolInfo, StudentResult } from '../types';

export function formatWhatsAppFeeMessage(
  school: SchoolInfo,
  student: Student,
  feeAccount: FeeAccount,
  customNote?: string
): string {
  const dueFormatted = (feeAccount.dueAmount || 0).toLocaleString('en-IN');
  const paidFormatted = (feeAccount.paidAmount || 0).toLocaleString('en-IN');
  const totalFormatted = (feeAccount.totalFee || 0).toLocaleString('en-IN');

  return `*${school.name}*
${school.address}

Dear Parent / Guardian of *${student.name}*,

This is a friendly fee update from the school administration:

📚 *Student:* ${student.name}
🎒 *Class:* ${student.className} (Roll No: ${student.rollNumber})
🆔 *Admission No:* ${student.admissionNumber}

💰 *Fee Summary:*
• Total Annual Fee: ₹${totalFormatted}
• Amount Paid: ₹${paidFormatted}
• *Outstanding Due: ₹${dueFormatted}*

${customNote ? `📌 *Note:* ${customNote}\n\n` : ''}Kindly arrange to clear the outstanding balance at the school accounts desk or via UPI. If already paid, please ignore this notice.

Thank you,
*${school.name} Administration*
📞 Helpline: ${school.phone}`;
}

export function openWhatsAppFeeMessage(
  school: SchoolInfo,
  student: Student,
  feeAccount: FeeAccount,
  customNote?: string
): { success: boolean; url: string; fallbackText: string } {
  const message = formatWhatsAppFeeMessage(school, student, feeAccount, customNote);
  
  // Clean phone number (remove spaces, dashes, parentheses)
  let cleanPhone = (student.parentPhone || '').replace(/[^0-9]/g, '');
  
  // If Indian number without country code, add 91
  if (cleanPhone.length === 10) {
    cleanPhone = '91' + cleanPhone;
  }

  const encodedText = encodeURIComponent(message);
  const waUrl = cleanPhone 
    ? `https://wa.me/${cleanPhone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;

  if (typeof window !== 'undefined') {
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }

  return {
    success: true,
    url: waUrl,
    fallbackText: message,
  };
}

export function formatWhatsAppMarksheetMessage(
  school: SchoolInfo,
  student: Student,
  result: StudentResult
): string {
  const subjectsText = result.subjects
    .map(s => `• ${s.subject}: *${s.obtainedMarks}/${s.maxMarks}* (Grade: ${s.grade})`)
    .join('\n');

  return `*${school.name}*
${school.address}
Affiliation: ${school.affiliationNumber || 'Recognized'}

*OFFICIAL REPORT CARD / MARKSHEET*
----------------------------------------
👤 *Student:* ${student.name}
🎒 *Class:* ${student.className} | Roll No: *${student.rollNumber}*
🆔 *Admission No:* ${student.admissionNumber}
📅 *Exam:* ${result.examName} (${result.academicYear})
----------------------------------------
*SUBJECT SCORES:*
${subjectsText}

----------------------------------------
🏆 *Total Score:* ${result.totalMarks} / ${result.totalMaxMarks}
📈 *Percentage:* ${result.percentage}%
🌟 *Overall Grade:* ${result.grade}
${result.remarks ? `💬 *Teacher Remark:* ${result.remarks}\n` : ''}----------------------------------------
Congratulations on your academic performance!

*${school.name} Examination Board*
Principal: ${school.principalName || 'Principal'}
📞 Helpline: ${school.phone}`;
}

export function openWhatsAppMarksheetMessage(
  school: SchoolInfo,
  student: Student,
  result: StudentResult
): { success: boolean; url: string; fallbackText: string } {
  const message = formatWhatsAppMarksheetMessage(school, student, result);
  
  let cleanPhone = (student.parentPhone || '').replace(/[^0-9]/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = '91' + cleanPhone;
  }

  const encodedText = encodeURIComponent(message);
  const waUrl = cleanPhone 
    ? `https://wa.me/${cleanPhone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;

  if (typeof window !== 'undefined') {
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }

  return {
    success: true,
    url: waUrl,
    fallbackText: message,
  };
}

