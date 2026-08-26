# 🏫 M.S. PUBLIC SCHOOL — Deployment & Client Handover Guide

Comprehensive guide for deploying, packaging as a Desktop App, and delivering the **M.S. Public School Management Portal** to your client.

---

## 📋 Client Credentials & Master Access Sheet

Share these credentials with the school principal and administrators:

| Role | Access Type | Login Identifier | Password / Access Code | Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Principal / Super Admin** | Email & Password | `mozammilalam1996@gmail.com` | `9931066436@` | Full system control: Faculty, Students, Fee Treasury, Marksheets, Audit Logs, Settings |
| **Faculty / Class Teachers** | 6-Digit Code | Any registered Teacher Code (e.g. `501001`, `501002`) | *No password required* | Live Class Attendance, Mark Entry, Student Observations, Multi-device access |

---

## 🚀 Option 1: Live Web & Cloud Deployment (Recommended)

This allows the principal and all teachers to access the school portal simultaneously from any PC, laptop, or mobile phone.

### 1. Build the Production Application
Run the build script to generate the optimized, production-ready static bundle in `/dist`:

```bash
npm run build
```

### 2. Deployment Targets

#### A. Vercel (Fastest — 1 Minute)
1. Push this project to GitHub.
2. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Import the repository.
4. Set:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Click **Deploy**. You will receive a live URL (e.g. `https://mspublicschool.vercel.app`) with free automatic SSL.

#### B. Firebase Hosting
```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Deploy static files
firebase deploy --only hosting
```

#### C. Custom School Domain (e.g. `portal.mspublicschool.edu.in`)
In your Vercel or Firebase dashboard, navigate to **Domains** and add the school's custom sub-domain with a standard CNAME record.

---

## 🖥️ Option 2: 1-Click Desktop App (Windows & Mac)

Once the app is running (or deployed), the client can install it as a **native desktop application** with zero technical setup:

### On Windows 10 / 11 (Google Chrome or Microsoft Edge):
1. Open the portal URL in **Chrome** or **Edge**.
2. Click the **Install App icon (⊕)** on the right side of the address bar, or click **Settings (⋮) → "Install M.S. Public School"**.
3. Click **Install**.
4. ✅ A dedicated desktop window will launch, and a shortcut is placed on the **Windows Desktop** and **Start Menu**.

### On macOS (Apple Safari):
1. Open the portal in **Safari**.
2. From the top Apple menu bar, select **File → Add to Dock...**
3. Click **Add**.
4. ✅ The school app will appear directly in the **Mac Dock** and **Launchpad / Applications**.

---

## 📦 Option 3: Standalone Desktop Executable (.exe / .dmg)

If the client specifically requested a standalone installer file without opening a browser:

### 1. Test Desktop App locally:
```bash
npm run build
npx electron .
```

### 2. Build Native Windows Installer (`.exe`):
```bash
npm run desktop:win
```
*Output: Generates a standalone Windows setup executable in `/dist_electron/` or `/dist/`.*

### 3. Build macOS App (`.dmg`):
```bash
npm run desktop:mac
```

---

## 💾 Database Backup, Restore & Cloud Sync

- **Real-Time Cloud Sync**: Every student added, roll-call taken, fee payment collected, or exam mark entered syncs automatically to **Cloud Firestore**.
- **Offline Mode**: If the school's internet goes down, the app works uninterrupted using local cache and syncs back when reconnected.
- **Manual Backup (Export JSON)**:
  1. Open **School Settings** → click **"Export JSON"** or open the **Desktop App & Client Handover Hub**.
  2. Click **Download JSON Backup** to save a timestamped snapshot of all student records, fee ledgers, and marks on your computer.
- **Restore / Import**:
  1. Upload the `.json` backup file via the **Restore Database** button.
  2. The system imports the entire database and syncs it to the cloud.

---

## 💬 WhatsApp Integration for Parents

- **Automated Fee Receipts**: When a payment is recorded, click **"WhatsApp Receipt"** to open a pre-formatted message addressed to the parent with invoice number, student name, class, amount paid, and remaining balance.
- **Absence Alerts**: When roll-call is completed, absence notifications with school helpline details can be sent to absent students' parents with one tap.
- **Report Cards**: Term marksheets and performance remarks can be shared directly to parents' WhatsApp.

---

## 📞 Support & Maintenance

For institutional assistance or custom configuration, contact the system administrator or open the **School Settings** console.
