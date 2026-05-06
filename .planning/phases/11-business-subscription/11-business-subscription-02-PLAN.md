---
phase: 11-business-subscription
plan: 02
type: execute
wave: 2
depends_on: ["11-business-subscription-01"]
files_modified: ["src/services/subscriptionService.ts", "src/pages/SubscriptionManage.tsx", "src/components/SubscribeSheet.tsx", "src/components/SubscriptionBanner.tsx", "src/App.tsx"]
autonomous: true
requirements: ["SUB-03"]
must_haves:
  truths:
    - User can subscribe with cashable NC
  artifacts:
    - path: src/services/subscriptionService.ts
      provides: subscribeWithNC
    - path: src/pages/SubscriptionManage.tsx
      provides: management UI
  key_links: []
---
<objective>
Implement Subscription UI and Service Layer (NC only)
</objective>

<context>
@Plan_Business Category Subscription.md
</context>

<tasks>
<task type="auto">
  <name>Subscription Service & UI</name>
  <files>src/services/subscriptionService.ts, src/pages/SubscriptionManage.tsx, src/components/SubscribeSheet.tsx, src/components/SubscriptionBanner.tsx, src/App.tsx</files>
  <action>
    - Create subscriptionService.ts with getSubscription, subscribeWithNC, cancelSubscription.
    - Create SubscriptionManage.tsx page.
    - Create SubscribeSheet.tsx component.
    - Create SubscriptionBanner.tsx component.
    - Wire route in App.tsx.
  </action>
  <verify>
    <automated>npm run build</automated>
  </verify>
  <done>UI is implemented and builds successfully</done>
</task>
</tasks>
