---
phase: 11-business-subscription
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: ["src/constants/serviceCatalog.ts", "src/services/coinService.ts", "scripts/backfillBalanceBuckets.cjs", "firestore.rules", "src/services/firestoreService.ts"]
autonomous: true
requirements: ["SUB-01", "SUB-02"]
must_haves:
  truths:
    - Cashable and Promo balances are segregated
  artifacts:
    - path: src/services/coinService.ts
      provides: getCashableBalance
    - path: scripts/backfillBalanceBuckets.cjs
      provides: Backfill script
  key_links: []
---
<objective>
Implement core data layer for Business Category Subscriptions (Cashable Bucket and Types)
</objective>

<context>
@Plan_Business Category Subscription.md
</context>

<tasks>
<task type="auto">
  <name>Update Data Layer & Ledger</name>
  <files>src/constants/serviceCatalog.ts, src/services/coinService.ts, firestore.rules, src/services/firestoreService.ts, scripts/backfillBalanceBuckets.cjs</files>
  <action>
    - Add isBusinessCategory to serviceCatalog.ts.
    - In coinService.ts: add subscription_debit ledger type, CASHABLE_LEDGER_TYPES, PROMO_LEDGER_TYPES. Function getCashableBalance(uid).
    - Update irestore.rules to match CATEGORY_GROUPS.Business and validate subscription_debit ledger entry.
    - Write a one-off script scripts/backfillBalanceBuckets.cjs to compute and set cashableBalance.
    - Update irestoreService.ts to block create services if business and no sub.
  </action>
  <verify>
    <automated>npm run test -- --filter=coinService</automated>
  </verify>
  <done>Cashable logic is complete and script built</done>
</task>
</tasks>
