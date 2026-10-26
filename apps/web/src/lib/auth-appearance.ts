// Keep the pre-paint check in index.html in sync with this route boundary.
export function usesDefaultAuthAppearance(pathname: string): boolean {
  return /^\/(login|register|forgot-password|reset-password|first-login-setup|google-onboarding|researcher-onboarding|choose-dashboard)\/*$/.test(pathname);
}
