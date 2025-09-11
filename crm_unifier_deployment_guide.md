# CRM_Unifier — Diagnose, Fix, Deploy Guide

## 📋 Project Overview

**Repository**: `bSTEADY81/crm_unifier`  
**Frontend**: Next.js 14 with App Router (`frontend/`)  
**Backend**: Railway hosted API  
**Frontend Hosting**: Vercel  

### Known Issue
Build fails on Vercel during prerender of 404/500 pages due to `useContext` call in server context.

### Prior Fix Attempt
Added `frontend/src/app/Providers.tsx` (client component) to wrap RootLayout children.

---

## 🎯 Objective

Diagnose and fix all code and configuration issues blocking Vercel production deployment. Deliver a successful production deployment with:
- Working routes and authentication
- Clean logs
- Repeatable settings
- Full integration with Railway API

---

## 🔧 Environment Configuration

### Required Environment Variables (All Environments)

```bash
NEXT_PUBLIC_API_URL=https://crmunifier-production.up.railway.app/api/v1
NEXTAUTH_URL=https://<vercel-project>.vercel.app
NEXTAUTH_SECRET=<32+ character random string>
```

### Vercel Build Settings

| Setting | Value |
|---------|-------|
| Framework | Next.js |
| Root Directory | `frontend` |
| Node Version | 20.x |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `.next` |

### Backend CORS Requirements

Allow origins:
- `https://<vercel-project>.vercel.app`
- `https://<vercel-project>-*.*.vercel.app`

---

## 📝 Step-by-Step Deployment Plan

### Step 1: Clone and Inspect

1. **Pull latest main branch**
   ```bash
   git pull origin main
   ```

2. **Identify project structure**
   - Next.js version
   - TypeScript configuration
   - App Router structure

3. **List critical files**
   - `error.tsx`
   - `not-found.tsx`
   - `global-error.tsx`
   - Nested `layout.tsx` files

### Step 2: Pinpoint Prerender Error

**Search for problematic patterns in:**
- `frontend/src/app/layout.tsx`
- Any `app/**/error.tsx`
- Any `app/**/not-found.tsx`
- Any `app/**/page.tsx`
- Any `app/**/layout.tsx`
- Shared components used by error pages

**Rule**: Server files cannot call client hooks or import client components transitively unless:
- Marked with `'use client'`
- Wrapped with client boundary component
- Refactored to pure server content

### Step 3: Apply the Providers Pattern

#### Create/Update `frontend/src/app/Providers.tsx`:

```typescript
'use client';
import { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';

export default function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
```

#### Update `frontend/src/app/layout.tsx`:

```typescript
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from './Providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CRM Unifier',
  description: 'Unified customer correspondence platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### Step 4: Harden Error Boundaries

#### Minimal Safe `error.tsx`:

```typescript
'use client';
export default function Error({ error }: { error: Error }) {
  return <div>Something went wrong.</div>;
}
```

#### Minimal Safe `not-found.tsx`:

```typescript
export default function NotFound() {
  return <div>Page not found.</div>;
}
```

**Important**: Avoid importing app-wide Providers or anything with `useContext` in error pages.

### Step 5: Optional - Disable Static Prerender

If third-party libraries force client behavior, add to `frontend/src/app/layout.tsx`:

```typescript
export const dynamic = 'force-dynamic';
```

Or for specific pages:

```typescript
export const dynamic = 'error';
```

### Step 6: Configure Vercel Settings

1. **Navigate to**: Project → Settings → Build & Development

2. **Configure build settings**:
   - Root Directory: `frontend`
   - Node.js Version: `20.x`
   - Install Command: `npm ci`
   - Build Command: `npm run build`
   - Output Directory: `.next`

3. **Set environment variables** (Production + Preview):
   ```
   NEXT_PUBLIC_API_URL=https://crmunifier-production.up.railway.app/api/v1
   NEXTAUTH_URL=https://<project>.vercel.app
   NEXTAUTH_SECRET=<generate-32-chars>
   ```

4. **Redeploy with Clear Build Cache**

### Step 7: Configure Backend CORS

Ensure Railway backend allows:
- `https://<project>.vercel.app`
- `https://<project>-*.*.vercel.app`

Update `CORS_ORIGINS` or equivalent configuration.

---

## ✅ Verification Checklist

| Task | Expected Result |
|------|-----------------|
| Load `/` | Homepage renders without errors |
| Load `/__test_404__` | 404 page displays without thrown errors |
| Trigger test error route | Error boundary displays gracefully |
| Open auth modal | Sign-in flow completes successfully |
| Check network calls | Uses `NEXT_PUBLIC_API_URL`, returns 2xx |
| Test all 5 main routes | All routes render correctly |

---

## 🚨 Troubleshooting

### If Build Fails Again:

1. **Capture logs**
   - Last 50 lines of build output
   - Exact file/line from stack trace

2. **Check for transitive imports**
   - Server modules importing client modules
   - Split imports and use client boundaries

3. **Local build test**
   ```bash
   cd frontend
   npm ci
   npm run build
   ```

4. **Fallback strategy**
   - Ship minimal server-safe error pages
   - Revisit rich UX enhancements later

---

## 💾 Git Commit Strategy

Use granular, descriptive commit messages:

```bash
fix(app): wrap root layout with client Providers to prevent server useContext
fix(error): make 404 and error pages server-safe
chore(vercel): root=frontend, node=20, cache cleared
chore(env): set NEXTAUTH_URL, NEXT_PUBLIC_API_URL
```

---

## 📋 Information Needed From Team

- [ ] Production Vercel project name/URL for `NEXTAUTH_URL`
- [ ] Fresh `NEXTAUTH_SECRET` (32+ characters)
- [ ] OAuth provider secrets for auth flow
- [ ] Backend CORS configuration method (env vs code)

---

## 🎯 Deliverables

1. **Working production deployment URL** on Vercel
2. **Commits** with clear messages describing changes
3. **Operations log**:
   - What changed
   - Why it changed
   - Where changes were made
   - Build log excerpts
4. **Verification checklist** results with evidence

---

## 🔒 Security Constraints

- ❌ Never remove security controls
- ❌ Don't invent missing env values - ask explicitly
- ✅ Preserve TypeScript types
- ✅ Keep server components free of client-only hooks
- ✅ Prefer minimal diffs with clear messages

---

## 📊 Output Format

### Success Report:
```
Status: ✅ Success
Commits: 
  - [hash] fix(app): wrap root layout with client Providers
  - [hash] fix(error): make 404 and error pages server-safe
Deployment: https://crm-unifier.vercel.app
Verification: All checks passed
```

### Failure Report:
```
Status: ❌ Failure
Error: [specific error]
Location: [file:line]
Build Logs: [last 50 lines]
Next Step: [precise file changes needed]
```

---

## ⚠️ Guardrails

- **Never print secrets** - Redact as `***redacted***`
- **Request human takeover** for authentication prompts
- **Keep changes minimal** and reversible
- **No credential exposure** in logs or output

---

## 📝 Handover Notes

Document for future reference:
- Final Vercel project URL
- Remaining TODOs (e.g., enhance error page UX)
- Exact env vars used and their locations
- Any custom configurations applied

---

*Last Updated: [Date]*  
*Version: 1.0*