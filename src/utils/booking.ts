export const BOOKING_BRIEF_MAX_CHARS = 500;

export function isBookingBriefValid(value: string): boolean {
  return value.length <= BOOKING_BRIEF_MAX_CHARS;
}

export function getPaymentStatusLabel(escrowCoins: number, billedCoins: number, status: string): string {
  if (escrowCoins > 0) {
    return status === "completed" || status === "reviewed"
      ? `Released (${escrowCoins} NC)`
      : `Held in Escrow (${escrowCoins} NC)`;
  }
  if (billedCoins > 0) return "Paid";
  return "No payment required";
}
