import { describe, expect, it } from "vitest";
import { getAuthCallbackErrorMessage, isPasswordRecoveryCallback } from "../client/src/lib/authCallback";

describe("auth callback errors", () => {
  it("recognizes an expired OTP link", () => {
    expect(getAuthCallbackErrorMessage("#error=access_denied&error_code=otp_expired")).toContain("email link has expired");
  });

  it("recognizes a denied or invalid link", () => {
    expect(getAuthCallbackErrorMessage("#error=access_denied")).toContain("invalid or has expired");
  });

  it("does not treat a normal auth hash as an error", () => {
    expect(getAuthCallbackErrorMessage("#access_token=token&type=recovery")).toBeNull();
    expect(getAuthCallbackErrorMessage("")).toBeNull();
  });

  it("identifies a Supabase recovery callback separately from ordinary sign-in", () => {
    expect(isPasswordRecoveryCallback("#access_token=token&type=recovery")).toBe(true);
    expect(isPasswordRecoveryCallback("#access_token=token&type=signup")).toBe(false);
    expect(isPasswordRecoveryCallback("#type=recovery")).toBe(false);
  });
});
