# Product Brief: Simple Job Management App for Small Construction Companies

## Working Product Name
**JobBinder** / **CrewFile** / **SiteFolder**  
Placeholder name for now: **JobBinder**

## Product Summary
Small construction companies need a simple, affordable way to organize job information, capture field progress, store job photos, upload PDFs/files, and coordinate small crews without adopting a full construction management or accounting platform.

Most construction software is built for larger contractors. It often includes accounting, estimating, scheduling, complex permissions, customer portals, enterprise workflows, and expensive per-seat pricing. A 1–5 person contractor usually does not need that level of system. They need something closer to a smart job folder that their whole small crew can actually use.

**JobBinder** is a mobile-first job organization and field documentation app for small construction companies. Each job becomes a clean digital folder where the crew can store notes, progress logs, photos, files, contacts, tasks, and punch list items. The product should help small contractors run jobs, stay organized, and preserve job history without becoming a heavy project management system.

The app should include a paid AI organization layer that automatically suggests file names and categories for uploaded photos and files. AI should reduce admin work, but the MVP should not depend on expensive AI features for core usefulness.

## Target Customer
Small construction companies with approximately **1–5 users**.

Example users:
- Solo owner-operator with occasional helpers
- Small electrical contractor
- Small plumbing/HVAC contractor
- Small carpenter/remodeler
- Small excavation/site contractor
- Small handyman or service company
- Small specialty subcontractor
- Small general contractor managing a few active jobs

These users commonly manage jobs through a mix of phone photos, text messages, paper notes, email attachments, PDFs, and memory. They need job organization, field documentation, and crew coordination, not accounting software.

## Core Pain Point
Small contractors need to keep job information organized across the whole crew, but existing construction management tools are usually too expensive, too complex, or too broad.

Common current problems:
- Job photos are scattered across personal phone galleries.
- PDFs live in email threads, downloads folders, text messages, or paper folders.
- Field notes are handwritten, texted, or forgotten.
- Progress documentation is inconsistent.
- Small crews do not have one shared job history.
- Punch list items and small tasks get lost in conversations.
- Customer contacts, job address, PO number, and job number are not always easy to find.
- Field users may not have reliable internet at every jobsite.
- Existing tools include accounting, estimating, and scheduling features that small contractors do not want in this product.

## Product Positioning
**A simple job folder app for small construction crews.**

Possible positioning lines:
- “Every job gets one clean digital folder.”
- “Photos, notes, files, progress, and punch lists organized by job.”
- “Built for 1–5 person contractors who do not need a full construction management system.”
- “The job file your small crew will actually use.”
- “Simple field documentation for small contractors.”

## What This Product Is
- A lightweight job file and field documentation app.
- A shared job folder for small crews.
- A mobile-first place to capture job photos, notes, progress logs, files, and tasks.
- A tool to organize job information by job number, PO number, contract number, customer, or address.
- A practical paid AI-assisted filing and organization tool.
- A clean desktop dashboard for reviewing and organizing job records.

## What This Product Is Not
- Not accounting software.
- Not payroll software.
- Not estimating software at MVP.
- Not a calendar or scheduling system.
- Not a full Procore-style construction management platform.
- Not intended for large enterprise contractors at launch.
- Not a complicated ERP system.

## MVP Goals
The MVP should answer one main question:

**Can a small construction crew use this app every day to capture, organize, and review job information with less friction than phone galleries, texts, emails, and paper folders?**

The MVP should prioritize:
1. Creating and finding jobs quickly.
2. Letting a small crew share job information from day one.
3. Capturing photos, notes, progress logs, tasks, and files with minimal clicks.
4. Supporting offline field capture on day one.
5. Providing an unsorted inbox for quick capture when the user does not want to choose a job immediately.
6. Using paid AI assistance to automatically suggest names and categories for uploads.
7. Keeping the app simple enough for non-technical field users.

## Primary User Stories

### Job Creation
As a small contractor, I want to create a job using any practical identifier, including job number, PO number, contract number, customer name, or address, so that I can quickly start organizing information.

### Small Crew Access
As an owner or admin, I want to invite employees to the company account so that my small crew can add photos, notes, files, tasks, and progress updates to shared jobs.

