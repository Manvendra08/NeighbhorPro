import { useNavigate } from "react-router-dom";

export default function TermsOfService() {
  const navigate = useNavigate();
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px" }}>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 24 }}>← Back</button>
      <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "2rem", marginBottom: 8 }}>Terms of Service</h1>
      <p style={{ color: "var(--muted)", marginBottom: 32 }}>Effective: May 1, 2026 · ProNeighbor, Pune, India</p>

      {[
        ["1. Acceptance", "By creating a ProNeighbor account or using the platform, you agree to these Terms. If you do not agree, please do not use the service."],
        ["2. Platform Description", "ProNeighbor is a hyperlocal professional services marketplace connecting residents of gated communities with verified professionals. We are a technology platform, not a service provider. All services are rendered by independent professionals who are residents of the relevant society."],
        ["3. Eligibility", "You must be 18 years or older and a verified resident or professional in a registered society to use ProNeighbor. We reserve the right to verify residency and suspend accounts where verification fails."],
        ["4. NeighbourCoins (NC)", "NeighbourCoins are a platform-internal virtual currency (1 NC = ₹1). NC can be purchased via Razorpay and used to pay for services on the platform. NC cannot be transferred between users directly. NC are not legal tender and hold no monetary value outside the platform. Purchased NC do not expire; earned/bonus NC expire after 12 months of inactivity."],
        ["5. Payments & Refunds", "All bookings are paid in NeighbourCoins. If a booking is cancelled by the client before the session, NC are refunded to the client's wallet automatically. Disputes after a session must be raised within 48 hours via the support section. Platform commission (10%) is non-refundable once a session is completed."],
        ["6. Professional Conduct", "Professionals listed on ProNeighbor are independent service providers. ProNeighbor does not employ them and is not liable for the quality, outcome, or legality of their services. Users are responsible for assessing suitability before booking."],
        ["7. Prohibited Activities", "You may not use the platform to: (a) impersonate another person; (b) list services you are not qualified to provide; (c) manipulate ratings or reviews; (d) attempt to exploit the NeighbourCoins system; (e) share another user's personal information without consent."],
        ["8. Account Suspension", "We reserve the right to suspend or terminate accounts that violate these Terms, engage in fraudulent activity, or harm other users or the platform."],
        ["9. Limitation of Liability", "ProNeighbor is not liable for any indirect, incidental, or consequential damages arising from use of the platform, including disputes between residents and professionals."],
        ["10. Governing Law", "These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in Pune, Maharashtra."],
        ["11. Changes to Terms", "We may update these Terms from time to time. Continued use of the platform after changes constitutes acceptance of the updated Terms."],
        ["12. Contact", "For questions about these Terms, contact us at legal@ProNeighbor.in"],
      ].map(([heading, body]) => (
        <div key={heading as string} style={{ marginBottom: 28 }}>
          <h3 style={{ fontFamily: "var(--font-heading)", fontSize: "1.05rem", marginBottom: 8 }}>{heading}</h3>
          <p style={{ color: "var(--text-2)", lineHeight: 1.75, fontSize: "0.95rem" }}>{body}</p>
        </div>
      ))}
    </div>
  );
}


