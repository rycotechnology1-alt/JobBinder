# Wireframes & Screen Layouts (Step 4)

Now that the data model and API surface are locked, we can define the exact UI. The app is **Mobile-First** for field crews, but includes a **Desktop Dashboard** for admins to organize files.

## User Review Required
Please review these text-based wireframes. Do the screens feel simple enough for a field crew? Are any critical fields hidden too deep?

---

## 1. Company Dashboard (The Home Screen)

**Mobile View:**
```text
======================================
[ Menu ]        JobBinder      [ Inbox(3) ]
======================================
[ + New Job ]
--------------------------------------
Filters: [Active v] [Priority v] [Search...]
--------------------------------------
[ Job Card ]
  Title: 123 Main St Rewire
  Customer: John Smith
  Status: [ N Days Left (3) ] | Priority: 4
  Recent Activity: "Photo uploaded 2h ago"
--------------------------------------
[ Job Card ]
  Title: Downtown Plumbing Fitout
  Customer: ABC Corp
  Status: [ Punch List ] | Priority: 5
  Recent Activity: "Progress log added 1d ago"
======================================
```
**Desktop Differences:** The Job Cards display as a clean 3-column grid. The Inbox icon is a persistent sidebar item.

---

## 2. New Job Modal
*Triggered from Company Dashboard*

```text
======================================
           Create New Job
======================================
Job Title (Required)  [____________________]
Customer Name         [____________________]
Job / PO Number       [____________________]
Address               [____________________]

[ Advanced Options v ] (Expands to show:)
  - Contact Name/Phone
  - Target Completion Date
  - Priority (1-5)

       [ Cancel ]      [ Create Job ]
======================================
```
*Note: We keep the form short to encourage immediate use. Advanced options are tucked away.*

---

## 3. Job Dashboard (The Job Folder)

**Mobile View:**
```text
======================================
[ < Back ]    123 Main St Rewire 
======================================
Status: [ Active v ]    Priority: [ 4 v ]
Customer: John Smith
Contact: (555) 123-4567 | Call | Text
--------------------------------------
[ + Quick Add ] (Opens action sheet: Photo, Note, Progress Log, Task)
--------------------------------------
[ Tabs / Accordions ]
> OVERVIEW
   Description, Address, Target Date
> PROGRESS LOGS (4)
   - [Today, 9am] "Pulled wire to subpanel" (by Dave)
> NOTES (2)
   - "Customer requested extra outlet"
> PHOTOS (12)
   [ Thumb ] [ Thumb ] [ Thumb ] [ Thumb ]
> FILES / PDFS (3)
   - Panel_Cut_Sheet.pdf
   - Approved_Permit.pdf
> TASKS & PUNCH LIST (2 Open)
   - [ ] Final inspection schedule
======================================
```

---

## 4. Quick Add Modals (Mobile Field Capture)

### Add Progress Log
```text
======================================
           Log Progress
======================================
Date/Time: [ Automatically set to Now ]
Work Performed:
[ Text area for description... ]

Attach Photos: [ Camera Icon ] [ Gallery Icon ]
Status Tag: [ e.g., "Rough-in" ]

       [ Cancel ]      [ Save Log ]
======================================
```

### Upload Photo (Paid AI Flow)
```text
======================================
           Upload Photo
======================================
[ Image Preview ]

AI Suggested Name: "Subpanel Wiring"   [ Edit ]
AI Category: "During"                  [ Edit ]

Attach to: [ Note / Progress Log / Task v ] (Optional)

       [ Cancel ]      [ Save Photo ]
======================================
```
*If Free Tier: AI fields are blank and require manual entry.*

---

## 5. Unsorted Inbox (Company-Wide Staging Area)

**Desktop View:**
```text
======================================
           Unsorted Inbox
======================================
You have 3 items waiting to be organized.

[ Image Thumb ] 
  Captured: Today at 2:00 PM by Dave
  Assign to Job: [ Select Job... v ]
  Name: [ Panel Wiring        ]
  [ Delete ] [ Save to Job ]
--------------------------------------
[ Note Icon ]
  Text: "Material delivery was short 2 boxes."
  Captured: Yesterday at 4:00 PM by Mike
  Assign to Job: [ Select Job... v ]
  [ Delete ] [ Save to Job ]
======================================
```
*Note: Offline captures silently arrive here once the device regains connection.*

## Verification Plan
Once you approve these layouts, we've completed Step 4. We will then lock in Step 5 (Tech Stack), which you've already indicated will be Next.js + Postgres + Vercel. After that, we can immediately begin Step 6: Building the Backend!
