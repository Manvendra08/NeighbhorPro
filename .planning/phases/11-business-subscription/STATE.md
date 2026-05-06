# Phase 11 State: Business Category Subscription

## Current Position

Phase: 11-business-subscription
Plan: 11-business-subscription-03
Status: ✅ Complete
Last activity: 2025-01-24 - Completed subscription UI integration into existing surfaces

## Phase Reference

See: `.planning/phases/11-business-subscription/11-business-subscription-03-PLAN.md`

**Core value:** Gate Business category listings behind monthly subscription, providing recurring revenue and commitment signal to residents.

**Current focus:** Phase 1 (MVP on Spark) - Working gate, working pay flow, validated economics with NC-only payment.

## Accumulated Context

### Completed (Phase 1 - Plan 03)
- ✅ Subscription UI integrated into Profile, Wallet, AdminUsers, AdminSettings
- ✅ Profile gates Business listings with subscription check
- ✅ Wallet displays subscription status and renewal date
- ✅ AdminSettings has subscription configuration (pricing, grace period, founder promo)
- ✅ AdminUsers shows subscription column with status and days remaining
- ✅ Audit/activity event unions extended with subscription metadata
- ✅ UserProfile type extended with subscription property
- ✅ Build verification passed (TypeScript + Vite)

### Previously Completed
- ✅ Subscription service created (`subscriptionService.ts`)
- ✅ Cashable NC bucket logic implemented
- ✅ Activity/audit event types defined
- ✅ `isBusinessCategory()` helper in serviceCatalog

### Pending (Phase 2 - Blaze pre-launch)
- ⏳ Create `/profile/subscription` route with SubscriptionManage.tsx
- ⏳ Create SubscribeSheet.tsx component for purchase flow
- ⏳ Create AdminSubscriptions.tsx page for full admin tooling
- ⏳ Add Active Pro pill to BrowsePros and ProDetail
- ⏳ Implement Razorpay payment integration
- ⏳ Add Cloud Function for renewal cron sweep
- ⏳ Implement notification system for renewal reminders
- ⏳ Atomic batch flip for listing degradation on expiry

### Pending (Phase 3 - Post-launch)
- ⏳ True Razorpay subscriptions/mandates (auto-debit INR)
- ⏳ Multi-tier plans (Basic/Plus with featured-listing entitlement)
- ⏳ Promo code system
- ⏳ Annual plan (12-month, 2 months free)
- ⏳ Churn analytics dashboard
- ⏳ Email/SMS receipts + PDF invoices

## Decisions

- Single tier (`business_monthly_v1`) for Phase 1
- 30-day period (calendar-month-aligned by `currentPeriodEnd`)
- NC-only payment for Phase 1 (Razorpay added in Phase 2)
- 5-day grace period post-expiry (admin-configurable)
- Manual renewal for Phase 1 (auto-debit added in Phase 2)
- Subscription data denormalized on `users.subscription` for fast reads
- Cashable NC bucket enforced for subscription payments
- Admin-editable pricing via `config/platformSettings.subscription`

## Integration Points

### Existing Services
- `subscriptionService.ts` - Core subscription logic (already created)
- `coinService.ts` - Cashable balance computation
- `auditService.ts` - Admin action audit trail (extended)
- `activityService.ts` - User activity logging (extended)
- `serviceCatalog.ts` - Category group helpers

### UI Components
- Profile.tsx - Service form gate + subscription banner
- Wallet.tsx - Subscription status card
- AdminSettings.tsx - Subscription configuration
- AdminUsers.tsx - Subscription column in user table

### Future Components (Phase 2)
- SubscriptionManage.tsx - Full subscription management page
- SubscribeSheet.tsx - Purchase flow modal/bottom-sheet
- AdminSubscriptions.tsx - Admin subscription dashboard
- ActiveProPill.tsx - Resident-side trust signal

## Blockers

- No blockers currently
- Phase 1 complete and ready for Phase 2 implementation
- Razorpay integration requires Blaze plan (planned for Phase 2)
- Cron sweep requires Cloud Functions (planned for Phase 2)

## Next Immediate Steps

1. Create SubscriptionManage.tsx page at `/profile/subscription`
2. Create SubscribeSheet.tsx component for NC payment flow
3. Test subscription purchase flow end-to-end
4. Add route to App.tsx for subscription management
5. Begin Phase 2 Razorpay integration planning
