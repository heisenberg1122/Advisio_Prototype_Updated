/**
 * Presents wide data tables as expandable rows on phones.
 *
 * Tables stay as written; this only adds attributes and a toggle while the
 * viewport is phone sized, and removes them again above it. A table can opt out
 * with data-phone-table="scroll", or choose its columns with data-phone-title
 * and data-phone-summary (zero-based, comma separated).
 */
const EXEMPT_TABLES = '.cr-table-scroll table, table[data-phone-table="scroll"]';
const STATUS_HEADING = /status|risk|result|decision|state/i;
const ACTION_HEADING = /^(actions?|details?)$/i;
const TOGGLE_CLASS = "phone-row-toggle";
const CARD_ROLES = "data-phone-role";
const GUIDE_COPY = "data-phone-guide-copy";

function headingLabels(table: HTMLTableElement) {
  const rows = table.tHead?.rows;
  const row = rows?.[rows.length - 1];
  if (!row) return null;
  return Array.from(row.cells).flatMap((cell) => {
    const label = (cell.textContent ?? "").trim();
    return Array.from({ length: cell.colSpan || 1 }, () => label);
  });
}

function configuredColumns(value: string | undefined) {
  if (!value) return null;
  return value.split(",").map(Number).filter(Number.isInteger);
}

