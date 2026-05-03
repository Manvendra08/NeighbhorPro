# Admin User Delete Cascade - Bugfix Design

## Overview

When an admin deletes a user from the Admin panel → User Management section, the current implementation performs a soft-delete (marking the user as deleted and disabling their Auth account) but leaves orphaned data across multiple Firestore collections: `bookings`, `coinLedger`, `activityLogs`, `notifications`, `services`, and `auditLogs`. Additionally, the deletion executes immediately without a confirmation dialog, violating the project's established pattern for destructive admin actions.

This design formalizes a cascade deletion strategy that:
1. Gates the deletion action behind a confirmation dialog (matching existing destructive action patterns)
2. Logs the deletion to `auditLogs` BEFORE removing the user's own audit records (preserving audit trail)
3. Cascades deletion across all user-owned and user-associated data
4. Prevents self-targeting via existing `auditService.ts` validation
5. Invalidates the user list cache on completion
6. Displays a success notification to the admin

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — when an admin initiates user deletion without a confirmation dialog, or when deletion completes without cascading to all related collections
- **Property (P)**: The desired behavior when deletion is confirmed — all user data is removed atomically across all collections, audit trail is preserved, and cache is invalidated
- **Preservation**: Existing confirmation dialog patterns, self-targeting prevention, success notifications, and cache invalidation mechanisms that must remain unchanged
- **Cascade Deletion**: The process of removing a user's records from all dependent collections in the correct order
- **Soft-Delete**: Current implementation that marks user as deleted but leaves orphaned data
- **Hard-Delete**: Complete removal of user data across all collections (the fix)
- **captureAuditEvent()**: Function in `auditService.ts` that logs admin actions with self-targeting prevention
- **handleDelete()**: The function in `AdminUsers.tsx` that currently performs soft-delete
- **deleteUserCascade()**: New service function that will perform the cascade deletion
- **Cloud Function**: Backend function for transactional safety of cascade operations

## Bug Details

### Bug Condition

The bug manifests when an admin clicks "Delete User" in the Admin Users panel. The current implementation either:
1. Does not present a confirmation dialog before deletion (violating destructive action pattern)
2. Performs only a soft-delete without cascading to related collections, leaving orphaned data

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type AdminDeleteUserAction
  OUTPUT: boolean
  
  RETURN input.action == "delete_user"
         AND (confirmationDialogNotShown OR cascadeNotPerformed)
         AND (bookingsNotDeleted OR coinLedgerNotDeleted OR activityLogsNotDeleted 
              OR notificationsNotDeleted OR servicesNotDeleted OR auditLogsNotDeleted)
