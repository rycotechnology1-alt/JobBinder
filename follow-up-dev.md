# JobBinder: Follow-Up Development Guide

This document is designed for the next developer or AI agent picking up this repository. It contains the exact state of the project and an ordered roadmap to complete the features originally defined in the `small_contractor_job_app_product_brief.md`.

---

## 🏗️ Current State of the Repo

**What is fully functioning:**
*   **Database (Neon/Prisma):** The complete schema is deployed. It supports Companies, Users, Jobs, Notes (General/Progress), Files, and Tasks.
*   **Core UI:** A premium, dark-mode glassmorphism aesthetic inspired by QuoteToSpec is implemented using Tailwind v4.
*   **Data Loops:** You can create Jobs, add Notes, and log Progress directly from the UI to the database. These instantly populate the Job Folder activity feed.
*   **Inbox API:** You can post unassigned notes directly to the Unsorted Inbox.

**The "Mock" Elements (Needs Replacement):**
*   **Auth:** We currently bypass authentication by querying `prisma.company.findFirst()`. 
*   **Dashboard Search/Filters:** The search bar and dropdowns on the Dashboard are currently static visual placeholders.

---

## 🚀 Execution Roadmap (In Order of Priority)

To achieve 100% feature parity with the MVP Product Brief, complete the following items in this exact order. Completion of this list means the core product is finished.

### Phase 1: Authentication & Access
The product assumes a small 1-5 person crew. We need real users before we can assign tasks or trace notes to specific employees.
- [ ] **Implement NextAuth (or Clerk):** Replace the mocked `findFirst` database calls with real session tokens.
- [ ] **Build the Team Settings UI:** Create a page where Admins can view their crew.
- [ ] **Wire the Invite System:** Connect the UI to the existing `POST /api/users/invite` Resend route so Admins can invite new crew members via email.

### Phase 2: Cloudflare R2 Uploads & Asset Categories
This is a critical field feature. The backend API for generating presigned URLs (`/api/files/upload-url`) already exists. The database also supports `category` fields for `Note` and `File`.
- [ ] **Client-Side Compression:** Implement `browser-image-compression` on the frontend before uploading (to save R2 bandwidth for the Free Tier).
- [ ] **Upload UI & Categorization:** Replace the placeholder "Add Photo" modal in the Job Folder with a working file selector. This modal must include a dropdown to select a **Category** (e.g., Before, During, After, Issue, Material, Inspection) so items are grouped logically, preventing a chaotic dump of files.
- [ ] **Feed Display & Filtering:** Update the Job Folder to display uploaded photos and PDFs. Add "Buckets" or filter tabs so users can quickly sort the Feed by these categories (e.g., view only "Inspection" photos or "Material issue" notes).

### Phase 3: Job Management & Editing
Right now, you can only create a Job with a Title and Customer Name.
- [ ] **Edit Job Details:** Build a UI to edit Job Number, PO Number, Contract Number, Address, and Contacts.
- [ ] **Completion Tracking:** Allow users to set a target completion date for the job. A progress bar appears on the dashboard job card to indicate how much time is left to hit the target completion date. The progress bar should be color coded to indicate how much time is left. Red for critical, yellow for warning, green for good..
- [ ] **Status:** Allow users to update the Job Status. 0/Red status = quoted only, 1/Yellow status = project started but delayed, 2/Green status = work in progress, 3/Blue status = punchlist ony, 4/Purple status = Final bill submitted, 5/Glowing purple blue green status = job is complete payment received. Ready for archive.
- [ ] **Priority:** Allow users to update the Job Priority (Low, Medium, High, Critical) The higher the priority the higher on the dashboard it will show up. Critical jobs will have a critical flag on the dashboard job card.
- [ ] **Dashboard Sync:** Ensure the Dashboard reads these updated statuses for the glowing progress bars and badges.

### Phase 4: The Unsorted Inbox Workflow
The Inbox successfully displays unassigned notes/files, but they are trapped there.
- [ ] **Assign to Job UI:** Wire up the "Assign to Job" buttons on the `/inbox` page to open a modal with a list of active jobs.
- [ ] **Move to Job API:** Create a `PATCH /api/notes` (and files) route to attach a `jobId` to the item, effectively moving it out of the inbox and into the Job Folder.

### Phase 5: Tasks & Punch Lists
The database supports Tasks, and the `POST /api/tasks` endpoint is written, but there is no UI.
- [ ] **Task List UI:** Build the UI inside the Job Folder (under the Tasks tab) to view open and completed tasks.
- [ ] **Create Task UI:** Build a "Quick Add Task/Punch List" modal.
- [ ] **Status Toggles:** Allow users to click a task to mark it as `IN_PROGRESS` or `DONE`.

### Phase 6: Search & Filtering
- [ ] **Dashboard Search:** Make the search bar functional so users can filter jobs by Title, Customer, PO Number, or Job Number.
- [ ] **Dashboard Filters:** Wire up the Status dropdowns (Active, Delay, Complete).

### Phase 7: PWA & True Offline Mode
The brief emphasizes offline capture for jobsites without cell service.
- [ ] **Service Worker Setup:** Implement a PWA service worker to cache the UI shell so the app loads without internet.
- [ ] **IndexedDB Sync Queue:** When offline, intercept POST requests (Notes/Photos) and save them locally to IndexedDB.
- [ ] **Auto-Sync:** Detect when the network returns and automatically flush the IndexedDB queue to the Neon database.

### Phase 8: AI-Assisted Organization (Paid Feature)
This is the final polish step reserved for paid tiers.
- [ ] **AI Integration:** When a photo/file is uploaded, pass it to an LLM (like OpenAI Vision or Claude) to suggest a clean File Name and Category.
- [ ] **Suggestion UI:** Present the AI suggestions to the user for approval before permanently renaming the file. 

---
*Note to next agent: Do not attempt Phase 7 (Offline Mode) until Phase 2 (Uploads) is completely finished, as offline syncing of large binary blobs requires a stable online upload foundation first.*
