import { createHash, randomBytes } from "crypto";

export type OneTimeTokenPurpose = "email-verify" | "password-reset" | "invite";

export type VerificationTokenClient = {
  verificationToken: {
    deleteMany(args: { where: { identifier: string } }): Promise<unknown>;
    create(args: {
      data: { identifier: string; token: string; expires: Date };
    }): Promise<unknown>;
    findUnique(args: {
      where: { identifier_token: { identifier: string; token: string } };
    }): Promise<{ expires: Date } | null>;
    delete(args: {
      where: { identifier_token: { identifier: string; token: string } };
    }): Promise<unknown>;
  };
};

export function getTokenIdentifier(purpose: OneTimeTokenPurpose, key: string) {
  const normalizedKey =
    purpose === "invite" ? key.trim() : key.trim().toLowerCase();

  return `${purpose}:${normalizedKey}`;
}

export function hashOneTimeToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createOneTimeToken({
  prisma,
  purpose,
  key,
  maxAgeMs,
  now = new Date(),
}: {
  prisma: VerificationTokenClient;
  purpose: OneTimeTokenPurpose;
  key: string;
  maxAgeMs: number;
  now?: Date;
}) {
  const identifier = getTokenIdentifier(purpose, key);
  const token = randomBytes(32).toString("base64url");

  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: {
      identifier,
      token: hashOneTimeToken(token),
      expires: new Date(now.getTime() + maxAgeMs),
    },
  });

  return token;
}

export async function consumeOneTimeToken({
  prisma,
  purpose,
  key,
  token,
  now = new Date(),
}: {
  prisma: VerificationTokenClient;
  purpose: OneTimeTokenPurpose;
  key: string;
  token: string;
  now?: Date;
}) {
  const identifier = getTokenIdentifier(purpose, key);
  const hashedToken = hashOneTimeToken(token);
  const record = await prisma.verificationToken.findUnique({
    where: {
      identifier_token: {
        identifier,
        token: hashedToken,
      },
    },
  });

  if (!record) return false;

  await prisma.verificationToken.delete({
    where: {
      identifier_token: {
        identifier,
        token: hashedToken,
      },
    },
  });

  return record.expires.getTime() > now.getTime();
}
