# Class Connect

A modern education management platform for institutes/coaching centers to manage branches, admissions, classes, students, faculty, attendance, payments, and reports in one place.

## Features

- Multi-branch organization support
- Role-based access control (RBAC)
- User and role management
- CRM leads and admissions workflow
- Student registration and profile management
- Class, batch, and course management
- Attendance tracking
- Fee/payment tracking
- Leave request handling
- ID card templates and ID card management
- Faculty availability and scheduling
- Reports and analytics
- Google Calendar integration (Meet/event support)
- Supabase Edge Functions for backend automations

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- shadcn/ui + Radix UI
- TanStack Query
- Supabase (Auth, PostgreSQL, RLS, Edge Functions)
- Vitest + Testing Library

## Project Structure

```text
class-connect/
├─ src/
│  ├─ components/        # Reusable UI and feature components
│  ├─ pages/             # Route pages (Dashboard, CRM, Admissions, etc.)
│  ├─ services/          # API/service layer
│  ├─ lib/               # Shared utilities (Supabase client, helpers)
│  └─ types/             # TypeScript types (DB types, models)
├─ supabase/
│  ├─ migrations/        # SQL migrations
│  └─ functions/         # Edge Functions
└─ package.json

Prerequisites
Node.js 18+ (recommended: latest LTS)
npm
A Supabase project
Environment Variables
Create a .env file in the project root:

VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id

Getting Started

# 1) Clone repository
git clone <your-repo-url>

# 2) Move into project
cd class-connect

# 3) Install dependencies
npm install

# 4) Start development server
npm run dev

pp will run on the local Vite URL (usually http://localhost:8080).

Available Scripts

npm run dev     # Start development server
npm run build   # Build for production
npm run lint    # Run ESLint
npm run test    # Run Vitest
npm run preview # Preview production build


Supabase Setup Notes
Apply SQL migrations from supabase/migrations/.
Configure Auth and RLS policies in your Supabase project.
Deploy Edge Functions from supabase/functions/ as needed.
Included function folders:

auto-fee-reminder
create-google-meet
create-student
google-oauth-callback
send-whatsapp-template
whatsapp-webhook
Deployment
You can deploy the frontend to platforms like Vercel/Netlify and keep Supabase as backend.

General steps:

Build the app with npm run build
Deploy dist/
Add the same environment variables in your hosting provider
Ensure Supabase redirect URLs and Google OAuth redirect URLs are configured correctly
Troubleshooting
If app fails on startup with Supabase error, verify .env values.
If Google OAuth fails, verify VITE_GOOGLE_CLIENT_ID and redirect URL:
${APP_ORIGIN}/auth/google/callback
If permission issues occur, verify user role and RLS policies