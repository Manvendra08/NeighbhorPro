/**
 * firestoreService.ts — Barrel re-export.
 *
 * [Task 3] The god-file has been split into focused domain service files.
 * This file re-exports everything so existing imports throughout the codebase
 * continue to work without any changes.
 *
 * New code should import directly from the domain service:
 *   import { createBooking } from './bookingService';
 *   import { addReview }     from './reviewService';
 *   etc.
 */

export * from './userService';
export * from './bookingService';
export * from './reviewService';
export * from './messageService';
export * from './feedService';
export * from './societyService';
export * from './platformService';
export * from './serviceService';
