import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // University of the Assumption (UA) Institutional Color System
        primary: {
          DEFAULT: "var(--color-primary, #0B3A53)",
          dark: "var(--color-primary-dark, #072A3D)",
          light: "var(--color-primary-light, #EAF3F7)",
          subtle: "var(--color-primary-subtle, #F1F7FA)",
          hover: "var(--color-primary-hover, #082E42)",
        },
        accent: {
          DEFAULT: "var(--color-accent, #C9A227)",
          dark: "var(--color-accent-dark, #B38E1B)",
          light: "var(--color-accent-light, #FDF8E8)",
          hover: "var(--color-accent-hover, #A58216)",
          gold: "#FFA400",
          "gold-hover": "#E09000",
        },
        background: {
          DEFAULT: "var(--color-background, #F8FAFC)",
          surface: "var(--color-surface, #FFFFFF)",
          muted: "var(--color-surface-muted, #F1F5F9)",
        },
        surface: {
          DEFAULT: "var(--color-surface, #FFFFFF)",
          muted: "var(--color-surface-muted, #F1F5F9)",
          subtle: "var(--color-surface-subtle, #F8FAFC)",
        },
        border: {
          DEFAULT: "var(--color-border, #E2E8F0)",
          subtle: "var(--color-border-subtle, #F1F5F9)",
          strong: "var(--color-border-strong, #CBD5E1)",
        },
        text: {
          DEFAULT: "var(--color-text-primary, #17212B)",
          primary: "var(--color-text-primary, #17212B)",
          secondary: "var(--color-text-secondary, #64748B)",
          muted: "var(--color-text-muted, #94A3B8)",
          inverse: "var(--color-text-inverse, #FFFFFF)",
        },
        status: {
          success: "var(--color-success, #2E7D5B)",
          warning: "var(--color-warning, #C58A18)",
          danger: "var(--color-danger, #C94A4A)",
          info: "var(--color-info, #0B3A53)",
        },
      },
      spacing: {
        // Strict 8px System Tokens (with 4px half-steps)
        0.5: "2px",
        1: "4px",
        1.5: "6px",
        2: "8px",
        2.5: "10px",
        3: "12px",
        3.5: "14px",
        4: "16px",
        5: "20px",
        6: "24px",
        7: "28px",
        8: "32px",
        9: "36px",
        10: "40px",
        11: "44px",
        12: "48px",
        14: "56px",
        16: "64px",
        20: "80px",
        24: "96px",
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "8px",
        md: "10px",
        lg: "12px",
        xl: "14px",
        "2xl": "16px",
        "3xl": "24px",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(11, 58, 83, 0.04), 0 1px 2px -1px rgba(11, 58, 83, 0.04)",
        "card-soft": "0 2px 8px -2px rgba(15, 23, 42, 0.05), 0 1px 4px -1px rgba(15, 23, 42, 0.03)",
        "card-hover": "0 8px 20px -4px rgba(11, 58, 83, 0.08), 0 4px 8px -2px rgba(11, 58, 83, 0.04)",
        dropdown: "0 10px 25px -5px rgba(11, 58, 83, 0.12), 0 8px 10px -6px rgba(11, 58, 83, 0.08)",
        modal: "0 20px 35px -10px rgba(11, 58, 83, 0.22)",
      },
      fontFamily: {
        sans: ["Inter", "Roboto", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
