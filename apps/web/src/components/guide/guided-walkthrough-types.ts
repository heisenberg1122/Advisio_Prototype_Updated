export type GuidedInteraction = "read" | "click" | "input";
export interface GuidedTarget {
  key: string;
  text?: string;
  emptyText?: string;
  interaction?: GuidedInteraction;
  next?: string;
  to?: string;
  optional?: boolean;
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
