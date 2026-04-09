/** Centralized Firestore path constants — prevents typos across services. */
export const C = {
  users:       (uid: string)      => `users/${uid}`,
  coinLedger:  (uid: string)      => `coinLedger/${uid}/entries`,
  bookings:    ()                 => `bookings`,
  disputes:    ()                 => `disputes`,
  tickets:     (id?: string)      => id ? `tickets/${id}/messages` : `tickets`,
  referrals:   (uid: string)      => `referrals/${uid}`,
  faqs:        ()                 => `faqs`,
  appSettings: (doc: string)      => `appSettings/${doc}`,
  coinPurchases: ()               => `coinPurchases`,
  coinPayouts:   ()               => `coinPayouts`,
} as const;
