import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./auth-password";

describe("auth passwords", () => {
  it("hashes passwords and verifies only the original value", async () => {
    const hashedPassword = await hashPassword("Password1");

    expect(hashedPassword).not.toBe("Password1");
    await expect(verifyPassword("Password1", hashedPassword)).resolves.toBe(true);
    await expect(verifyPassword("WrongPassword1", hashedPassword)).resolves.toBe(false);
  });
});
