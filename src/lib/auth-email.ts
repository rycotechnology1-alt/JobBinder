import { Resend } from "resend";

type AuthEmailInput = {
  email: string;
  token: string;
};

type InviteEmailInput = AuthEmailInput & {
  inviteId: string;
  companyName: string;
};

function getResendClient() {
  const apiKey = process.env.AUTH_RESEND_KEY ?? process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Missing Resend API key.");
  }

  return new Resend(apiKey);
}

function getEmailFrom() {
  return process.env.AUTH_EMAIL_FROM ?? "JobBinder <invites@jobbinder.app>";
}

function getAppBaseUrl() {
  if (process.env.AUTH_URL) return process.env.AUTH_URL;
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

async function sendAuthEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  await getResendClient().emails.send({
    from: getEmailFrom(),
    to,
    subject,
    html,
    text,
  });
}

export function buildUrl(path: string, params: Record<string, string>) {
  const url = new URL(path, getAppBaseUrl());
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export async function sendVerificationEmail({ email, token }: AuthEmailInput) {
  const url = buildUrl("/verify-email/confirm", { email, token });
  await sendAuthEmail({
    to: email,
    subject: "Verify your JobBinder account",
    html: `<p>Verify your JobBinder account by opening this link:</p><p><a href="${url}">Verify email</a></p>`,
    text: `Verify your JobBinder account: ${url}`,
  });
}

export async function sendPasswordResetEmail({ email, token }: AuthEmailInput) {
  const url = buildUrl("/password-reset", { email, token });
  await sendAuthEmail({
    to: email,
    subject: "Set your JobBinder password",
    html: `<p>Set or reset your JobBinder password by opening this link:</p><p><a href="${url}">Set password</a></p>`,
    text: `Set or reset your JobBinder password: ${url}`,
  });
}

export async function sendInviteEmail({
  email,
  token,
  inviteId,
  companyName,
}: InviteEmailInput) {
  const url = buildUrl("/invite/accept", { inviteId, token });
  await sendAuthEmail({
    to: email,
    subject: `Join ${companyName} on JobBinder`,
    html: `<p>You were invited to join ${companyName} on JobBinder.</p><p><a href="${url}">Accept invite</a></p>`,
    text: `You were invited to join ${companyName} on JobBinder: ${url}`,
  });
}
