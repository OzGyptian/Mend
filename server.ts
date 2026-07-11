import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Resend } from "resend";
import dotenv from "dotenv";
import { initializeApp, cert, getApps, type App as AdminApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import firebaseConfig from "./firebase-applet-config.json";

dotenv.config({ path: '.env.local' });
dotenv.config();

// Lazily initialized so a missing FIREBASE_SERVICE_ACCOUNT_KEY doesn't crash
// the whole server — only /api/accept-invite becomes unavailable, matching
// the existing RESEND_API_KEY guard pattern below.
let adminApp: AdminApp | null | undefined;

function getAdminApp(): AdminApp | null {
  if (adminApp !== undefined) return adminApp;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    adminApp = null;
    return adminApp;
  }

  try {
    const serviceAccount = JSON.parse(raw);
    adminApp = getApps().find((a) => a.name === "mend-admin")
      ?? initializeApp({ credential: cert(serviceAccount) }, "mend-admin");
  } catch (err) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", err);
    adminApp = null;
  }
  return adminApp;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3001;

  app.use(express.json());

  // API Route for Invitations
  app.post("/api/invite", async (req, res) => {
    const { email, enterpriseName, inviterName, appUrl } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    if (!process.env.RESEND_API_KEY) {
      console.error("RESEND_API_KEY is missing from environment variables.");
      return res.status(500).json({ 
        error: "Email service is not configured. Please set RESEND_API_KEY." 
      });
    }

    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      // Note: onboarding@resend.dev only works for the account owner's email
      // until a custom domain is verified in the Resend dashboard.
      const { data, error } = await resend.emails.send({
        from: "onboarding@resend.dev",
        to: [email],
        subject: `Invitation: Join ${enterpriseName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #FF6321; margin-top: 0;">Mend</h2>
            <p>Hello,</p>
            <p><strong>${inviterName}</strong> has invited you to join the <strong>${enterpriseName}</strong> workspace.</p>
            <p>Click the button below to accept your invitation and set up your account:</p>
            <div style="margin: 32px 0;">
              <a href="${appUrl}" style="background-color: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Accept Invitation</a>
            </div>
            <p style="color: #666; font-size: 13px; line-height: 1.5;">
              <strong>Security Note:</strong> You will be asked to verify your email address after registering to ensure your account is secure.
            </p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="color: #999; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Powered by Mend</p>
          </div>
        `,
      });

      if (error) {
        console.error("Resend API Error:", JSON.stringify(error, null, 2));
        return res.status(400).json({ 
          error: "Email delivery failed. This usually happens if the domain is not verified in Resend.",
          details: error 
        });
      }

      res.json({ success: true, data });
    } catch (err) {
      console.error("Server Exception:", err);
      res.status(500).json({ error: "Internal server error during email dispatch" });
    }
  });

  // API Route for accepting an enterprise invitation.
  // F3 fix: this is the ONLY place invitation acceptance is verified — the
  // Firestore rule that let a client add itself to adminUsers is gone. The
  // Admin SDK bypasses security rules, so this route is the trust boundary:
  // it verifies the caller's ID token server-side and independently checks
  // that a matching, pending, non-expired invitation exists before granting
  // enterprise membership.
  app.post("/api/accept-invite", async (req, res) => {
    const { idToken, token } = req.body;

    if (!idToken || !token) {
      return res.status(400).json({ error: "idToken and token are required" });
    }

    const admin = getAdminApp();
    if (!admin) {
      console.error("FIREBASE_SERVICE_ACCOUNT_KEY is missing from environment variables.");
      return res.status(500).json({
        error: "Invitation service is not configured. Please set FIREBASE_SERVICE_ACCOUNT_KEY.",
      });
    }

    try {
      const decoded = await getAuth(admin).verifyIdToken(idToken);
      const uid = decoded.uid;
      const userEmail = (decoded.email || "").toLowerCase();
      const displayName = decoded.name || decoded.email?.split("@")[0] || "New User";

      const firestore = getFirestore(admin, firebaseConfig.firestoreDatabaseId);

      const inviteQuery = await firestore
        .collection("invitations")
        .where("token", "==", token)
        .where("status", "==", "pending")
        .limit(1)
        .get();

      if (inviteQuery.empty) {
        return res.json({ result: null });
      }

      const inviteDoc = inviteQuery.docs[0];
      const invite = inviteDoc.data();

      if (invite.email && userEmail !== String(invite.email).toLowerCase()) {
        return res.status(403).json({ error: `This invitation was sent to ${invite.email}.` });
      }
      if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
        return res.status(410).json({ error: "This invitation has expired." });
      }

      const enterpriseRef = firestore.collection("enterprises").doc(invite.enterpriseId);
      const enterpriseSnap = await enterpriseRef.get();
      if (!enterpriseSnap.exists) {
        return res.json({ result: null });
      }
      const entData = enterpriseSnap.data()!;

      const batch = firestore.batch();
      if (!entData.users?.[uid]) {
        batch.update(enterpriseRef, {
          [`users.${uid}`]: {
            name: displayName,
            email: userEmail,
            role: "Enterprise User",
            joinedAt: new Date().toISOString(),
          },
          adminUsers: FieldValue.arrayUnion(uid),
        });
      }
      batch.update(inviteDoc.ref, {
        status: "accepted",
        acceptedAt: new Date().toISOString(),
        acceptedBy: uid,
      });
      await batch.commit();

      return res.json({ result: { enterpriseName: entData.name } });
    } catch (err) {
      console.error("Accept-invite error:", err);
      return res.status(500).json({ error: "Internal server error while accepting invitation." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
