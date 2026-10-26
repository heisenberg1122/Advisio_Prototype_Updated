import type { KeyboardEvent } from "react";

/** Automatic tab activation with arrows, Home and End; Tab exits the tab list. */
export function handleLandingTabKey(event: KeyboardEvent<HTMLElement>) {
  const tabs = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=tab]"),
  );
  const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
  let index: number;
  if (event.key === "Home") index = 0;
  else if (event.key === "End") index = tabs.length - 1;
  else if (event.key === "ArrowUp" || event.key === "ArrowLeft")
    index = (current - 1 + tabs.length) % tabs.length;
  else if (event.key === "ArrowDown" || event.key === "ArrowRight")
    index = (current + 1) % tabs.length;
  else return;
  event.preventDefault();
  tabs[index]?.focus();
  tabs[index]?.click();
}
