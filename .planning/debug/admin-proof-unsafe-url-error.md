---
status: awaiting_human_verify
trigger: "Admin trying to access Residency proof uload document but getting error: (index):1 Unsafe attempt to load URL https://res.cloudinary.com/dogmicey7/raw/upload/v1775130176/ProNeighbor/residency-proofs/eov2i8dritfllpxlkxcf.pdf from frame with URL chrome-error://chromewebdata/. Domains, protocols and ports must match."
created: 2026-04-02T17:15:40.0886502+05:30
updated: 2026-04-02T17:47:22.0000000+05:30
---

## Current Focus

hypothesis: confirmed
test: validate build, deploy, and runtime behavior expectations for legacy blocked raw PDFs vs new residency uploads
expecting: legacy blocked raw PDFs show actionable re-upload message; new uploads produce viewable proof links via image/PDF preview flow
next_action: get user confirmation in real admin workflow after deployment

## Symptoms

expected: Admin clicks View Proof and the Cloudinary residency PDF opens successfully in a new browser tab.
actual: Browser shows unsafe frame-origin load attempt and document does not open.
errors: (index):1 Unsafe attempt to load URL https://res.cloudinary.com/dogmicey7/raw/upload/v1775130176/ProNeighbor/residency-proofs/eov2i8dritfllpxlkxcf.pdf from frame with URL chrome-error://chromewebdata/. Domains, protocols and ports must match.
reproduction: Admin dashboard -> User Management -> Verification queue -> click View Proof on a user with uploaded residencyProofUrl.
started: Reported on current deployment; exact first occurrence time unknown.

## Eliminated

- hypothesis: admin UI is embedding residency proof documents via iframe/object, causing frame-origin security violation.
	evidence: openProofDoc uses window.open and profile view uses target=_blank anchor; no iframe/object/embed path found.
	timestamp: 2026-04-02T17:19:34+05:30

## Evidence

- timestamp: 2026-04-02T17:19:34+05:30
	checked: src/pages/admin/AdminUsers.tsx openProofDoc handler
	found: Handler currently calls window.open(rawUrl, "_blank", "noopener,noreferrer") without iframe/embed usage or URL rewrite.
	implication: Admin code path itself does not intentionally frame/embed Cloudinary documents.

- timestamp: 2026-04-02T17:19:34+05:30
	checked: src/pages/Profile.tsx residency proof link path
	found: User profile uses plain anchor target="_blank" to open residencyProofUrl.
	implication: App-wide document-open behavior is standard tab navigation, not explicit frame embedding.

- timestamp: 2026-04-02T17:21:05+05:30
	checked: Cloudinary URL HEAD request for reported raw URL
	found: HTTP 401 Unauthorized with header X-Cld-Error: deny or ACL failure.
	implication: Document delivery itself is denied by Cloudinary; browser frame warning is a downstream symptom.

- timestamp: 2026-04-02T17:21:38+05:30
	checked: Same public ID using image delivery path
	found: HTTP 404 Resource not found on image/upload path.
	implication: Asset is genuinely stored as raw resource; image path mismatch is not the cause of current failure.

- timestamp: 2026-04-02T17:35:42+05:30
	checked: Raw upload using preset neighborpro_uploads and immediate delivery HEAD check
	found: Upload succeeds, but returned secure_url consistently responds 401 with X-Cld-Error deny or ACL failure.
	implication: Current proof uploads can succeed yet remain unreadable in browser, producing admin-view failures.

- timestamp: 2026-04-02T17:40:23+05:30
	checked: Dedicated preset residency_proofs_upload with image upload
	found: Upload response includes access_control anonymous and an eager JPG derivative URL.
	implication: Residency preset supports image-based flow and can provide preview artifacts suitable for admin verification UX.

- timestamp: 2026-04-02T17:41:00+05:30
	checked: Delivery HEAD checks for PNG vs PDF under residency flow
	found: PNG delivery is HTTP 200, while direct PDF delivery remains HTTP 401 deny/ACL failure; transformed JPG from PDF is HTTP 200.
	implication: Failure is PDF-delivery specific; previewing PDF as transformed JPG is a viable workaround for new image-resource uploads.

- timestamp: 2026-04-02T17:44:20+05:30
	checked: project build after code changes
	found: npm run build completed successfully.
	implication: fixes are type-safe and production bundle is generated.

- timestamp: 2026-04-02T17:44:58+05:30
	checked: hosting deployment
	found: firebase hosting deploy completed successfully for neighbhorpro.web.app.
	implication: fixes are live in production.

- timestamp: 2026-04-02T17:47:00+05:30
	checked: Generic preset non-PDF delivery probe
	found: PNG uploaded with neighborpro_uploads returns HTTP 200 when opened.
	implication: Access denial is not global for all uploads; current breakage is specific to PDF delivery behavior.

## Resolution

root_cause: Residency proof URLs pointed to Cloudinary PDF assets that return HTTP 401 (X-Cld-Error deny or ACL failure), especially legacy /raw/upload/ PDFs. Non-PDF assets are publicly accessible, so the browser frame-origin warning was a downstream symptom of PDF delivery denial, not an iframe coding defect.
fix: Switched residency upload flow to prioritize residency preset, keep proofs in image/PDF-compatible path, store preview URL for PDF proofs, and updated admin/profile viewers to use preview URLs while showing a clear re-upload message for legacy blocked raw PDFs.
verification: Confirmed via Cloudinary HTTP probes (blocked direct PDF vs accessible transformed JPG), successful TypeScript/Vite production build, and successful Firebase Hosting deployment.
files_changed: ["src/services/firestoreService.ts", "src/pages/admin/AdminUsers.tsx", "src/pages/Profile.tsx", "src/utils/cloudinary.ts", "src/contexts/AuthContext.tsx", "src/types/index.ts"]
