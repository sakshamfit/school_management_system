# Customer Guide — M.S. PUBLIC SCHOOL Management System

## Overview

This is a **local-first** school management system. Your school data lives on your computer, not in the cloud. Google Drive is used only as encrypted backup.

```
Your Computer (Primary)
    ├── Local SQLite Database
    ├── Local Backups (rolling 10)
    └── Google Drive Backup (encrypted, your account)
```

Works fully offline. Internet needed only for license verification and cloud backup.

## Login

### Principal Console

- **School ID / Email:** Issued by administrator (e.g., `schoolname@gmail.com`)
- **Password:** Issued by administrator
- No public signup — contact admin if you need account or forgot password

### Teacher Portal

- **6-digit code:** Issued by principal (e.g., `501001`)
- Each teacher has unique code
- Works on multiple devices simultaneously
- Forgot code? Contact principal

## Main Features

### Dashboard

- Overview: total students, teachers, attendance, fees, etc.
- Quick actions: add student, mark attendance, collect fee

### Students

- Add, edit, archive, restore
- Student profile with photo, parent info, admission details
- Search and filter by class

### Attendance

- Daily roll-call per class
- Mark present/absent/leave/late
- WhatsApp absence alerts to parents

### Teachers

- Faculty roster, add teacher, assign class
- Teacher attendance (present/absent/leave/half-day)
- 6-digit codes managed by principal

### Fees

- Fee treasury, collect fee, receipt generation
- Payment methods: Cash, UPI, Bank Transfer, Cheque, Online
- WhatsApp receipt to parents
- Due tracking

### Exams & Results

- Create exams, enter marks, generate grades
- Printable marksheet
- Performance tracking

### Reports & Analytics

- Attendance reports, fee reports, performance analytics
- Export CSV

### Academic Year & Promotion

- Change active academic year
- Promote students from one class to next

### Activity Logs

- Audit trail: who did what, when

### Settings

- **School Profile:** Name (locked), tagline, principal, address, phone, email, affiliation, session, currency
- **Backup:** Google Drive encrypted backup (see BACKUP_GUIDE.md)
- **Desktop App & Client Handover:** Credentials, export/import JSON

## Data Safety

- **Local:** Primary database at `%LOCALAPPDATA%\SchoolManagementSystem\database\school.sqlite`
- **Local backup:** Automatic rolling backups in `backups/` folder (10 kept)
- **Cloud backup:** Encrypted backup to YOUR Google Drive (see backup guide)
- **Safety backup:** Before restore or migration, safety backup created automatically

## Offline Mode

- App works fully offline
- All features available without internet
- When internet returns, cloud backup retries automatically, license re-verifies

## Printing

- Use File → Print or Ctrl+P to print receipts, marksheets, reports
- Works with any printer

## Support

- In-app: Help → School Support & Contact → WhatsApp
- Provide logs from `%LOCALAPPDATA%\SchoolManagementSystem\logs\` if reporting issue

## Best Practices

1. **Daily:** Check dashboard, mark attendance
2. **Weekly:** Review fee dues, backup status
3. **Monthly:** Export JSON backup to external drive (in addition to Google Drive)
4. **Keep recovery key safe:** Write down Google Drive backup recovery key and keep offline
5. **Don't share teacher codes publicly**
6. **Keep Windows updated, but backup before major Windows updates**

## What NOT to do

- Don't delete `%LOCALAPPDATA%\SchoolManagementSystem\` manually unless you have backup
- Don't share principal password
- Don't install app on too many devices beyond license limit (default 3)
- Don't use Google Drive backup as file sharing — it's encrypted backup only
