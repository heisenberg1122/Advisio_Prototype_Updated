import React, { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { getAcademicIdentity } from "@/lib/academic-identity";

/* Shared Advisio UI. Styles live in src/styles/advisio-ui.css. */

export type StatusTone = "done" | "waiting" | "attention" | "live" | "neutral" | "brand";

/** Dot + text status. Never a pill. */
export function StatusDot({ tone = "neutral", children, className }: { tone?: StatusTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("au-status", className)} data-tone={tone}>
      {children}
    </span>
  );
}

function useCollegeSeal() {
  const { user } = useAuth();
  return getAcademicIdentity({ college: user?.college as any, program: user?.program as any })?.logoSrc;
}

/**
 * Page header band. `variant="home"` is the full-colour band used only on Home pages;
 * every other page uses the default soft-tint band.
 */
export function PageBand({
  variant = "page",
  eyebrow,
  title,
  titleId,
  meta,
  counts,
  actions,
  footer,
  guide,
  className,
}: {
  variant?: "page" | "home";
  eyebrow?: ReactNode;
  title: ReactNode;
  titleId?: string;
  meta?: ReactNode;
  counts?: ReactNode;
  actions?: ReactNode;
  /** Shown under the meta line, on the left (e.g. primary buttons). */
  footer?: ReactNode;
  guide?: string;
  className?: string;
}) {
  const seal = useCollegeSeal();
  return (
    <section className={cn("au-band", variant === "home" && "au-band--home", className)} aria-labelledby={titleId}>
      {seal && <img className="au-band-seal" src={seal} alt="" aria-hidden="true" draggable={false} />}
      <div className="au-band-main">
        {eyebrow && <p className="au-band-eyebrow">{eyebrow}</p>}
        <h1 id={titleId} className="au-band-title" data-guide={guide}>
          {title}
        </h1>
        {meta && <p className="au-band-meta">{meta}</p>}
        {footer && <div className="au-band-footer">{footer}</div>}
      </div>
      {(counts || actions) && (
        <div className="au-band-side">
          {counts}
          {actions && <div className="au-band-actions">{actions}</div>}
        </div>
      )}
    </section>
  );
}

export type CountItem = { label: string; value: ReactNode; tone?: "waiting"; onClick?: () => void };

/** Row of small labelled numbers with dividers. */
export function CountStrip({ items, label = "Summary" }: { items: CountItem[]; label?: string }) {
  return (
    <dl className="au-counts" aria-label={label}>
      {items.map((item) => (
        <div key={item.label} data-tone={item.tone}>
          <dt>{item.label}</dt>
          <dd>
            {item.onClick ? (
              <button type="button" onClick={item.onClick}>
                {item.value}
              </button>
            ) : (
              <span>{item.value}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Card with a heading row: title, optional count, optional link or action. */
export function SectionCard({
  title,
  titleId,
  count,
  action,
  children,
  className,
  as: Tag = "section",
}: {
  title: ReactNode;
  titleId: string;
  count?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  as?: "section" | "aside";
}) {
  return (
    <Tag className={cn("au-card", className)} aria-labelledby={titleId}>
      <header className="au-card-head">
        <h2 id={titleId} className="au-card-title">
          {title}
          {count !== undefined && <span className="au-card-count">{count}</span>}
        </h2>
        {action}
      </header>
      {children}
    </Tag>
  );
}

/** Quiet text link used in card headers ("View all →"). */
export function CardLink({ children, onClick, href }: { children: ReactNode; onClick?: () => void; href?: string }) {
  const content = (
    <>
      {children} <i className="ti ti-arrow-right" aria-hidden="true" />
    </>
  );
  return href ? (
    <a className="au-link" href={href}>
      {content}
    </a>
  ) : (
    <button type="button" className="au-link" onClick={onClick}>
      {content}
    </button>
  );
}

/** One list row: leading visual, title, meta line, trailing status or action. */
export function ListRow({
  leading,
  title,
  meta,
  end,
  onClick,
  tone,
  titleHint,
}: {
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  end?: ReactNode;
  onClick?: () => void;
  tone?: "live";
  titleHint?: string;
}) {
  const body = (
    <>
      {leading ?? <span />}
      <span className="au-row-body">
        <span className="au-row-title" title={titleHint}>
          {title}
        </span>
        {meta && <span className="au-row-meta">{meta}</span>}
      </span>
      {end ? <span className="au-row-end">{end}</span> : <span />}
    </>
  );
  return onClick ? (
    <button type="button" className="au-row" data-tone={tone} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className="au-row" data-tone={tone}>
      {body}
    </div>
  );
}

/** Square icon used at the start of a list row. */
export function RowIcon({ icon }: { icon: string }) {
  return (
    <span className="au-row-icon" aria-hidden="true">
      <i className={`ti ${icon}`} />
    </span>
  );
}

/** Two-line date tile: small top label, bold bottom value. */
export function DateTile({ top, bottom, tone, label }: { top: ReactNode; bottom: ReactNode; tone?: "live" | "muted"; label?: string }) {
  return (
    <span className="au-date" data-tone={tone} aria-label={label} role={label ? "img" : undefined}>
      <span aria-hidden={label ? true : undefined}>{top}</span>
      <strong aria-hidden={label ? true : undefined}>{bottom}</strong>
    </span>
  );
}

/** Empty state: icon, short title, one explanatory line, optional action. */
export function EmptyNote({ icon = "ti-inbox", title, text, action }: { icon?: string; title: ReactNode; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="au-empty">
      <span className="au-empty-icon" aria-hidden="true">
        <i className={`ti ${icon}`} />
      </span>
      <p className="au-empty-title">{title}</p>
      {text && <p className="au-empty-text">{text}</p>}
      {action && <div className="au-empty-action">{action}</div>}
    </div>
  );
}

/** Segmented switch: filters the same content. */
export function SegmentedSwitch<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: ReactNode; count?: number }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="au-seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
          {option.label}
          {option.count ? <span className="au-seg-count">{option.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** On/off switch. */
export function ToggleSwitch({
  checked,
  onChange,
  label,
  labelledBy,
  disabled,
  guide,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  labelledBy?: string;
  disabled?: boolean;
  guide?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-labelledby={label ? undefined : labelledBy}
      disabled={disabled}
      data-guide={guide}
      className="au-toggle"
      onClick={() => onChange(!checked)}
    >
      <span aria-hidden="true" />
    </button>
  );
}

/** Small message shown next to the action that caused it. */
export function InlineFeedback({ tone, children }: { tone: "ok" | "error"; children: ReactNode }) {
  return (
    <p className="au-feedback" data-tone={tone} role={tone === "error" ? "alert" : "status"}>
      <i className={`ti ${tone === "ok" ? "ti-check" : "ti-alert-circle"}`} aria-hidden="true" />
      {children}
    </p>
  );
}
