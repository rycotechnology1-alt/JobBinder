# JobBinder 🏗️

JobBinder is a mobile-first job management application designed for small construction crews. It allows field workers to rapidly capture progress notes and photos, even offline, and organizes them into clean Job Folders for the back office to review.

## Tech Stack
*   **Framework:** Next.js (App Router)
*   **Database:** PostgreSQL (Neon Serverless)
*   **ORM:** Prisma
*   **Storage:** Cloudflare R2 (S3 Compatible)
*   **Styling:** Tailwind CSS (v4) with a sleek Dark Mode & Glassmorphism aesthetic.
*   **Auth:** Auth.js / NextAuth email/password credentials with JWT sessions
*   **Email:** Resend (for email verification, password setup/reset, and user invites)

---

## 📊 Current Project Status Report

As of the completion of the MVP 8-Step Roadmap, here is the exact state of the repository:

### ✅ What is Done (Fully Functional)
*   **Database Schema:** Complete Prisma schema deployed to Neon and managed with Prisma Migrate (Companies, Users, Auth.js sessions/tokens, Invites, Jobs, Notes, Files, Tasks).
*   **Authentication & Access:** Auth.js email/password sign-in is wired through credentials auth. New admins create a company profile during signup, verify their email through Resend, and app pages/API routes derive company/user access from the session.
*   **Team Settings:** Admins can view crew members and send email invites from `/settings/team`. Free companies are limited to 5 users.
*   **Core API Surface:** `GET/POST` REST routes for Jobs, Notes, Tasks, and the Inbox are scoped to the authenticated user's company.
*   **The Dashboard UI:** Live, dynamic grid of Job Cards with glowing status progress bars and a "Start New Project" modal.
*   **Job Folder UI:** Live, dynamic detailed view of a job folder with a working Activity Feed.
*   **Field Capture (Notes & Progress):** The frontend modals successfully submit data to the backend, writing to Neon and instantly updating the activity feed.
*   **Unsorted Inbox API:** Notes submitted without a `jobId` are successfully routed to the Inbox staging area.

### ⏳ What is Partially Finished
*   **The Unsorted Inbox UI:** The page is built (`/inbox`) and successfully reads unassigned items from the database. However, the "Assign to Job" buttons are currently static placeholders and need to be wired to a `PATCH /api/notes` request to move items into Job Folders.

### 🚧 What Requires Additional Work
*   **Photo Uploads (Cloudflare R2):** The backend API for generating secure presigned R2 URLs (`/api/files/upload-url`) is built. However, the frontend "Add Photo" modal is just a placeholder. The client-side image compression (`browser-image-compression`) and actual file upload logic still needs to be written.
*   **Tasks & Punch Lists:** The backend API (`/api/tasks`) is built, but there is no UI on the Job Folder page to view, add, or check off tasks yet.

---

## Local Development Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   Rename `.env.example` to `.env` and fill in your Neon Database URL, Cloudflare R2 credentials, `AUTH_SECRET`, and Resend API key (`AUTH_RESEND_KEY` or `RESEND_API_KEY`).

3. **Database Migrations:**
   Apply committed migrations to your database and generate the Prisma Client:
   ```bash
   npm run migrate:deploy
   npm run prisma:generate
   ```

   For future schema changes, edit `prisma/schema.prisma` and create a migration instead of using `db push`:
   ```bash
   npm run migrate:dev -- --name <change-name>
   ```

4. **Run the server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the app.

## Database Deployment

This project has a baseline migration at `prisma/migrations/0_init`. The current Neon database has already had this baseline marked as applied. For any other existing database that already matches `prisma/schema.prisma`, mark the baseline as applied once before deploying future migrations:

```bash
npx prisma migrate resolve --applied 0_init --schema prisma/schema.prisma
```

New empty databases can run `npm run migrate:deploy` to create the full schema from the baseline migration.

Vercel builds are configured through `vercel.json` to run:

```bash
npm run vercel-build
```

The Vercel build script runs `prisma generate` for every build, runs `prisma migrate deploy` only when `VERCEL_ENV=production`, and then runs `next build`. If the Vercel project has a manual Build Command override in the dashboard, set it to `npm run vercel-build` or clear the override so `vercel.json` is used.
