import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const outputPath = path.resolve("output/pdf/pro-neighbor-app-summary-one-page.pdf");

const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>ProNeighbor App Summary</title>
    <style>
      @page { size: A4; margin: 24px; }
      * { box-sizing: border-box; }
      body {
        font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        color: #122033;
        margin: 0;
        font-size: 10.5pt;
        line-height: 1.35;
      }
      h1 {
        margin: 0 0 8px 0;
        font-size: 18pt;
        color: #0b4f6c;
      }
      h2 {
        margin: 10px 0 4px 0;
        font-size: 11.5pt;
        color: #0c1b2e;
        border-bottom: 1px solid #d7e2ec;
        padding-bottom: 2px;
      }
      p { margin: 0 0 6px 0; }
      ul {
        margin: 4px 0 0 16px;
        padding: 0;
      }
      li { margin: 0 0 3px 0; }
      .top-note {
        font-size: 9pt;
        color: #4a5d75;
        margin-bottom: 8px;
      }
      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .full { grid-column: 1 / -1; }
      .evidence {
        margin-top: 8px;
        font-size: 8.5pt;
        color: #5d6e81;
      }
      .nf { font-weight: 700; color: #7b1f1f; }
    </style>
  </head>
  <body>
    <h1>ProNeighbor - App Summary</h1>
    <p class="top-note">One-page snapshot generated from repository evidence only.</p>

    <div class="grid">
      <section>
        <h2>What It Is</h2>
        <p>ProNeighbor is a gated-community marketplace web app that connects residents with verified local professionals and supports browsing, booking, messaging, wallet top-ups, and support workflows. It is a React + Firebase application with role-based user/admin experiences and PWA elements.</p>
      </section>

      <section>
        <h2>Who It's For</h2>
        <p>Primary users are residents and service professionals inside gated societies, with admins managing operations, moderation, and platform controls.</p>
      </section>

      <section class="full">
        <h2>What It Does</h2>
        <ul>
          <li>Supports auth flows: email/password, Google sign-in, password reset, email verification, and phone OTP validation.</li>
          <li>Provides protected user journeys for dashboards, pro browsing, pro details, booking flow, booking history, and booking detail pages.</li>
          <li>Includes in-app messaging with deterministic conversation IDs, attachments, real-time subscriptions, read receipts, and unread counts.</li>
          <li>Handles user profiles with residency proof upload/verification and safe public-profile mirroring.</li>
          <li>Offers a wallet/coin system with Razorpay checkout in Spark mode, plus Cloud Functions for server-verified Blaze mode.</li>
          <li>Delivers community features such as local feed posts/reactions/reports and recommendation helpers.</li>
          <li>Exposes extensive admin modules: users, societies, services, reviews, broadcasts, tickets, audit logs, wallet, bookings, and settings.</li>
        </ul>
      </section>

      <section class="full">
        <h2>How It Works (Architecture)</h2>
        <ul>
          <li><b>Client app:</b> Vite + React + React Router + React Query bootstrapped in <code>src/main.tsx</code>/<code>src/App.tsx</code>.</li>
          <li><b>Identity and roles:</b> Firebase Auth wrapped by <code>AuthProvider</code>; route gating via <code>ProtectedRoute</code> for user, verified-user, and admin access.</li>
          <li><b>Data layer:</b> Firestore is the primary datastore accessed via service modules (profiles, bookings, services, messages, feed, societies, transactions, support).</li>
          <li><b>Storage/media:</b> Firebase Storage is initialized; uploads are performed to Cloudinary for profile photos, residency proofs, and chat attachments.</li>
          <li><b>Payments/coins:</b> Frontend wallet uses Razorpay SDK in Spark mode; optional Firebase Cloud Functions implement order creation, webhook verification, and ledger crediting.</li>
          <li><b>Observability/UX:</b> Sentry init, ErrorBoundary wrapping, PWA splash/install components, and push messaging support checks.</li>
          <li><b>Data flow:</b> Browser UI -> Auth/Firestore/Functions SDK calls -> Firebase services -> Firestore updates -> realtime listeners refresh UI.</li>
        </ul>
      </section>

      <section class="full">
        <h2>How To Run (Minimal)</h2>
        <ol style="margin:4px 0 0 16px; padding:0;">
          <li>Install dependencies: <code>npm install</code></li>
          <li>Create env file: copy <code>.env.example</code> to <code>.env.local</code> and set Firebase values (plus optional Razorpay/Cloudinary keys used by wallet/uploads).</li>
          <li>Start dev server: <code>npm run dev</code> (Vite runs on <code>http://localhost:5173</code> with strict port).</li>
        </ol>
        <p style="margin-top:6px;"><span class="nf">Not found in repo:</span> single consolidated README for full setup/deployment checklist.</p>
      </section>
    </div>

    <p class="evidence">
      Evidence sampled from: package.json, .env.example, vite.config.ts, src/App.tsx, src/main.tsx, src/firebase.ts, src/contexts/AuthContext.tsx, src/services/firestoreService.ts, src/services/razorpayService.ts, src/lib/collections.ts, functions/src/index.ts, src/pages/LandingPage.tsx.
    </p>
  </body>
</html>`;

await fs.writeFile(path.resolve("tmp/pdfs/pro-neighbor-summary.html"), html, "utf8");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "domcontentloaded" });
await page.pdf({
  path: outputPath,
  format: "A4",
  printBackground: true,
  margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
});
await browser.close();

console.log(outputPath);