### Job Contacts
As a user, I want customer name, job address, and contact information to live directly on the job so that everyone knows who the job is for and who to contact.

### Job Notes
As a user, I want to add general notes to a job so that important conversations, conditions, reminders, and field information are preserved.

### Progress Logs
As a user, I want progress logs to be separate from general notes so that I can clearly see what work was completed and when.

### Job Photos
As a user, I want to take photos directly in the app or upload photos from my gallery so that job photos are saved to the correct job instead of being lost in my camera roll.

### Job Files
As a user, I want to upload PDFs and other job files so that permits, plans, quotes, receipts, cut sheets, inspection forms, and customer documents are all stored in one job folder.

### Unsorted Inbox
As a user, I want to quickly capture photos, notes, or files into an inbox when I do not have time to pick the right job, so that I can organize them later.

### Offline Capture
As a field user, I want to capture notes, photos, progress logs, and tasks even when I do not have service so that documentation does not stop at jobsites with poor connection.

### Tasks and Punch List
As a user, I want to create simple tasks and punch list items so that small job follow-ups do not get lost.

### Paid AI File Organization
As a paying customer, I want the app to automatically suggest names and categories for uploaded photos and files so that job organization requires less manual effort.

### Search
As a user, I want to quickly search jobs and job content so that I can find information by job number, PO, contract number, customer, address, file name, note text, or task.

## MVP Feature Set

### 1. Company / Team Account
The app should assume a small crew/team from day one.

Core company/team features:
- Company account
- Owner/admin user
- Employee invitations
- Basic user list
- Ability to deactivate/remove users
- Simple role model, likely Owner/Admin and Member for MVP

Avoid complex enterprise permissions at MVP. The first version should assume trust within a very small company.

### 2. Jobs
Each job should have a basic profile.

Job fields:
- Job title/name
- Job number
- PO number
- Contract number
- Customer name
- Job address/location
- Customer contact name
- Customer contact phone
- Customer contact email
- Status/progress state
- Priority level from 1–5, where 5 is highest priority
- Created date
- Optional description

A job can be created with any practical identifier. The app should not force all fields to be completed before the user can start using the job.

### 3. Job Status and Priority
The main company dashboard should show each job as a context card with a quick project brief.

Each job card should show:
- Job title
- Customer name
- Job address, if available
- PO / contract # / job #, as available
- Project priority from 1–5
- Project progress/status
- Recent activity summary

Project progress/status options:
- Design
- N Days Left
- Delay
- Punch List
- Complete

For `N Days Left`, the app should support a number value so the card can display something like:
- `3 Days Left`
- `10 Days Left`

Potential future improvement: allow custom statuses, but MVP can start with the defined list above.

### 4. Company Dashboard
The primary dashboard should be a clean list/grid of job context cards.

Dashboard goals:
- Quickly understand active jobs.
- Identify highest-priority jobs.
- See which jobs are delayed, close to completion, or in punch list.
- Jump into a job quickly.
- Review recent activity.

Recommended filters:
- Active jobs
- Priority
- Status/progress
- Customer
- Recently updated

Recommended sorting:
- Highest priority first
- Recently updated
- Created date
- Status/progress

### 5. Job Dashboard
Each job should open into a simple digital job folder.

Job sections:
- Overview
- Notes
- Progress Logs
- Photos
- Files
- Tasks / Punch List
- Contacts
- Future Sketches / Markup placeholder

The job page should feel like a folder, not an accounting screen or enterprise project management workspace.

### 6. Notes
General notes should be separate from progress logs.

Note fields:
- Note text
- Date/time stamp
- Created by
- Optional photo/file attachment
- Optional tag/category

Possible note categories:
- General
- Customer conversation
- Field condition
- Material issue
- Inspection
- Change / extra work note
- Safety note
- Internal reminder

### 7. Progress Logs
Progress logs should be their own first-class feature.

Progress entry fields:
- Date/time
- Work performed description
- Created by
- Photos
- Files
- Optional status tag
- Optional task/punch list link

Example progress entry:
“Installed conduit from panel room to rooftop unit. Need to return with wire and final labels.”

Progress logs should create a chronological job history that is easy to review.

