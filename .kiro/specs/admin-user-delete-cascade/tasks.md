# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Confirmation Dialog and Cascade Deletion
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to concrete failing case(s) to ensure reproducibility
  - Test implementation details from Bug Condition in design:
    - Test that confirmation dialog is shown before deletion (confirmationDialogNotShown = true on unfixed code)
    - Test that cascade deletion DOES NOT happen (cascadeNotPerformed = true on unfixed code)
    - Test that bookings, coinLedger, activityLogs, notifications, services remain after deletion (bookingsNotDeleted, coinLedgerNotDeleted, etc. = true on unfixed code)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Admin Action Patterns and Self-Targeting Prevention
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements:
    - Test that self-targeting prevention blocks admin from deleting themselves (isSelfUser check continues to work)
    - Test that disable/enable user actions still work correctly
    - Test that role change functionality continues unchanged
    - Test that non-admin users cannot access User Management section
    - Test that success notification displays after operations
    - Test that user list cache invalidation works
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Fix for Admin User Delete Cascade

  - [x] 3.1 Implement deleteUserCascade function in firestoreService.ts
    - Add function to query and delete all bookings where customerId === uid OR proId === uid
    - Add function to query and delete all coinLedger entries where userId === uid
    - Add function to query and delete all activityLogs entries where userId === uid
    - Add function to query and delete all notifications where userId === uid
    - Add function to query and delete all services where ownerId === uid
    - Add function to query and delete all auditLogs entries where targetId === uid
    - Delete the user's users document
    - Uses batch operations for atomicity where possible
    - Returns operation summary (count of deleted records per collection)
    - _Bug_Condition: isBugCondition(input) where input.action = "delete_user" AND cascadeNotPerformed = true_
    - _Expected_Behavior: expectedBehavior(result) - all user data deleted atomically, audit log entry created, cache invalidated_
    - _Preservation: Self-targeting prevention via auditService.ts; confirmation dialog pattern; success notification_
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

  - [x] 3.2 Update handleDelete in AdminUsers.tsx
    - Enhance confirmation dialog to show user name/email and warn about permanent deletion
    - Call deleteUserCascade(uid) instead of soft-delete
    - Update success message to reflect cascade deletion
    - Add React Query cache invalidation for user list after deletion
    - Log to auditLogs BEFORE cascade deletion via captureAuditEvent()
    - _Bug_Condition: confirmationDialogNotShown OR cascadeNotPerformed_
    - _Expected_Behavior: expectedBehavior(result) - confirmation dialog shown, cascade deletion performed_
    - _Preservation: Existing confirmation dialog style, success notification pattern, cache invalidation pattern_
    - _Requirements: 2.1, 2.11, 3.1, 3.3_

  - [x] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Confirmation Dialog and Cascade Deletion
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: Expected Behavior Properties from design_

  - [x] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Admin Action Patterns
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: Preservation Requirements from design_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.