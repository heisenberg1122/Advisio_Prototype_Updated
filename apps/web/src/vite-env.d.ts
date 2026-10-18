/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_ENABLE_DEMO_ACCOUNTS?: string;
  readonly VITE_GOOGLE_SIGN_IN_CLIENT_ID?: string;
  readonly VITE_GOOGLE_SIGN_IN_ALLOW_SELF_SIGNUP?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
