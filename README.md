# JobBinder 🏗️

JobBinder is a mobile-first job management application designed for small construction crews. It allows field workers to rapidly capture progress notes and photos, even offline, and organizes them into clean Job Folders for the back office to review.

## Tech Stack
*   **Framework:** Next.js (App Router)
*   **Database:** PostgreSQL (Neon Serverless)
*   **ORM:** Prisma
*   **Storage:** Cloudflare R2 (S3 Compatible)
*   **Styling:** Tailwind CSS (v4) with a sleek Dark Mode & Glassmorphism aesthetic.
*   **Email:** Resend (for User Invites)

---

## 📊 Current Project Status Report

As of the completion of the MVP 8-Step Roadmap, here is the exact state of the repository:

### ✅ What is Done (Fully Functional)
*   **Database Schema:** Complete Prisma schema deployed to Neon (Companies, Users, Jobs, Notes, Files, Tasks).
*   **Core API Surface:** `GET/POST` REST routes for Jobs, Notes, Tasks, and the Inbox.
*   **The Dashboard UI:** Live, dynamic grid of Job Cards with glowing status progress bars and a "Start New Project" modal.
*   **Job Folder UI:** Live, dynamic detailed view of a job folder with a working Activity Feed.
*   **Field Capture (Notes & Progress):** The frontend modals successfully submit data to the backend, writing to Neon and instantly updating the activity feed.
*   **Unsorted Inbox API:** Notes submitted without a `jobId` are successfully routed to the Inbox staging area.

### ⏳ What is Partially Finished
*   **The Unsorted Inbox UI:** The page is built (`/inbox`) and successfully reads unassigned items from the database. However, the "Assign to Job" buttons are currently static placeholders and need to be wired to a `PATCH /api/notes` request to move items into Job Folders.
*   **Authentication & Users:** The database supports multi-tenant Companies and Users, but the frontend currently bypasses auth by looking up the first available Company/User. A real auth provider (like NextAuth or Clerk) needs to be implemented.

### 🚧 What Requires Additional Work
*   **Photo Uploads (Cloudflare R2):** The backend API for generating secure presigned R2 URLs (`/api/files/upload-url`) is built. However, the frontend "Add Photo" modal is just a placeholder. The client-side image compression (`browser-image-compression`) and actual file upload logic still needs to be written.
*   **Tasks & Punch Lists:** The backend API (`/api/tasks`) is built, but there is no UI on the Job Folder page to view, add, or check off tasks yet.
*   **User Invites:** The backend API utilizing Resend (`/api/users/invite`) is built and enforces the "Free Tier" limits, but there is no Settings/Team UI on the frontend to trigger it.

---

## Local Development Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   Rename `.env.example` to `.env` and fill in your Neon Database URL, Cloudflare R2 credentials, and Resend API Key.

3. **Database Sync:**
   Push the schema to your Neon database and generate the Prisma Client:
   ```bash
   npx prisma db push
   npx prisma generate
   ```

4. **Run the server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the app.
