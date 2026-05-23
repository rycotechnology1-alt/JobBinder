# Scanic Scanner Feasibility Notes

## Prototype Entry Points

- Isolated route: `/prototypes/scanner-scanic`
- Reusable scanner provider: `src/features/uploads/scanner-scanic/scanicProvider.ts`
- Upload modal host: `src/features/uploads/scanner-scanic/ScanicScannerHost.tsx`

## Scanic API Findings

Source: https://github.com/marquaye/scanic

- Published package inspected: `scanic@1.0.8`
- Scanic exposes `scanDocument(image, options)`, `extractDocument(image, corners, options)`, and a reusable `Scanner` class.
- Detection mode returns document `corners` and `contour`.
- Extract mode returns a perspective-corrected output canvas.
- The `Scanner` class is intended for repeated or real-time use because it keeps the WASM instance warm.
- Scanic does not own camera access. The prototype uses browser `navigator.mediaDevices.getUserMedia`.
- Scanic does not currently expose a higher-level mobile scanner UI, auto-capture flow, manual corner editor, OCR, or built-in PDF generation.

## Implemented Prototype Behavior

- Opens the rear camera with `facingMode: { ideal: "environment" }`.
- Shows a live camera preview in a mobile-first full-screen scanner modal.
- Runs Scanic live detection on a downscaled frame every `650ms`.
- Draws a live polygon overlay from Scanic corner coordinates when detection succeeds.
- Captures the full-resolution video frame manually.
- Uses latest live corners with `extractDocument` when available.
- Falls back to post-capture Scanic extraction when live corners are unavailable.
- Falls back to full-image capture when Scanic extraction fails.
- Stores multiple scanned pages in local state with thumbnail selection and deletion.
- Generates a single PDF with `pdf-lib`, one JPEG image per PDF page.
- Returns a browser `File` through the provider contract.

## Mobile Testing Status

- iPhone Safari: not yet physically tested in this environment.
- Android Chrome: not yet physically tested in this environment.
- Desktop/local automated tests validate PDF helper behavior and upload-modal handoff only.

Real-device checks still needed:

- Camera permission prompt wording and recovery.
- Whether iPhone Safari accepts the Scanic dynamic import and WASM path in a production build over HTTPS.
- Whether rear-camera selection consistently chooses the wide rear camera instead of the front camera.
- Detection stability under normal job-site lighting.
- Capture latency and memory pressure across 10-20 pages.
- Whether the live overlay alignment needs object-fit correction on specific device aspect ratios.

## Local Network Mobile Testing Requirement

Opening the scanner from an iPhone or Android device at a plain LAN URL such as `http://10.0.0.243:3000` will not request camera permission. Mobile Safari and Chrome expose `navigator.mediaDevices.getUserMedia` only in secure contexts, so the scanner must be opened over HTTPS. `localhost` is treated specially for development, but `localhost` on the phone is the phone itself, not the dev machine.

Recommended test setup:

- Use an HTTPS tunnel to the Next dev server, then open the HTTPS tunnel URL on the phone.
- Or use a trusted local certificate and serve the app over HTTPS on the LAN.
- Plain `http://<LAN-IP>` is useful for layout checks, but not for camera scanning.

## Performance Notes

- The prototype does not process every video frame.
- Detection is throttled to a fixed interval.
- Detection frames are downscaled to a `720px` long edge.
- Capture extraction uses a full-resolution frame only after the user taps capture.
- Camera tracks are stopped on scanner close/unmount.
- Object URLs are revoked when pages are deleted or the scanner closes.

## Remaining Gaps Compared To A Polished Scanner

- No auto-capture once the document is steady.
- No manual corner adjustment UI.
- No image enhancement mode from Scanic yet. The Scanic roadmap mentions enhancement filters, but the current public API does not expose a production-ready enhancement control.
- No batch memory stress testing on mobile yet.
- No persisted scan metadata in the `File` database model. The upload modal sends scan metadata in the `/api/files` request body, but the current API/schema ignores unknown metadata fields. A production integration should add a structured metadata column or dedicated fields before relying on this data later.