function setAttribute(element: Element, name: string, value: string) {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

function addToggle(row: HTMLElement, titleCell: HTMLElement) {
  let toggle = titleCell.querySelector<HTMLButtonElement>(`:scope > .${TOGGLE_CLASS}`);
  if (toggle) return;
  toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = TOGGLE_CLASS;
  const title = (titleCell.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
  const syncLabel = (open: boolean) => {
    toggle!.setAttribute("aria-expanded", String(open));
    toggle!.setAttribute("aria-label", `${open ? "Hide" : "Show"} details for ${title}`);
  };
  syncLabel(row.hasAttribute("data-phone-open"));
  toggle.addEventListener("click", (event) => {
    // Some rows open a record when tapped; expanding must not trigger that.
    event.stopPropagation();
    syncLabel(row.toggleAttribute("data-phone-open"));
  });
  titleCell.appendChild(toggle);
}

function enhanceTable(table: HTMLTableElement) {
  const labels = headingLabels(table);
  if (!labels || labels.length < 3) return;
  const titleIndex = configuredColumns(table.dataset.phoneTitle)?.[0] ?? 0;
  const configuredSummary = configuredColumns(table.dataset.phoneSummary);
  const statusIndex = labels.findIndex((label, index) => index !== titleIndex && STATUS_HEADING.test(label));
  const summary = new Set(configuredSummary ?? (statusIndex >= 0 ? [statusIndex] : []));
  const lastIndex = labels.length - 1;

  setAttribute(table, "data-phone-cards", "");
  // Card layout hides the header, so a Guide step aimed at it points at the table.
  const headerTarget = table.tHead?.querySelector<HTMLElement>("[data-guide]")?.dataset.guide;
  if (headerTarget && !table.dataset.guide) {
    table.dataset.guide = headerTarget;
    table.setAttribute(GUIDE_COPY, "");
  }
  for (const body of Array.from(table.tBodies)) {
    for (const row of Array.from(body.rows)) {
      if (row.cells.length === 1 && row.cells[0].colSpan > 1) {
        setAttribute(row, "data-phone-full", "");
        continue;
      }
      let column = 0;
      let titleCell: HTMLTableCellElement | undefined;
      let hasDetails = false;
      for (const cell of Array.from(row.cells)) {
        const label = labels[column] ?? "";
        const isActions = ACTION_HEADING.test(label) || (!label && column === lastIndex);
        const role = column === titleIndex ? "title" : isActions ? "actions" : summary.has(column) ? "summary" : "detail";
        setAttribute(cell, CARD_ROLES, role);
        setAttribute(cell, "data-label", label);
        if (role === "title") titleCell = cell;
        if (role === "detail" || role === "actions") hasDetails = true;
        column += cell.colSpan || 1;
      }
      if (titleCell && hasDetails) addToggle(row, titleCell);
    }
  }
}

/** Grid lists opt in with data-phone-rows="<title column>" and data-phone-summary. */
function enhanceGridList(list: HTMLElement) {
  const head = list.querySelector<HTMLElement>(":scope > .rs-row--head");
  const labels = head ? Array.from(head.children).map((cell) => (cell.textContent ?? "").trim()) : [];
  const titleIndex = Number(list.dataset.phoneRows) || 0;
  const summary = new Set(configuredColumns(list.dataset.phoneSummary) ?? []);
  list.querySelectorAll<HTMLElement>(":scope > .rs-row:not(.rs-row--head)").forEach((row) => {
    const cells = Array.from(row.children) as HTMLElement[];
    cells.forEach((cell, index) => {
      const role = index === titleIndex ? "title" : cell.classList.contains("rs-actions") ? "actions" : summary.has(index) ? "summary" : "detail";
      setAttribute(cell, CARD_ROLES, role);
      setAttribute(cell, "data-label", labels[index] ?? "");
    });
    if (cells[titleIndex]) addToggle(row, cells[titleIndex]);
  });
}

/** Centers the current tab once, so later swipes are never fought. */
function revealActiveTabs(root: ParentNode) {
  const strips = root.querySelectorAll<HTMLElement>('.portal-workspace-tabs, .as-nav, .rm-folders, [role="tablist"]');
  strips.forEach((strip) => {
    if (strip.scrollWidth <= strip.clientWidth) return;
    const active = strip.querySelector<HTMLElement>('[aria-current]:not([aria-current="false"]), [aria-selected="true"]');
    if (!active) return;
    const key = (active.getAttribute("href") ?? "") + (active.textContent ?? "");
    if (strip.dataset.phoneActive === key) return;
    strip.dataset.phoneActive = key;
    const offset = active.getBoundingClientRect().left - strip.getBoundingClientRect().left;
    strip.scrollLeft += offset - (strip.clientWidth - active.offsetWidth) / 2;
  });
}

export function enhancePhoneLayout(root: ParentNode) {
  root.querySelectorAll("table").forEach((table) => {
    if (!table.matches(EXEMPT_TABLES)) enhanceTable(table);
  });
  root.querySelectorAll<HTMLElement>("[data-phone-rows]").forEach(enhanceGridList);
  revealActiveTabs(root);
}

/** Opens the collapsed phone row holding a Guide target, so the step can point at it. */
export function revealPhoneRowTarget(key: string | undefined, root: ParentNode = document) {
  if (!key || key.includes(":")) return false;
  const matches = Array.from(root.querySelectorAll<HTMLElement>(`:is(table[data-phone-cards] tbody, [data-phone-rows]) [data-guide="${key}"]`));
  if (matches.length === 0 || matches.some((match) => match.getClientRects().length > 0)) return false;
  const row = matches[0].closest<HTMLElement>("tr, .rs-row");
  const toggle = row?.querySelector<HTMLButtonElement>(`.${TOGGLE_CLASS}`);
  if (!row || !toggle || row.hasAttribute("data-phone-open")) return false;
  row.setAttribute("data-phone-open", "");
  toggle.setAttribute("aria-expanded", "true");
  toggle.setAttribute("aria-label", (toggle.getAttribute("aria-label") ?? "").replace(/^Show/, "Hide"));
  return true;
}

export function resetPhoneLayout(root: ParentNode) {
  root.querySelectorAll(`[${GUIDE_COPY}]`).forEach((table) => {
    table.removeAttribute("data-guide");
    table.removeAttribute(GUIDE_COPY);
  });
  root.querySelectorAll(`.${TOGGLE_CLASS}`).forEach((toggle) => toggle.remove());
  root.querySelectorAll("[data-phone-cards]").forEach((table) => table.removeAttribute("data-phone-cards"));
  root.querySelectorAll("[data-phone-open]").forEach((row) => row.removeAttribute("data-phone-open"));
  root.querySelectorAll("[data-phone-full]").forEach((row) => row.removeAttribute("data-phone-full"));
  root.querySelectorAll(`[${CARD_ROLES}]`).forEach((cell) => {
    cell.removeAttribute(CARD_ROLES);
    cell.removeAttribute("data-label");
  });
  root.querySelectorAll<HTMLElement>("[data-phone-active]").forEach((strip) => delete strip.dataset.phoneActive);
}
