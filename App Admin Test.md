ProNeighbor Admin Panel — QA & Security Audit Report
Tested As: Admin (Manvendra Anjan · 9xtsnK19...)
Platform: https://neighbhorpro.web.app/admin
Date: 1 April 2026
Sections Tested: Dashboard, Users, Societies, Services, Reviews, Broadcast, Tickets, Wallet Admin (Overview, Payouts, Adjustments, User Ledger), Audit Log, Settings, Bookings

🟢 WHAT'S WORKING WELL
Area	Observation
User Delete	Confirmation dialog present: "Permanently remove [Name]'s profile? This cannot be undone." ✅
Society Delete	Confirmation dialog present with note "This will not remove associated users." ✅
Review Delete	Confirmation dialog: "Permanently remove this 1-star review by user?" ✅
Maintenance Mode	Confirmation dialog present before locking the platform. ✅
Audit Trail	Every admin action (Service.Approved, Service.Rejected, Broadcast.Deactivate, Review.Flag, Ticket.Status) is logged with admin UID, action type, details, and target ID. ✅
Manual Wallet Adjustment	Form warns: "🔒 This action is irreversible and logged to the admin audit trail with your UID." ✅
Ticket Threading	Ticket detail shows full conversation, system messages log status changes (e.g. "[SYSTEM] Ticket status has been set to: RESOLVED"), and a "Reopen" option is available. ✅
Broadcast Targeting	Audience segmentation available: All Users, Service Professionals, Admins Only, Society-Specific. ✅
User Export CSV	Available on both Users and Bookings pages. ✅
NC Wallet Balances Visible	User Ledger exposes per-user NC balances for informed financial decisions. ✅

🔴 CRITICAL / HIGH-SEVERITY FINDINGS
FINDING #1 — User Disable: No Confirmation Dialog
Section: Users → Action Buttons
Risk: Operational
An admin clicking Disable on a user executes immediately with no confirmation prompt. For a legitimate user, this terminates their access instantly. A misclick with no undo could cause support escalation or legal complaint (especially for Pro accounts with active bookings).
Recommendation: Add a confirmation modal: "Disable [Name]? They will lose access to the platform immediately."

FINDING #2 — "Make Admin" (Privilege Escalation): No Confirmation Dialog
Section: Users → Action Buttons
Risk: ⚠️ HIGH — Access Control / Security
Clicking Make Admin (granting full administrative privileges to any user) fires immediately with no confirmation dialog. This is a privilege escalation action that could be accidentally triggered or abused by a rogue admin account. It was observed to fire and fail (backend rejected it during testing), but the UI gives no safeguard.
Recommendation: Require a confirmation modal and/or second-admin-approval for privilege escalation. Consider logging a "Pending Admin Approval" state.

FINDING #3 — Service Reject/Approve: No Confirmation Dialog
Section: Services → Moderation
Risk: Operational / Legal
Clicking Reject on an approved service listing executes immediately — verified live during testing where "Stock Market" service by "Test Pro" was instantly rejected. This can cut off a professional's income stream without warning or an undo option.
Recommendation: Add confirmation: "Reject 'Stock Market' by Test Pro? This will remove it from public listings." Optionally require a rejection reason to be provided (for professional courtesy and legal defensibility).

FINDING #4 — Review Flag: No Confirmation Dialog
Section: Reviews → Moderation
Risk: Operational
Clicking Flag on a review instantly marks it as flagged with no confirmation. While reversible via Unflag, doing this on genuine reviews without intent could trigger downstream moderation automation.
Recommendation: Add: "Flag this review? It will be queued for moderation review."

FINDING #5 — Broadcast Stop: No Confirmation Dialog
Section: Broadcast → History
Risk: Operational / Communication
The Stop button on an active broadcast deactivates it immediately with no confirmation. Stopping an active platform communication (e.g. a "Platform Maintenance" alert) by accident could leave users uninformed.
Recommendation: Add: "Stop this broadcast? It will no longer be shown to users."

FINDING #6 — Ticket Status Changes: No Confirmation Dialog
Section: Tickets → Detail View
Risk: Operational
"→ resolved", "→ in progress", "→ closed" status transitions execute instantly. Marking a ticket as "Resolved" while a user still has an open issue is irreversible without using "Reopen".
Recommendation: Require confirmation for "Resolved" and "Closed" states. These should ideally require a mandatory admin note before marking complete.

FINDING #7 — Feature Flags Auto-Save Instantly Without Confirmation
Section: Settings → Feature Flags
Risk: ⚠️ HIGH — Platform-Wide Impact
Toggling any Feature Flag (New Registrations, Browse Professionals, Bookings, Messaging, Reviews & Ratings, Premium Societies) takes effect immediately and silently — no save button, no confirmation dialog. During testing, "New Registrations" was accidentally toggled OFF in one click, which would have blocked all new users from signing up platform-wide.

Contrast this with Core Configuration which properly requires a "Save Changes" button click.

Recommendation: Feature Flags are high-impact settings. Require either a dedicated confirmation modal per flag, or move them to the same "Save Changes" flow as Core Config. At minimum, show a toast "New Registrations disabled — affects all new sign-ups."

FINDING #8 — Admin Can Create Users With Admin Role Directly
Section: Users → Add User Record
Risk: ⚠️ HIGH — Privilege Escalation
The "+ Add User" form allows setting the Role dropdown to "Admin" at user creation time. This means any admin can create a new admin-level account with no secondary approval or audit gate. There is also no indication whether the temporary password forces a reset on first login.
Recommendations:

Creating admin-role users should require a second approval or elevated confirmation.

The "Temporary Password" field should explicitly state it will (or won't) force a password change on first login.

Notify the new user via secure channel (not plaintext) of their credentials.

🟡 MEDIUM-SEVERITY FINDINGS
FINDING #9 — Booking Management Page Not Linked from Sidebar
Section: Admin Navigation
Risk: Operational Discoverability
The /admin/bookings page (Booking Management) exists and works, but is not linked from the admin sidebar. It is only reachable via direct URL or via "Manage" quick links on the dashboard. This creates a hidden administrative surface that future admins may not know exists.
Recommendation: Add "Bookings" to the sidebar under Operations or Overview.

FINDING #10 — No Admin Booking Intervention Tools
Section: Bookings Management
Risk: Operational / Legal
The Booking Management table shows 4 bookings across statuses (Completed, Confirmed, Cancelled) but has zero admin action buttons. Admins cannot:

Override/cancel a booking

Force-complete a stuck booking

Reassign a booking to another Pro

Issue a refund or NC credit from the booking view

Booking ID links point to the user-facing booking page (not an admin detail view), and during testing clicked links redirected to admin dashboard.
Recommendations: Add per-booking admin actions: Cancel (with reason), Force Complete, Refund, and View Detail. Fix booking ID links to open an admin-specific booking detail modal.

FINDING #11 — Society Management Has No Edit Capability
Section: Societies
Risk: Data Integrity
The three-dot menu on each society card shows only "Delete" — there is no Edit option. If a society's name, address, or city needs correction, the only option is delete-and-recreate, which may orphan user society associations.
Recommendation: Add an Edit Society option with name, address, and city fields.

FINDING #12 — No Duplicate Detection When Adding a Society
Section: Societies → Add Society
Risk: Data Integrity
The "New Society" form (Name, Address, City) has no visible duplicate-detection warning. An admin could accidentally create "Park Diamond" twice.
Recommendation: Validate against existing society names before creation and warn if a near-duplicate exists.

FINDING #13 — Admin Can Delete Their Own Account
Section: Users
Risk: Operational / Access Control
A logged-in admin can see their own user row in the Users table and can click the delete (🗑) button on it. While a confirmation appears, there is no check that prevents a sole admin from self-deleting and locking the platform.
Recommendation: Prevent admins from deleting or disabling their own account. Require at least 1 active admin to remain at all times.

FINDING #14 — Temporary Brief Exposure of User-Facing UI Before Admin Auth Check
Section: Route Protection
Risk: Low-Medium — UX / Auth Race Condition
On direct navigation to admin-only routes (e.g. /admin/audit, /admin/bookings, /admin/settings), the page briefly renders the user-facing menu (Dashboard, Browse Pros, My Bookings etc.) before the Firebase auth role check completes and the admin layout loads. This is a client-side rendering race condition.
Recommendation: Implement a loading/skeleton state during auth resolution rather than showing the wrong layout. Ensure all admin data queries are server-side gated by role, not just client-side rendered.

FINDING #15 — No Rejection Reason Required for Service Rejection
Section: Services → Moderation
Risk: Legal / Professional Relations
When rejecting a service, no reason field is presented to the admin. The professional receives no recorded explanation for why their listing was rejected, creating legal exposure and poor professional experience.
Recommendation: Require a mandatory rejection reason (from a dropdown + optional notes) that is logged and communicated to the Pro.

🔵 OBSERVATIONS / LOW-SEVERITY / ENHANCEMENTS
#	Area	Observation
O1	Dashboard	"2,450+ neighbors are using ProNeighbor right now!" ticker appears to be a static/hardcoded string — not live data (only 13 users registered). This is misleading.
O2	Dashboard	Commission card shows ₹0 and Pro Earnings ₹0 despite completed bookings (₹300 Completed booking). Revenue reconciliation appears to have a calculation bug.
O3	Wallet Admin	Manual NC Adjustment form says "irreversible" but doesn't confirm the final amount before submission. A secondary "Review & Confirm" step would reduce fat-finger errors on financial adjustments.
O4	Tickets	No "Assign Ticket to Admin" feature — all tickets are unassigned. For multi-admin teams this creates accountability gaps.
O5	Audit Log	Filter is available (by action type), but there is no date-range filter. For compliance and investigation this is a critical missing tool.
O6	Broadcast	No preview of how the broadcast will appear to users before sending. A "Preview" step before "Send Broadcast" would prevent content errors.
O7	Verification Tab	Shows 0 pending verifications. The UI placeholder exists, suggesting the workflow is incomplete or not yet activated.
O8	Services	No bulk moderation — checkboxes exist on the service list but no "Bulk Approve" or "Bulk Reject" action bar appears when items are selected.
O9	Settings	Commission Rate slider is capped at 30% (max). No warning shown to admin about the business/legal implications of changing commission mid-operation (affects existing pro earnings).
O10	Users	"Set Pro" action has no confirmation dialog and no verification requirement. A user can be granted Pro status without document verification.

SUMMARY RISK MATRIX

Feature Flags must NOT auto-apply instantly — they need a Save button or individual confirmation modals, as a single misclick can lock down platform-wide features.

Restrict "Make Admin" and "Create Admin-Role User" behind secondary approval or an elevated auth challenge to prevent privilege escalation.

Add admin booking intervention tools (cancel, refund, force-complete) and fix booking ID links which currently redirect to the dashboard.

Require rejection reasons for Service Moderation and fix the misleading hardcoded user count ticker on the dashboard.