END FUNCTION
```

### Examples

**Example 1: Deletion without confirmation**
- Admin clicks "Delete User" for user "Rajesh Kumar" (uid: abc123)
- Current: Deletion executes immediately without warning
- Expected: Confirmation dialog appears with warning about cascade deletion

**Example 2: Orphaned bookings**
- User "Priya" (uid: xyz789) has 5 active bookings as a service provider
- Admin confirms deletion
- Current: User's `users` document is soft-deleted, but 5 `bookings` documents remain with `proId: xyz789`
- Expected: All 5 bookings are deleted

**Example 3: Orphaned coin ledger**
- User "Amit" (uid: def456) has 15 `coinLedger` entries from transactions
- Admin confirms deletion
- Current: `coinLedger` entries remain with `userId: def456`
- Expected: All 15 entries are deleted

**Example 4: Orphaned audit logs**
- User "Neha" (uid: ghi789) has 8 `auditLogs` entries (as targetId)
- Admin "Admin1" deletes Neha
- Current: Neha's audit logs remain, and deletion is not logged before removal
- Expected: Deletion is logged to `auditLogs` BEFORE Neha's own audit records are removed

**Example 5: Audit trail preservation**
- Admin "Admin1" deletes user "Rajesh"
- Expected: An audit log entry exists showing "Admin1 deleted Rajesh" with timestamp, even though Rajesh's own records are gone

**Edge case: User with no associated records**
- User "Solo" (uid: jkl012) has no bookings, services, or ledger entries
- Admin confirms deletion
- Expected: Deletion completes without error for empty collections

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Confirmation dialog pattern must match existing destructive actions (e.g., disable user, role change)
- Self-targeting prevention via `auditService.ts` must continue to block admin from deleting themselves
- Success notification must display after deletion completes
- User list cache must be invalidated immediately after deletion
- Other admin actions (service rejection, payout processing) must continue to require their own confirmation dialogs
- Non-admin users must continue to be denied access to User Management section
- Deletion of users with no associated records must complete without error

**Scope:**
All inputs that do NOT involve user deletion should be completely unaffected by this fix. This includes:
- Disabling/enabling users
- Changing user roles
- Approving/rejecting verification
- All other admin actions

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **Missing Confirmation Dialog**: The current `handleDelete()` function in `AdminUsers.tsx` does not present a confirmation dialog before executing deletion, violating the project's pattern for destructive actions.

2. **Incomplete Cascade Logic**: The deletion only soft-deletes the user profile and disables Auth, but does not remove associated records from:
   - `bookings` (where user is customer or provider)
   - `coinLedger` (user's transaction history)
   - `activityLogs` (user's activity events)
   - `notifications` (user's notifications)
   - `services` (user's service listings)
   - `auditLogs` (user's audit trail as targetId)

3. **Audit Trail Timing**: The deletion is logged AFTER the user's own audit records are removed, potentially losing the deletion event itself if the operation fails mid-cascade.

4. **No Transactional Safety**: Multiple Firestore operations are not coordinated, risking partial deletion if any operation fails.

5. **Cache Not Invalidated**: React Query cache for the user list is not invalidated after deletion, potentially showing stale data.

## Correctness Properties

Property 1: Bug Condition - Cascade Deletion with Confirmation

_For any_ admin action to delete a user (where the bug condition holds), the fixed implementation SHALL:
1. Display a confirmation dialog warning that all user data will be permanently deleted
2. Upon confirmation, delete all user records across bookings, coinLedger, activityLogs, notifications, services, and auditLogs
3. Log the deletion to auditLogs BEFORE removing the user's own audit records
4. Delete the user's Firestore profile and disable their Firebase Auth account
5. Invalidate the user list cache
6. Display a success notification

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 3.1, 3.3**

Property 2: Preservation - Self-Targeting Prevention and Non-Deletion Behaviors

_For any_ input that is NOT a user deletion action (or is a self-targeting deletion attempt), the fixed code SHALL:
1. Continue to block self-targeting via auditService.ts validation (admin cannot delete themselves)
2. Continue to require confirmation for other destructive actions
3. Continue to deny non-admin access to User Management
4. Produce exactly the same behavior as the original code for all non-deletion operations

**Validates: Requirements 3.2, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File 1**: `src/services/firestoreService.ts`

**New Function**: `deleteUserCascade(uid: string): Promise<void>`

**Specific Changes**:
1. **Add Cascade Deletion Function**: Create a new async function that:
   - Validates the uid is not empty
   - Queries and deletes all `bookings` where `customerId === uid` OR `proId === uid`
   - Queries and deletes all `coinLedger` entries where `userId === uid`
   - Queries and deletes all `activityLogs` entries where `userId === uid`
   - Queries and deletes all `notifications` where `userId === uid`
   - Queries and deletes all `services` where `ownerId === uid`
   - Queries and deletes all `auditLogs` entries where `targetId === uid`
   - Deletes the user's `users` document
   - Uses batch operations for atomicity where possible, or sequential operations with error handling

2. **Error Handling**: Implement retry logic and detailed error messages for each collection deletion

3. **Logging**: Return operation summary (count of deleted records per collection)

---

**File 2**: `src/pages/admin/AdminUsers.tsx`

**Function**: `handleDelete(u: UserRow): Promise<void>`

**Specific Changes**:
1. **Add Confirmation Dialog**: Before calling the cascade deletion, display a confirmation dialog that:
   - Shows the user's name and email
   - Warns that "All associated data (bookings, transactions, activity logs, etc.) will be permanently deleted"
   - Provides "Cancel" and "Confirm Delete" buttons
   - Matches the visual style of existing confirmation dialogs (e.g., role escalation modal)

2. **Call Cascade Deletion**: Replace the current soft-delete logic with a call to `deleteUserCascade(uid)`

3. **Update Success Message**: Change success message to "User and all associated data permanently deleted"

4. **Cache Invalidation**: After successful deletion, invalidate React Query cache for user list:
   - Call `queryClient.invalidateQueries({ queryKey: ['adminUsers'] })`

5. **Self-Targeting Check**: Ensure the existing self-targeting check remains in place (already present via `isSelfUser()`)

---

**File 3**: `src/services/auditService.ts` (No changes required)

**Rationale**: The existing `captureAuditEvent()` function already includes self-targeting prevention for `user.delete` action. The audit logging will be called from `AdminUsers.tsx` BEFORE the cascade deletion begins, ensuring the deletion event is recorded even if the cascade fails.

---

### Implementation Order

1. **Phase 1**: Add `deleteUserCascade()` function to `firestoreService.ts`
   - Implement batch deletion for each collection
   - Add error handling and logging
   - Test with unit tests

2. **Phase 2**: Update `handleDelete()` in `AdminUsers.tsx`
   - Add confirmation dialog component
   - Call `deleteUserCascade()` instead of soft-delete
   - Add cache invalidation
   - Test with integration tests

3. **Phase 3**: Verify audit trail
   - Confirm deletion is logged to `auditLogs` before cascade begins
   - Verify self-targeting prevention works
   - Test with E2E tests

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate admin deletion actions and verify that:
1. Confirmation dialog is NOT shown on unfixed code
2. Cascade deletion does NOT occur on unfixed code
3. Orphaned records remain in Firestore after deletion

**Test Cases**:
1. **Confirmation Dialog Missing**: Simulate clicking "Delete User" and verify no confirmation dialog appears (will fail on unfixed code)
2. **Bookings Not Deleted**: Create a user with bookings, delete the user, verify bookings still exist (will fail on unfixed code)
3. **Coin Ledger Not Deleted**: Create a user with ledger entries, delete the user, verify entries still exist (will fail on unfixed code)
4. **Services Not Deleted**: Create a user with services, delete the user, verify services still exist (will fail on unfixed code)
5. **Audit Trail Not Preserved**: Delete a user, verify deletion is NOT logged before user's own audit records are removed (will fail on unfixed code)

**Expected Counterexamples**:
- Confirmation dialog does not appear when "Delete User" is clicked
- Bookings, services, and ledger entries remain in Firestore after deletion
- Deletion event is not logged to auditLogs before user's records are removed
- Possible causes: missing dialog component, incomplete cascade logic, audit logging after deletion

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := handleDelete_fixed(input)
  ASSERT confirmationDialogShown(result)
  ASSERT allUserRecordsDeleted(result)
  ASSERT auditLogEntryCreated(result)
  ASSERT cacheInvalidated(result)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT handleDelete_original(input) = handleDelete_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for self-targeting prevention and other admin actions, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Self-Targeting Prevention**: Verify admin cannot delete themselves (will fail on unfixed code if self-targeting check is missing)
2. **Other Admin Actions Unchanged**: Verify disable/enable, role change, and other actions continue to work
3. **Non-Admin Access Denied**: Verify non-admin users cannot access User Management
4. **User with No Records**: Verify deletion completes without error for users with no associated records
5. **Concurrent Deletions**: Verify multiple concurrent deletions don't cause race conditions

### Unit Tests

- Test `deleteUserCascade()` with various user configurations (with/without bookings, services, ledger entries)
- Test error handling when a collection deletion fails
- Test that audit log entry is created before cascade begins
- Test that cache invalidation is called after successful deletion
- Test self-targeting prevention blocks admin from deleting themselves

### Property-Based Tests

- Generate random users with random associated records and verify cascade deletion removes all
- Generate random admin actions and verify only deletion requires confirmation
- Generate random non-admin users and verify they cannot access User Management
- Test that deletion is idempotent (deleting twice doesn't cause errors)

### Integration Tests

- Test full deletion flow from UI: click delete → confirm → verify all data removed
- Test deletion with concurrent bookings being created (race condition)
- Test deletion with user who has pending payouts or escrow coins
- Test that success notification appears after deletion
- Test that user list is refreshed after deletion

### E2E Tests

- Admin deletes a user with full profile (bookings, services, reviews, ledger entries)
- Verify user is removed from user list
- Verify user's bookings are removed from booking list
- Verify user's services are removed from service list
- Verify deletion is logged in audit log
- Verify admin cannot delete themselves
