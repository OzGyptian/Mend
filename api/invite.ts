import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, enterpriseName, inviterName, appUrl } = req.body as {
    email?: string;
    enterpriseName?: string;
    inviterName?: string;
    appUrl?: string;
  };

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is missing from environment variables.');
    return res.status(500).json({
      error: 'Email service is not configured. Please set RESEND_API_KEY.',
    });
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
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
      console.error('Resend API Error:', JSON.stringify(error, null, 2));
      return res.status(400).json({
        error: 'Email delivery failed. This usually happens if the domain is not verified in Resend.',
        details: error,
      });
    }

    return res.json({ success: true, data });
  } catch (err) {
    console.error('Server Exception:', err);
    return res.status(500).json({ error: 'Internal server error during email dispatch' });
  }
}
