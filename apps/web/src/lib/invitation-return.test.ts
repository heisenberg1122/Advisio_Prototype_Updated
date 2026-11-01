import { describe, expect, it } from "vitest";
import { invitationReturnUrl } from "./invitation-return";
import { resolvePostLoginAction } from "./post-login-navigation";

describe("invitation sign-in return", () => {
  const hash = `#token=${"a".repeat(64)}`;
  it("preserves the token in a fragment through sign-in and dashboard selection", () => {
    const destination = invitationReturnUrl(
      "?returnUrl=%2Faccept-invitation",
      hash,
    );
    expect(destination).toBe(`/accept-invitation${hash}`);
    expect(
      resolvePostLoginAction({
        roles: ["ADVISER", "PANELIST"],
        returnUrl: destination,
      }).url,
    ).toBe(destination);
  });
  it("rejects external destinations and malformed tokens", () => {
    expect(
      invitationReturnUrl("?returnUrl=https://attacker.invalid", hash),
    ).toBeNull();
    expect(
      invitationReturnUrl("?returnUrl=/accept-invitation", "#token=invalid"),
    ).toBeNull();
  });
});
