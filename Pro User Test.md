ProNeighbor Pro Persona — Full QA Testing Report
Tester Role: Service Professional (Proxecute Consulting) | Date: April 1, 2026 | Account: proxecute.consulting@gmail.com

🔴 CRITICAL BUGS (Blocks Earnings / Destroys Trust)
1. Pro Profile Invisible in Browse Pros
Section: Browse Pros

Even with Service Provider Mode ON, 2 services listed, residency verified, and 88% profile completeness, the profile does not appear in Browse Pros — not under "All", not under "Fitness", not anywhere. The page says "No professionals found — Be the first! Update your profile to list your skills." A Pro whose income depends on being discovered cannot be found by anyone. This completely blocks organic booking generation.

2. Bookings Missing from "As Professional" View
Section: My Bookings → As Professional

The Dashboard shows 3 upcoming "Consultation with Test Pro" bookings. The "As Professional" tab under My Bookings shows zero bookings — both Upcoming and Past are empty. The Pro cannot see, confirm, decline, or manage any bookings that clients have made with them. This blocks the entire pro-side booking workflow.

3. Recurring Session/Auth State Loss
Section: All pages

The app repeatedly flashes back to an unauthenticated state mid-session — showing "Welcome to ProNeighbor!", "0 NC" balance, and a blank avatar "?" — before recovering after 8–15 seconds. This happens after every few page transitions or scroll actions. A Pro relying on this for income cannot trust the platform to reliably show their schedule, balance, or bookings.

🟠 HIGH-SEVERITY ISSUES (Reduces Trust, Creates Operational Confusion)
4. Past Bookings Shown as Upcoming
Section: My Bookings → As Client → Upcoming

Bookings dated 2026-03-22 and 2026-03-23 (9–10 days in the past) appear in the "Upcoming" tab. The date comparison logic is broken. A Pro managing their schedule from this view would be misled about their real pipeline.

5. Price Shown as "Free" in List But "300 NC" in Detail
Section: My Bookings

Both the cancelled and confirmed bookings show "Free" in the booking list card, but when opened, the detail shows 300 NC / Paid or 300 NC / Unpaid. This mismatch destroys financial trust — a Pro or client cannot verify what was actually charged.

6. 10% Platform Fee Hidden from Cash Out Flow
Section: Wallet → Cash Out / NC Terms

The NC Terms page states: "10% deducted from pro earnings on booking completion." However, this deduction is never shown in the Cash Out screen, the transaction history, or any booking detail. The Pro sees a full NC balance without any indication that earnings from bookings have been net of a 10% fee. Payout transparency is a legal and trust requirement for any service marketplace.

7. Duplicate Profile Completion Bonus Credited
Section: Wallet → History

The transaction history shows "+20 NC — Profile completed" on both 20 Mar 2026 and 23 Mar 2026 — the same bonus was awarded twice. This suggests a logic error in the milestone trigger and undermines financial accuracy of the ledger.

🟡 MEDIUM-SEVERITY ISSUES (Operational Friction, UX Problems)
8. No Edit Button for Existing Services
Section: My Account → Profile → My Services

Services ("Fitness consultation", "Class 1–5 Tuition") only have a delete (trash) button. There is no edit option. If a Pro needs to update the price, description, or duration of a service, they must delete it and recreate it — losing any SEO or discoverability history.

9. "Manage Skills & Availability" Deep Link Misdirects
Section: Dashboard

The "⚡ Manage Skills & Availability" button on the Dashboard sends the Pro to the Profile tab of My Account — not the Availability tab where time slots are managed. The button label sets the wrong expectation.

10. No Booking Intake Actions for the Pro
Section: My Bookings → As Professional
There is no interface for a Pro to confirm or decline an incoming booking request, mark a session as complete, or trigger earnings credit after a session. The entire booking lifecycle from the Pro's side is absent. No "Complete Session" button, no "Mark as Done" flow.

11. Chat Contact Shows as "User" with No Name or Avatar
Section: Messages

The chat contact is displayed as "User" with a "?" avatar — no display name, no profile picture. For a Pro managing multiple client conversations, this is completely unusable. There is also no link to the associated booking from the chat thread, no date stamps on messages (only time), and no block/report option from within chat.

12. Bio Field Contains Only "xyz" — No Profile Completeness Guard
Section: My Account → Profile

The Bio is a required field (marked with *) and contains "xyz" — a clearly placeholder value. The platform awarded 88% profile completeness and did not flag the low-quality bio. A poor bio harms searchability and conversion from profile views to bookings.

13. "Locality" Missing But No Guidance on Where to Add It
Section: My Account → Profile

Profile completeness shows "Missing: Locality" but the form does not highlight which field needs to be filled or where "Locality" is supposed to be entered. The Pro cannot easily resolve this 12% gap.

14. Notifications Mix Promotional Noise with Operational Alerts
Section: Notifications

All booking-related events (confirmed, cancelled) are tagged "HIGH" priority — same as a social proof update ("8 neighbors are using ProNeighbor"). This makes priority labels meaningless. Push notifications are not enabled by default, meaning a Pro can miss booking alerts. No click-through navigation from notifications to the actual booking or ticket.

15. No Saved UPI ID for Payouts
Section: Wallet → Cash Out

The Pro must enter their UPI ID every time they request a payout. There is no ability to save a preferred payment method. This increases friction and error risk for recurring payouts.

16. FAQ Accordion Only Works on the ▼ Arrow, Not Full Row
Section: Support

Clicking the FAQ question text does not expand it — only clicking the small ▼ icon does. The expected behavior is that the entire row is clickable, especially on mobile where the target area matters.

🟢 MINOR / COSMETIC ISSUES
17. Inconsistent App Name Spelling
Section: My Bookings page title

The browser tab title showed "ProNeighbour" (with a 'u') while the rest of the app uses "ProNeighbor". This is an inconsistent brand spelling that should be standardized.

18. "Brief of Service" Contains Test Data
Section: Booking Detail

Booking notes show "8855" and "98965" — clearly test input that was never cleared. If visible to both parties, this is embarrassing and confusing.

19. Phase 2 Features Listed in Earn Without Clear Labeling
Section: Wallet → Earn

"Group session attended (+5 NC, Phase 2)" and "On-demand request fulfilled (+75 NC, Phase 2)" are listed as earn opportunities but are not currently available. No visual differentiation (e.g., greyed out, coming soon badge) between active and future features causes confusion about what a Pro can actually earn today.

20. "Requests: 0" on Dashboard with No Explanation
Section: Dashboard

The Requests counter is 0 and the Rating shows "—" (no rating). There is no tooltip or guidance explaining what "Requests" means (incoming booking requests? new messages?) or how to get the first rating. For a new Pro, this is demotivating with no call-to-action.