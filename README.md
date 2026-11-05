# VAST Time Tracker

A full-stack time tracking and team management web application built for the VAST Lab, backed by Supabase.

## Tech Stack
- **Framework:** Next.js (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS v4, Lucide Icons
- **Calendar & UI:** FullCalendar (Interactive TimeGrid & Drag-and-Drop)
- **Database & Auth:** Supabase (PostgreSQL, Supabase Auth, SSR)
- **Exporting:** PapaParse (CSV Export)

## Major Features & Capabilities
- **Live Time Tracker:** Persistent global timer supporting instant start/stop, duration calculation, and intelligent task description autocompletion.
- **Interactive Calendar:** Visual weekly and daily time-grid schedules powered by FullCalendar, allowing users to drag, resize, and reassign time blocks.
- **Team & Project Administration:** Track billable hours and personal time across projects, clients, and teams with role-based admin controls.
- **Reporting & CSV Exports:** Detailed time-log analytics with custom date range filters, summary totals, and CSV downloads for payroll and project accounting.
- **Authentication & Theming:** Supabase user authentication and dark/light theme toggle.

## Development
```bash
npm install
npm run dev
npm run build
```
