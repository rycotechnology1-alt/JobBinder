# Backend Implementation Plan (Step 6)

With the tech stack finalized (Step 5), we are ready to move on to **Step 6: Build the Backend First**. 

**Locked Tech Stack:**
*   **Framework:** Next.js (App Router)
*   **Hosting:** Vercel
*   **Database:** Postgres via Neon
*   **ORM:** Prisma
*   **Storage:** Cloudflare R2
*   **Image Optimization:** Client-side reduction for Free Users

## User Review Required
Please review the plan below. If approved, I will begin executing this plan immediately and writing code. 

## Open Questions
*   **Email Provider:** I am planning to use **Resend** for sending invite emails. It's the industry standard for Next.js. Does that work for you?

## Proposed Changes

### 1. Database Setup (Neon & Prisma)
1. Initialize the Next.js project.
2. Install Prisma and wire it up to the `DATABASE_URL` (which you will provide from Neon).
3. Run the initial migration using the exact `schema.prisma` we locked in during Step 2.

### 2. Storage & Image Handling (Cloudflare R2)
Cloudflare R2 is 100% S3-compatible, so we will use the standard AWS S3 SDK.
1. **API Route:** Create `POST /api/files/upload-url` which generates a pre-signed URL from R2. 
2. **Client-side Compression:** We will install `browser-image-compression`. When a user selects a photo on their phone:
   *   We check if the user's company plan is `FREE`.
   *   If free, the photo is immediately compressed on their phone (e.g., max 1920x1080, 80% quality) *before* requesting the upload URL. This saves both their cellular data and our Cloudflare R2 storage limits.
   *   The client then uploads directly to R2.
3. **Database Write:** The client hits `POST /api/files` to log the new file in our database.

### 3. API Routing Generation
We will create the Next.js App Router endpoints (`app/api/...`) that we defined in Step 3:
*   `/api/company`
*   `/api/jobs`
*   `/api/notes`
*   `/api/tasks`

### 4. Email Integration
1. Set up Resend SDK.
2. Build the `POST /api/users/invite` endpoint to trigger a simple HTML email containing an invite link.

## Verification Plan
Once the backend is built, we will:
1. Run Prisma Studio to verify the database tables exist in Neon.
2. Send test HTTP requests to create a Job, add a Note, and generate an R2 upload URL.
3. I will create a `walkthrough.md` to show you exactly how to test these endpoints.
