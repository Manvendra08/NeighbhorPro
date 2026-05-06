---
phase: 11-business-subscription
plan: 03
type: execute
wave: 3
depends_on: ["11-business-subscription-02"]
files_modified: ["src/pages/Profile.tsx", "src/pages/Wallet.tsx", "src/pages/admin/AdminUsers.tsx", "src/pages/admin/AdminSettings.tsx", "src/services/auditService.ts", "src/services/activityService.ts"]
autonomous: true
requirements: ["SUB-04"]
must_haves:
  truths:
    - Wallet shows subscriptions, profile gates business listings
  artifacts:
    - path: src/pages/Profile.tsx
      provides: gated logic
  key_links: []
---
<objective>
Integrate Subscription UI into existing surfaces and admin base
</objective>

<context>
@Plan_Business Category Subscription.md
</context>

<tasks>
<task type="auto">
  <name>Surface Integration</name>
  <files>src/pages/Profile.tsx, src/pages/Wallet.tsx, src/pages/admin/AdminUsers.tsx, src/pages/admin/AdminSettings.tsx, src/services/auditService.ts, src/services/activityService.ts</files>
  <action>
    - Update Profile.tsx to handle gate.
    - Update Wallet.tsx to show subscriptions.
    - Add subscription columns to AdminUsers.tsx.
    - Add settings to AdminSettings.tsx.
    - Update uditService.ts and ctivityService.ts event unions.
  </action>
  <verify>
    <automated>npm run build</automated>
  </verify>
  <done>Integration complete</done>
</task>
</tasks>
