export function getAuthCallbackErrorMessage(hash: string): string | null {
  const rawHash = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!rawHash) return null;

  const params = new URLSearchParams(rawHash);
  const error = params.get("error");
  const errorCode = params.get("error_code");
  if (!error && !errorCode) return null;

  if (errorCode === "otp_expired") {
    return "This email link has expired. For security, your existing session was signed out. Request a new link, then sign in again.";
  }

  return "This sign-in link is invalid or has expired. For security, your existing session was signed out.";
}
