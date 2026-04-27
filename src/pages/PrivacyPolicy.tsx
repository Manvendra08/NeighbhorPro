import { useNavigate } from "react-router-dom";

const sections: Array<[string, string]> = [
  [
    "1. Scope",
    "This Privacy Policy explains how ProNeighbor collects, uses, stores, and shares personal information when you use the app, website, wallet, messaging, booking, support, and verification features.",
  ],
  [
    "2. Information We Collect",
    "We may collect account details such as your name, email address, phone number, profile photo, and login identifiers; profile details such as society, tower, flat number, skills, rates, bio, and visibility settings; verification details such as residency proof images and review notes; transaction data such as bookings, wallet balance, NeighbourCoins ledger entries, payouts, and payment references; communication data such as messages, support tickets, notifications, and report submissions; and technical data such as device, browser, IP address, log events, and app usage signals.",
  ],
  [
    "3. How We Use Information",
    "We use personal information to create and manage accounts, verify residents and professionals, publish profiles based on your visibility settings, process bookings and cancellations, operate the wallet and payout flow, detect abuse and fraud, respond to support issues, maintain audit trails, improve product quality, and comply with legal or regulatory obligations.",
  ],
  [
    "4. Information Visible to Other Users",
    "Other users may see information needed for marketplace trust and booking, including your display name, photo, skills, pricing, ratings, review count, society or tower context, and professional profile details. Email address, phone number, and flat number are hidden by default unless you choose to make them visible where the product allows.",
  ],
  [
    "5. Admin and Internal Access",
    "Authorized ProNeighbor admins may access user, booking, verification, wallet, support, moderation, and audit data when needed to operate the platform, investigate complaints, enforce platform rules, prevent fraud, process payouts, or meet legal obligations.",
  ],
  [
    "6. Payments and Wallet Data",
    "Bookings and wallet activity may include wallet balances, top-ups, refunds, payout requests, booking escrow records, and payment reference IDs. Card, bank, and UPI payment processing may be handled by payment partners. ProNeighbor may store payment references, payout details, and reconciliation records, but does not need to store full card credentials to operate the platform.",
  ],
  [
    "7. Third-Party Services",
    "We may use third-party providers for authentication, database and hosting infrastructure, file storage and media handling, messaging and notifications, analytics, error monitoring, and payment processing. Those providers process data under their own terms and privacy policies while acting as service providers to ProNeighbor.",
  ],
  [
    "8. Legal Bases and Purposes",
    "We process data to perform our contract with users, operate requested services, protect platform security and marketplace integrity, comply with law, and pursue legitimate business interests such as fraud prevention, dispute handling, support, and service improvement.",
  ],
  [
    "9. Retention",
    "We retain account and profile data while your account remains active. We may retain booking, transaction, payout, support, moderation, verification, security, and audit records for longer periods where needed for dispute resolution, fraud review, financial reconciliation, taxation, legal compliance, or enforcement of platform rules. When deletion is requested and legally permitted, we may delete or anonymize parts of your data while preserving records that must be retained.",
  ],
  [
    "10. Security",
    "We use technical and organizational controls intended to reduce unauthorized access, misuse, or loss of data. No platform can guarantee absolute security. You are responsible for maintaining the confidentiality of your login credentials and for notifying us if you suspect unauthorized account activity.",
  ],
  [
    "11. Your Choices and Rights",
    "Subject to applicable law, you may request access to your personal data, correction of inaccurate data, deletion of eligible data, or restriction of certain processing. You may also control profile visibility settings where offered in the product. Requests may be denied or limited where retention is required for legal, security, or financial reasons.",
  ],
  [
    "12. Children",
    "ProNeighbor is not intended for users under 18 years of age. If we learn that a minor has provided personal data without valid authorization, we may suspend the account and remove the data where appropriate.",
  ],
  [
    "13. Changes to This Policy",
    "We may update this Privacy Policy from time to time. Material changes may be communicated through the app, website, email, or other reasonable notice methods. Continued use of the service after the updated policy becomes effective means the updated policy applies.",
  ],
  [
    "14. Contact",
    "Privacy requests or questions: privacy@proneighbor.in. General support: support@proneighbor.in. ProNeighbor, Pune, Maharashtra, India.",
  ],
];

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px" }}>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 24 }}>
        {"<- Back"}
      </button>
      <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "2rem", marginBottom: 8 }}>Privacy Policy</h1>
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
