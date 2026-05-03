# Bugfix Requirements Document

## Introduction

When an admin deletes a user from the Admin panel → User Management section, only the Firebase Auth account (and possibly the `users` Firestore document) is removed. All associated Firestore records across `bookings`, `coinLedger`, `activityLogs`, `notifications`, `services`, and `auditLogs` are left behind as orphaned data. Additionally, the deletion executes immediately without a confirmation dialog, violating the project's established pattern for destructive admin actions. This fix ensures full cascade deletion of all user-owned data and gates the action behind a warning/confirmation dialog.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN an admin triggers user deletion for any user THEN the system deletes the user without presenting a confirmation or warning dialog

1.2 WHEN an admin confirms user deletion THEN the system removes the user's Firebase Auth account but leaves associated `bookings` documents intact in Firestore

1.3 WHEN an admin confirms user deletion THEN the system leaves the user's `coinLedger` entries intact in Firestore

1.4 WHEN an admin confirms user deletion THEN the system leaves the user's `activityLogs` entries intact in Firestore

1.5 WHEN an admin confirms user deletion THEN the system leaves the user's `notifications` documents intact in Firestore

1.6 WHEN an admin confirms user deletion THEN the system leaves the user's `services` listings intact in Firestore

1.7 WHEN an admin confirms user deletion THEN the system leaves the user's `auditLogs` entries intact in Firestore

1.8 WHEN an admin confirms user deletion THEN the system leaves the user's `users` document intact in Firestore (or removes it without removing the sub-collections)

### Expected Behavior (Correct)

2.1 WHEN an admin triggers user deletion for any user THEN the system SHALL display a confirmation dialog warning that all user data will be permanently deleted before executing any deletion

2.2 WHEN an admin confirms user deletion THEN the system SHALL delete all `bookings` documents where the user is a participant (as customer or provider)

2.3 WHEN an admin confirms user deletion THEN the system SHALL delete all `coinLedger` entries associated with the user's UID

2.4 WHEN an admin confirms user deletion THEN the system SHALL delete all `activityLogs` entries associated with the user's UID

2.5 WHEN an admin confirms user deletion THEN the system SHALL delete all `notifications` documents associated with the user's UID

2.6 WHEN an admin confirms user deletion THEN the system SHALL delete all `services` listings owned by the user

2.7 WHEN an admin confirms user deletion THEN the system SHALL delete all `auditLogs` entries associated with the user's UID

2.8 WHEN an admin confirms user deletion THEN the system SHALL delete the user's `users` document from Firestore

2.9 WHEN an admin confirms user deletion THEN the system SHALL delete the user's Firebase Auth account

2.10 WHEN an admin confirms user deletion THEN the system SHALL log the deletion action to `auditLogs` via `captureAuditEvent()` before removing the user's own audit records

2.11 WHEN an admin cancels the confirmation dialog THEN the system SHALL abort the deletion and leave all user data unchanged

### Unchanged Behavior (Regression Prevention)

3.1 WHEN an admin deletes a user and the deletion completes successfully THEN the system SHALL CONTINUE TO display a success notification to the admin

3.2 WHEN an admin performs any other destructive action (e.g., service rejection, payout processing) THEN the system SHALL CONTINUE TO require its own confirmation dialog as before

3.3 WHEN an admin views the user list after a successful deletion THEN the system SHALL CONTINUE TO reflect the removed user immediately (no stale cache)

3.4 WHEN an admin attempts to delete themselves (self-targeting) THEN the system SHALL CONTINUE TO block the action per the existing `auditService.ts` self-targeting prevention

3.5 WHEN a non-admin user accesses the User Management section THEN the system SHALL CONTINUE TO deny access via the existing `ProtectedRoute` role check

3.6 WHEN an admin deletes a user who has no associated records in a given collection THEN the system SHALL CONTINUE TO complete the deletion without error for that collection
