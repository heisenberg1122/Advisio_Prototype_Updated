/** Keep invitation secrets in the fragment while passing through sign-in. */
export function invitationReturnUrl(search: string, hash: string) {
  return new URLSearchParams(search).get("returnUrl") ===
    "/accept-invitation" && /^#token=[a-f0-9]{64}$/.test(hash)
    ? `/accept-invitation${hash}`
    : null;
}
