type CameraSupportInput = {
  isSecureContext: boolean;
  protocol: string;
  hostname: string;
  hasMediaDevices: boolean;
};

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

export const INSECURE_CAMERA_CONTEXT_MESSAGE =
  "Camera scanning needs a secure HTTPS connection on mobile Safari and Chrome. Open this scanner over HTTPS, or use the regular file upload instead.";

export const UNSUPPORTED_CAMERA_MESSAGE = "Camera scanning is not supported in this browser.";

export function getScanicCameraSupportError({
  isSecureContext,
  protocol,
  hostname,
  hasMediaDevices,
}: CameraSupportInput) {
  if (!isSecureContext && protocol !== "https:" && !LOCAL_HOSTNAMES.has(hostname)) {
    return INSECURE_CAMERA_CONTEXT_MESSAGE;
  }

  if (!hasMediaDevices) {
    return UNSUPPORTED_CAMERA_MESSAGE;
  }

  return null;
}

