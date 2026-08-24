import { describe, expect, it } from "vitest";
import { getPasswordResetToken } from "../client/src/lib/authCallback";

describe("local auth callback helpers", () => {
  it("extracts a password reset token from the query string", () => {
    expect(getPasswordResetToken("?reset_token=reset_abc")).toBe("reset_abc");
  });

  it("does not treat an ordinary URL as a reset flow", () => {
    expect(getPasswordResetToken("")).toBeNull();
    expect(getPasswordResetToken("?foo=bar")).toBeNull();
  });
});
