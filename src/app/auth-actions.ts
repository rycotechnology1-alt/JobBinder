"use server";

import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import prisma from "@/lib/prisma";
import {
  acceptCompanyInvite,
  createCompanyAdminAccount,
  requestPasswordSetupEmail,
  resetPasswordWithToken,
  sendEmailVerificationForUser,
} from "@/lib/account-auth";
import { getPostSignInPath, normalizeAuthEmail } from "@/lib/auth-rules";

export type AuthFormState = {
  message?: string;
  fieldErrors?: Record<string, string>;
  ok?: boolean;
};

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function hasAuthError(url: string) {
  return new URL(url, "http://localhost").searchParams.has("error");
}

async function getFreshPostSignInPath(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      emailVerified: true,
      memberships: {
        where: { status: "ACTIVE" },
        orderBy: { joinedAt: "asc" },
        select: { companyId: true },
      },
    },
  });

  return getPostSignInPath({
    companyId: user?.memberships[0]?.companyId ?? null,
    emailVerified: user?.emailVerified ?? null,
  });
}

export async function signupCompanyAdmin(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const password = getString(formData, "password");
  const result = await createCompanyAdminAccount({
    companyName: getString(formData, "companyName"),
    adminName: getString(formData, "adminName"),
    email: getString(formData, "email"),
    password,
    confirmPassword: getString(formData, "confirmPassword"),
  });

  if (!result.ok) {
    return {
      message: result.message,
      fieldErrors: result.fieldErrors,
    };
  }

  await signIn("credentials", {
    email: result.email,
    password,
    redirectTo: "/verify-email",
  });

  return { ok: true };
}

export async function signInWithPassword(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = normalizeAuthEmail(getString(formData, "email"));
  const password = getString(formData, "password");
  const redirectUrl = await signIn("credentials", {
    email,
    password,
    redirect: false,
    redirectTo: "/dashboard",
  });

  if (hasAuthError(redirectUrl)) {
    return {
      message:
        "Invalid email or password. If you used magic links before, set your password first.",
    };
  }

  redirect(await getFreshPostSignInPath(email));
}

export async function resendVerificationEmailAction(
  _state: AuthFormState,
): Promise<AuthFormState> {
  void _state;

  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    return { message: "Sign in before requesting a new verification email." };
  }

  await sendEmailVerificationForUser(email);
  return { ok: true, message: "Verification email sent." };
}

export async function requestPasswordReset(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await requestPasswordSetupEmail(getString(formData, "email"));
  return {
    ok: true,
    message: "If that email exists, a password setup link is on the way.",
  };
}

export async function resetPassword(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const password = getString(formData, "password");
  const result = await resetPasswordWithToken({
    email: getString(formData, "email"),
    token: getString(formData, "token"),
    password,
    confirmPassword: getString(formData, "confirmPassword"),
  });

  if (!result.ok) {
    return {
      message: result.message,
      fieldErrors: result.fieldErrors,
    };
  }

  await signIn("credentials", {
    email: result.email,
    password,
    redirectTo: "/dashboard",
  });

  return { ok: true };
}

export async function acceptInvite(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const password = getString(formData, "password");
  const result = await acceptCompanyInvite({
    inviteId: getString(formData, "inviteId"),
    token: getString(formData, "token"),
    name: getString(formData, "name"),
    password,
    confirmPassword: getString(formData, "confirmPassword"),
  });

  if (!result.ok) {
    return {
      message: result.message,
      fieldErrors: result.fieldErrors,
    };
  }

  await signIn("credentials", {
    email: result.email,
    password,
    redirectTo: "/dashboard",
  });

  return { ok: true };
}
