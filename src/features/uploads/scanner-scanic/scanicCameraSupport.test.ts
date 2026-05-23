import { describe, expect, it } from "vitest";
import { getScanicCameraSupportError } from "./scanicCameraSupport";

describe("getScanicCameraSupportError", () => {
  it("explains why iPhone Safari will not request camera access on HTTP LAN addresses", () => {
    expect(
      getScanicCameraSupportError({
        isSecureContext: false,
        protocol: "http:",
        hostname: "10.0.0.243",
        hasMediaDevices: false,
      }),
    ).toBe(
      "Camera scanning needs a secure HTTPS connection on mobile Safari and Chrome. Open this scanner over HTTPS, or use the regular file upload instead.",
    );
  });

  it("returns no error when the browser exposes getUserMedia", () => {
    expect(
      getScanicCameraSupportError({
        isSecureContext: true,
        protocol: "https:",
        hostname: "example.com",
        hasMediaDevices: true,
      }),
    ).toBeNull();
  });
});
