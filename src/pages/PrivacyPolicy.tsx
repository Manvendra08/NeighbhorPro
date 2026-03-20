import { useNavigate } from "react-router-dom";

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px" }}>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 24 }}>← Back</button>
      <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "2rem", marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: "var(--muted)", marginBottom: 32 }}>Effective: May 1, 2026 · ProNeighbour, Pune, India</p>

      {[
        ["1. Information We Collect", "We collect: (a) Account data — name, email, profile photo, society name; (b) Service data — skills, hourly rates, bio you provide; (c) Transaction data — NeighbourCoins purchases, bookings, payouts; (d) Usage data — pages visited, searches performed; (e) Device data — browser type, IP address."],
        ["2. How We Use Your Information", "We use your data to: operate and improve the platform; process NC transactions and payouts; match residents with professionals; send booking confirmations and platform notifications; prevent fraud and enforce our Terms of Service."],
        ["3. Data Shared Within the Platform", "Your name, photo, bio, skills, society, and rating are visible to other logged-in users. Your email, UPI ID, and payment details are never visible to other users. Admins can access all user data for platform management purposes."],
        ["4. Third-Party Services", "We use: Firebase (Google) for authentication and database; Razorpay for payment processing; Cloudinary for profile photo storage. Each has its own privacy policy and handles data per their terms."],
        ["5. NeighbourCoins & Financial Data", "All NC transactions are logged in an immutable ledger. Payment data (card/UPI details) is handled entirely by Razorpay and never stored on ProNeighbour servers. We store only the Razorpay payment ID as reference."],
        ["6. Data Retention", "Your profile data is retained as long as your account is active. Booking and transaction records are retained for 7 years for regulatory compliance. You may request account deletion by contacting support — this will anonymise your booking history but ledger records are retained."],
        ["7. Your Rights", "You have the right to: access your personal data; correct inaccurate data; request deletion of your account; opt out of non-essential communications. Contact privacy@proneighbour.in to exercise these rights."],
        ["8. Children's Privacy", "ProNeighbour is not intended for users under 18. We do not knowingly collect data from minors."],
        ["9. Security", "We use Firebase security rules to restrict data access, HTTPS for all communications, and Firestore transactions for financial operations. No security system is 100% foolproof — please use strong passwords and report suspicious activity immediately."],
        ["10. Changes to This Policy", "We will notify users of material changes via email or in-app notification at least 7 days before they take effect."],
        ["11. Contact", "Privacy questions: privacy@proneighbour.in · ProNeighbour, Pune, Maharashtra, India"],
      ].map(([heading, body]) => (
        <div key={heading as string} style={{ marginBottom: 28 }}>
          <h3 style={{ fontFamily: "var(--font-heading)", fontSize: "1.05rem", marginBottom: 8 }}>{heading}</h3>
          <p style={{ color: "var(--text-2)", lineHeight: 1.75, fontSize: "0.95rem" }}>{body}</p>
        </div>
      ))}
    </div>
  );
}