### 8. Photos
Users can add images to a job from:
- Device camera
- Phone gallery
- Desktop upload
- Unsorted inbox

Photo features:
- Automatic date/time stamp
- Created by
- Optional description
- Optional category
- Paid AI-suggested photo name
- Paid AI-suggested category
- Ability to attach photo to a note, progress log, task, or punch list item

Possible photo categories:
- Before
- During
- After
- Issue
- Material
- Inspection
- Damage
- Completed work
- Punch list
- Miscellaneous

### 9. Files
Users can upload files to a job, especially PDFs.

Supported MVP file types:
- PDF
- JPG/PNG images
- Word documents, optional
- Excel files, optional

File features:
- Upload from phone or desktop
- Store under a job or in the unsorted inbox
- Rename file
- Paid AI-suggested file name
- Paid AI-suggested file category
- Basic preview for PDFs and images
- Download/share file
- Attach file to a note, progress log, task, or punch list item

Possible file categories:
- Plans
- Permits
- Quotes
- Invoices
- Receipts
- Cut sheets
- Inspection documents
- Customer documents
- Photos
- Miscellaneous

### 10. Unsorted Inbox
The app should include an inbox for fast capture.

The inbox allows users to upload or capture items without immediately assigning them to a job.

Inbox item types:
- Photos
- Files
- Notes
- Progress drafts, optional

Inbox workflow:
1. User captures or uploads an item quickly.
2. Item lands in the inbox.
3. User later assigns item to a job.
4. User optionally edits name, category, and description.
5. Paying users receive automatic AI name/category suggestions.

This is important because field users often need to capture information quickly and organize it later.

### 11. Offline Capture
Offline capture should be included from day one.

Offline MVP scope:
- Create local notes
- Capture local photos
- Create progress logs
- Create tasks/punch list items
- Save items to a local pending sync queue
- Sync when connection returns
- Show clear sync status to the user

Offline considerations:
- Users should know what has synced and what has not.
- The app should prevent silent data loss.
- Conflicts should be kept simple at MVP.
- If an item was captured offline, it should retain the original capture timestamp.

Recommended MVP approach:
- Mobile web/PWA with offline capture support.
- Store pending items locally on device.
- Sync queued records and file uploads when the device regains connection.

### 12. Tasks / Punch List
The app should support simple tasks and punch list items in MVP.

Task fields:
- Title
- Description
- Status: Open, In Progress, Done
- Assigned to, optional
- Due date, optional
- Priority, optional
- Related photos/files, optional
- Created by
- Created date

Punch list item fields can use the same underlying structure as tasks, with a `Punch List` type or category.

Recommended MVP design:
- Build one simple `Task` model that can also represent punch list items.
- Allow tasks to be viewed at the job level.
- Allow tasks to be linked to photos, files, notes, and progress logs.

### 13. Sharing
For MVP, photos and files should be shareable through the device’s native share flow.

Example:
- On iPhone, user taps share on a photo or file.
- The normal iOS share sheet opens.
- User can choose Messages, Mail, Outlook, Gmail, or other installed apps.

MVP sharing should focus on device-native sharing rather than public links or internal customer portals.

MVP sharing method:
- Email attachment / native device share flow only

Defer:
- Public share links
- Customer portal
- External client access
- Full job packet report export

### 14. Sketching / Markup Framework Placeholder
Sketching is not an MVP user-facing feature, but the product should be designed so sketching/markup can be added later.

MVP should include backend and data model placeholders where practical:
- Attachment type support for future sketches
- Future markup records linked to job/photo/file
- Storage structure that can support generated markup images/files
- UI placeholder or roadmap-aware architecture, but no full sketching interface required

Future sketching/markup possibilities:
- Basic photo markup: arrows, circles, text, highlights
- Blank canvas sketch attached to job
- PDF/image markup
- Plan sheet markup

### 15. AI-Assisted Organization — Paid Feature
AI suggestion features should be limited to paying customers.

For paid users, AI should automatically suggest names and categories on upload.

MVP paid AI features:
- Suggest a clean file name for uploaded files.
- Suggest a clean photo name for uploaded photos.
- Suggest file category.
- Suggest photo category.

