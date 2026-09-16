import nodemailer from 'nodemailer';

import { env, smtpConfigured } from '../config/env.js';

let transporter = null;

function getTransporter() {
  transporter ??= nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    // 465 is implicit TLS; 587 starts plaintext and upgrades via STARTTLS.
    secure: env.smtp.port === 465,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
  });

  return transporter;
}

/**
 * Sends mail when SMTP is configured, logs it otherwise.
 *
 * Both halves resolve, so callers never have to branch on whether a provider is set up —
 * a dev box with an empty .env behaves like the console-only version this replaced.
 */
export async function sendMail({ to, subject, text, html }) {
  if (!smtpConfigured) {
    console.info(`\n[mail: not configured, logging instead]\nTo: ${to}\n${subject}\n\n${text}\n`);
    return;
  }

  await getTransporter().sendMail({ from: env.smtp.from, to, subject, text, html });
}

/**
 * Delivery is intentionally not awaited by the caller — see forgotPassword. A failure here
 * must not change the endpoint's response, or the timing difference alone would reveal
 * which addresses are registered, so it is logged and swallowed.
 */
export async function sendPasswordResetEmail(to, link) {
  const text = [
    'We received a request to reset your password.',
    '',
    `Open this link to choose a new one: ${link}`,
    '',
    'The link expires in 1 hour and can be used once.',
    'If you did not request this, you can ignore this email — your password stays unchanged.',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; color: #212529; line-height: 1.6;">
      <h2 style="color: #e67700; margin-bottom: 8px;">Reset your password</h2>
      <p>We received a request to reset your password.</p>
      <p style="margin: 24px 0;">
        <a href="${link}"
           style="background: #e67700; color: #fff; padding: 12px 22px;
                  border-radius: 8px; text-decoration: none; display: inline-block;">
          Reset Password
        </a>
      </p>
      <p>Or paste this link into your browser:<br />
        <a href="${link}">${link}</a>
      </p>
      <p style="color: #868e96; font-size: 14px;">
        The link expires in 1 hour and can be used once. If you did not request this, you can
        ignore this email — your password stays unchanged.
      </p>
    </div>
  `;

  try {
    await sendMail({ to, subject: 'Reset your password', text, html });
  } catch (error) {
    console.error('[mail] password reset delivery failed:', error.message);
  }
}
