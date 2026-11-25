import { useState, type ReactNode } from "react";
import { CountStrip, PageBand, SegmentedSwitch, type CountItem } from "@/components/ui/advisio";
import { Button } from "@/components/ui/Button";
import { useIsPhone } from "@/hooks/use-is-phone";
import "./role-home.css";
import "./role-screens.css";

export type BandAction = {
  label: string;
  /** Shorter wording for the compact phone banner. */
  phoneLabel?: string;
  icon?: string;
  onClick?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  guide?: string;
};

/** Dark page banner shared by every Dean and Coordinator screen. */
export function RoleBand({
  eyebrow,
  title,
  titleId,
  meta,
  counts,
  countsLabel,
  primary,
  secondary = [],
  guide,
  onBack,
  backLabel,
  home = false,
  phoneStatus,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  titleId: string;
  meta?: ReactNode;
  counts?: CountItem[];
  countsLabel?: string;
  primary?: BandAction;
  secondary?: BandAction[];
  guide?: string;
  onBack?: () => void;
  backLabel?: string;
  /** Role Homes keep the full banner on phones. */
  home?: boolean;
  /** Replaces the summary on phones; set it only when something needs action. */
  phoneStatus?: ReactNode;
}) {
  const isPhone = useIsPhone();
  const actions = primary || secondary.length ? (
    <>
      {primary && (
        <Button
          size="sm"
          variant="secondary"
          data-guide={primary.guide}
          disabled={primary.disabled}
          isLoading={primary.isLoading}
          icon={primary.icon ? <i className={`ti ${primary.icon}`} aria-hidden="true" /> : undefined}
          onClick={primary.onClick}
        >
          {isPhone && primary.phoneLabel ? primary.phoneLabel : primary.label}
        </Button>
      )}
      {secondary.map((action) => (
        <Button
          key={action.label}
          size={isPhone ? "icon" : "sm"}
          variant="ghost"
          className="au-on-home"
          aria-label={isPhone ? action.label : undefined}
          data-guide={action.guide}
          disabled={action.disabled}
          isLoading={action.isLoading}
          icon={action.icon ? <i className={`ti ${action.icon}`} aria-hidden="true" /> : undefined}
          onClick={action.onClick}
        >
          {isPhone ? undefined : action.label}
        </Button>
      ))}
    </>
  ) : undefined;
  return (
    <PageBand
      variant="home"
      className={`role-hero rs-band${home ? " rs-band--home" : ""}`}
      titleId={titleId}
      guide={guide}
      eyebrow={
        onBack ? (
          <span className="rs-eyebrow">
            <button type="button" className="rs-back" aria-label={backLabel || "Go back"} onClick={onBack}>
              <i className="ti ti-arrow-left" aria-hidden="true" />
            </button>
            {eyebrow}
          </span>
        ) : (
          eyebrow
        )
      }
      title={title}
      meta={isPhone && !home ? phoneStatus : meta}
      counts={counts?.length ? <CountStrip label={countsLabel || "Summary"} items={counts} /> : undefined}
      actions={actions}
    />
  );
}

export function FilterChips<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: NoInfer<T>) => void;
  options: Array<{ value: NoInfer<T>; label: string; count?: number }>;
}) {
  return (
    <div className="rs-chips" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" className="rs-chip" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
          {option.label}
          {option.count !== undefined && <em>{option.count}</em>}
        </button>
      ))}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  guide,
  tour = true,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  guide?: string;
  tour?: boolean;
}) {
  return (
    <span className="rs-find">
      <i className="ti ti-search" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        data-guide={guide}
        data-tour={tour ? "page-filter" : undefined}
      />
    </span>
  );
}

export type ScreenView = "cards" | "list";

/** Cards or list choice, remembered per viewer on this device. */
export function useScreenView(storageKey: string, initial: ScreenView = "cards") {
  const [view, setView] = useState<ScreenView>(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      return saved === "cards" || saved === "list" ? saved : initial;
    } catch {
      return initial;
    }
  });
  const change = (next: ScreenView) => {
    setView(next);
    try {
      window.localStorage.setItem(storageKey, next);
    } catch {
      // The choice still applies for this visit.
    }
  };
  return [view, change] as const;
}

export function ViewSwitch({ value, onChange }: { value: ScreenView; onChange: (value: ScreenView) => void }) {
  return (
    <SegmentedSwitch
      label="View as"
      value={value}
      onChange={onChange}
      options={[
        { value: "cards", label: <><i className="ti ti-layout-grid" aria-hidden="true" /> Cards</> },
        { value: "list", label: <><i className="ti ti-list" aria-hidden="true" /> List</> },
      ]}
    />
  );
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

export const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
