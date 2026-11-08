export type GuidedInteraction = "read" | "click" | "input";
export interface GuidedTarget {
  key: string;
  text?: string;
  emptyText?: string;
  disabledText?: string;
  interaction?: GuidedInteraction;
  next?: string;
  to?: string;
  optional?: boolean;
  /** A user can choose a different rendered record with the same guide marker. */
  anyMatching?: boolean;
}
export interface GuidedControlStep {
  id: string;
  title: string;
  text: string;
  targets: GuidedTarget[];
  prepare?: "sidebar" | "profile";
  route?: string;
  to?: string;
  next?: string;
  fallback: string;
}
export interface GuidedJourney {
  id: string;
  title: string;
  steps: GuidedControlStep[];
}