Free tier behavior:
- Users can upload files/photos.
- Users can manually rename and categorize.
- No automatic AI suggestions.

Paid tier behavior:
- AI runs automatically on upload when supported.
- AI suggestions are shown to the user.
- User can accept, edit, or ignore suggestions.
- Original file name should remain visible in item metadata.

AI should be cost-aware and practical. The goal is not to make the product feel like an AI app. The goal is to save admin time.

### 16. PDF Summarization — Later Feature
PDF summarization should be deferred until after MVP.

Future PDF AI features:
- Short PDF summary
- Document type detection
- Key dates
- Key contacts
- Job address extraction
- Permit number extraction
- Vendor/customer extraction
- Suggested file name
- Suggested category

This should be planned architecturally, but not required for initial MVP launch.

### 17. Search and Filtering
Users should be able to search:
- Jobs
- Job numbers
- PO numbers
- Contract numbers
- Customer names
- Addresses
- Contact names
- File names
- Notes
- Progress logs
- Tasks/punch list items

Basic filters:
- Active jobs
- Completed jobs
- Priority
- Status/progress
- Customer
- Date range
- File type/category
- Open tasks
- Punch list items

### 18. Mobile Web First + Desktop Dashboard
The product should be mobile web first with a clean desktop dashboard.

Recommended technical product direction:
- Mobile-first web app / PWA
- Offline capture support
- Desktop dashboard for review, organization, and job oversight

Mobile priorities:
- Create job quickly
- Capture photo quickly
- Add note quickly
- Add progress log quickly
- Add task/punch list item quickly
- Upload/view PDF
- Use unsorted inbox
- Sync offline captures

Desktop priorities:
- Review job cards
- Organize files/photos
- Review progress logs
- Manage tasks/punch list items
- Upload multiple files
- Manage employees
- Edit job details
- Review AI suggestions on paid plans

## Suggested MVP Scope

### Must Have
- Company/team account
- Employee invitations
- Create jobs using job #, PO #, contract #, customer, or address
- Customer name, address, and contacts stored on job
- Company dashboard with job context cards
- Job priority 1–5
- Job progress/status: Design, N Days Left, Delay, Punch List, Complete
- Job dashboard/folder
- General notes
- Separate progress logs
- Photos from camera/gallery/upload
- File uploads, especially PDFs
- Unsorted inbox
- Offline capture from day one
- Tasks/punch list items
- Search jobs and job content
- Native share flow for photos/files
- Paid AI-suggested names and categories for photos/files
- Free plan with 5 GB storage
- Backend/data model placeholder for future sketching/markup

### Should Have
- Basic employee roles: Owner/Admin and Member
- Recently updated activity on job cards
- Manual file/photo categories
- Simple sync status indicators
- Attach photos/files to notes, progress logs, and tasks
- Desktop dashboard for review and organization

### Could Have Later
- PDF summarization
- Full sketching canvas
- Photo markup
- PDF/plan markup
- Clean job packet report export
- Progress report export
- Customer portal
- Change order tracking
- Time tracking
- Material tracking
- Calendar/scheduling
- Vendor/subcontractor contact management
- Voice notes/transcription
- OCR from handwritten field notes
- Custom project statuses
- Public share links

### Should Not Have in MVP
- Accounting
- Payroll
- Full estimating
- Calendar/scheduling
- Complex project schedules
- Enterprise permissions
- Customer portal
- Public file links
- Deep ERP integrations
- Heavy reporting dashboards
- PDF summarization
- Full sketching UI
- Job packet export

## AI Strategy
The app should use AI where it reduces manual filing and organization. AI should be positioned as a paid productivity layer, not the core requirement for using the app.

### MVP AI Use Cases — Paid Only
- Automatically suggest photo names on upload.
- Automatically suggest photo categories on upload.
- Automatically suggest file names on upload.
- Automatically suggest file categories on upload.

### Later AI Use Cases
- Summarize uploaded PDFs.
- Extract key details from PDFs.
- Generate daily or weekly progress summaries.
- Turn rough notes into cleaner job notes.
- Extract tasks from progress notes.
- Suggest punch list items from photos/notes.
- OCR handwritten notes.

