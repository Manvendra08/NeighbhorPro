import { useNavigate } from "react-router-dom";

const sections: Array<[string, string]> = [
  [
    "1. Acceptance",
    "By creating an account, accessing the app, or using any ProNeighbor service, you agree to these Terms of Service. If you do not agree, do not use the platform.",
  ],
  [
    "2. Platform Role",
    "ProNeighbor operates a hyperlocal marketplace that helps residents discover, communicate with, book, and pay local professionals. ProNeighbor is a technology platform and is not the provider of the professional services listed by users unless explicitly stated otherwise.",
  ],
  [
    "3. Eligibility and Accounts",
    "You must be at least 18 years old and capable of entering a binding agreement to use the platform. You must provide accurate account, profile, and verification information. You are responsible for activity that occurs under your account and for keeping your login credentials secure.",
  ],
  [
    "4. Residency and Professional Verification",
    "ProNeighbor may request documents, profile details, or other information to verify residency, identity, or professional eligibility. Verification status may be reviewed, suspended, or revoked if information is incomplete, inaccurate, expired, misleading, or inconsistent with platform rules.",
  ],
  [
    "5. Listings, Profiles, and User Content",
    "You are responsible for the legality, accuracy, and completeness of content you upload or publish, including profile details, service listings, rates, availability, messages, reviews, proofs, and support submissions. You must have the right to share that content. ProNeighbor may remove, edit, hide, or moderate content that violates policy, law, or marketplace standards.",
  ],
  [
    "6. Bookings and Marketplace Conduct",
    "Users must use the platform in good faith. Residents must provide accurate booking details and attend or cancel responsibly. Professionals must honor accepted bookings, provide services lawfully and competently, and avoid misleading claims. Off-platform coercion, fake ratings, impersonation, harassment, spam, fraud, and attempts to manipulate trust or payment systems are prohibited.",
  ],
  [
    "7. NeighbourCoins",
    "NeighbourCoins are a platform wallet unit used inside ProNeighbor. They are not legal tender, are not a bank deposit, do not earn interest, and cannot be transferred freely between users unless the platform explicitly enables it. Wallet balances, rewards, bonuses, holds, credits, debits, refunds, and expiries may be governed by platform rules, promotions, and anti-abuse controls in force at the relevant time.",
  ],
  [
    "8. Payments, Escrow, Refunds, and Payouts",
    "Bookings may involve wallet debits, temporary holds, escrow, refunds, and provider payouts. Refund eligibility depends on booking state, cancellation timing, dispute outcome, abuse review, and platform policy in force at the time of the transaction. ProNeighbor may delay, reverse, reject, or investigate wallet activity or payouts where fraud, error, legal risk, abuse, chargeback, or policy breach is suspected.",
  ],
  [
    "9. Reviews, Ratings, and Reputation",
    "Ratings and reviews must be based on genuine platform interactions and must be truthful, relevant, and lawful. ProNeighbor may remove, suppress, or investigate reviews that appear abusive, fabricated, retaliatory, duplicated, or otherwise unreliable. Reputation signals on the platform are informational only and are not a guarantee of service outcome.",
  ],
  [
    "10. Suspension, Restriction, and Termination",
    "ProNeighbor may suspend, restrict, flag, moderate, or terminate any account, listing, payout, review, message flow, or wallet activity if we believe there is a policy breach, fraud risk, payment risk, legal issue, safety concern, or operational need. We may also preserve records for audit, security, or legal purposes after access is removed.",
  ],
  [
    "11. Disclaimers",
    "The platform is provided on an as-available and as-is basis to the maximum extent permitted by law. ProNeighbor does not guarantee uninterrupted availability, error-free operation, service quality, provider suitability, user behavior, identity accuracy, booking completion, or outcome of any professional engagement.",
  ],
  [
    "12. Limitation of Liability",
    "To the maximum extent permitted by law, ProNeighbor and its affiliates, operators, and personnel are not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for loss of profits, reputation, data, goodwill, or business arising from use of the platform. Any direct liability, where legally unavoidable, will be limited to the amount paid by you to ProNeighbor for the specific transaction giving rise to the claim during the 3 months preceding the event.",
  ],
  [
    "13. Indemnity",
    "You agree to defend, indemnify, and hold ProNeighbor harmless from claims, losses, liabilities, and expenses arising out of your content, your services, your misuse of the platform, your violation of law, or your breach of these Terms.",
  ],
  [
    "14. Governing Law and Disputes",
    "These Terms are governed by the laws of India. Subject to applicable law, courts located in Pune, Maharashtra will have exclusive jurisdiction over disputes arising out of or relating to the platform or these Terms.",
  ],
  [
    "15. Changes to Terms",
    "We may revise these Terms from time to time. Updated Terms become effective when posted or when otherwise communicated by the platform. Continued use after the effective date means you accept the revised Terms.",
  ],
  [
    "16. Contact",
    "Legal questions: legal@proneighbor.in. General support: support@proneighbor.in. ProNeighbor, Pune, Maharashtra, India.",
  ],
];

export default function TermsOfService() {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px" }}>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 24 }}>
        {"<- Back"}
      </button>
      <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "2rem", marginBottom: 8 }}>Terms of Service</h1>
      <p style={{ color: "var(--muted)", marginBottom: 32 }}>Effective: May 1, 2026 | ProNeighbor, Pune, India</p>

      {sections.map(([heading, body]) => (
        <div key={heading} style={{ marginBottom: 28 }}>
          <h3 style={{ fontFamily: "var(--font-heading)", fontSize: "1.05rem", marginBottom: 8 }}>{heading}</h3>
          <p style={{ color: "var(--text-2)", lineHeight: 1.75, fontSize: "0.95rem" }}>{body}</p>
        </div>
      ))}
    </div>
  );
}