### AI Cost Control Ideas
- Use smaller/cheaper models for classification and naming.
- Run AI only for paid customers.
- Run AI on upload for paid users, but cache results.
- Batch work where possible.
- Limit AI processing by file type and size.
- Use image/document metadata and OCR/text extraction before involving larger models.
- Avoid PDF summarization until after MVP.

### AI UX Principles
- AI suggestions should be editable.
- Original file names should remain visible in metadata.
- AI should not hide or delete user content.
- Users should be able to accept, edit, or ignore suggestions.
- AI outputs should be short, practical, and construction-oriented.

## Storage and Pricing Direction
The free MVP plan should include **5 GB of storage**.

Free plan:
- 5 GB storage
- Core job folders
- Notes
- Progress logs
- Photos/files
- Tasks/punch list
- Unsorted inbox
- Manual naming/categorization
- No AI suggestions

Paid plans:
- Expanded storage limits
- AI naming/category suggestions
- More users, if needed
- Future advanced features such as PDF summarization, reports, and markup

Possible pricing structure to explore:
- Free: 5 GB storage, no AI
- Solo Paid: more storage, AI suggestions
- Small Crew Paid: up to 5 users, more storage, AI suggestions

Pricing should stay simple and approachable because the target market is small contractors.

## Competitive Gap
Existing construction tools often serve larger contractors and include many features small contractors do not want to manage.

This product should win by being:
- Simpler
- Cheaper
- Faster to start
- Built around job folders, not accounting
- Mobile-first
- Offline-capable
- Useful for small crews from day one
- Organized enough for professional documentation
- AI-assisted for paid users without becoming complicated

## Key Risks
- Product becomes too broad and starts resembling larger PM platforms.
- Offline capture adds technical complexity and must be done carefully to avoid data loss.
- Storage costs become expensive if photo/file uploads are heavy.
- AI costs become too high if not limited to paid users and efficient workflows.
- Small contractors may resist subscription pricing unless storage, crew coordination, and organization value are obvious.
- Sketching/markup may become a distraction if attempted too early.
- Native share flow may behave differently across devices and browsers.
- PWA capabilities may vary between iOS, Android, and desktop browsers.

## Open Product Questions
1. What should the exact employee invite flow look like? Email invite link, code, or admin-created login?
2. Should invited employees have access to all company jobs by default, or should the owner choose which jobs they can see?
3. Should the free plan allow multiple users, or should multi-user access require a paid plan?
4. What should happen when the free 5 GB storage limit is reached?
5. Should offline capture be available on the free plan, or is it part of the core product for all users?
6. Should users be allowed to create jobs while offline?
7. Should users be able to upload large PDFs while offline, or only queue them for upload when online?
8. Should the unsorted inbox be personal per user, company-wide, or both?
9. Should tasks and punch list items be combined in one view or separated by tabs?
10. Should `N Days Left` be manually entered, or calculated from a target completion date?
11. Should project priority be company-visible only, or visible to all employees?
12. Should job contacts support multiple contacts or only one primary contact in MVP?
13. Should the app support file folders inside a job, or just categories/tags?
14. Should paid AI suggestions auto-apply, or should they always require user confirmation?
15. Should the app keep a visible activity feed showing every photo, file, note, progress entry, and task update?
16. Should users be able to export their data if they cancel?
17. Should the app include basic notifications for assigned tasks, or exclude notifications from MVP?

## Recommended Initial MVP Direction
Build a **mobile-first web app/PWA with a desktop review dashboard** that lets a small construction crew:

1. Create a shared company account.
2. Invite employees.
3. Create jobs by job number, PO number, contract number, customer, or address.
4. Store customer name, address, and contacts on the job.
5. View jobs as dashboard context cards with priority and progress/status.
6. Capture notes, progress logs, photos, files, and tasks.
7. Use an unsorted inbox for fast field capture.
8. Capture important information offline and sync later.
9. Share photos/files through the device-native share flow.
10. Use paid AI features to automatically suggest names and categories for photos/files.

Defer accounting, estimating, scheduling, PDF summarization, full sketching, customer portals, public share links, and formal job packet exports until the core job-folder workflow proves daily use with small contractors.

