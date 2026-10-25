import { useEffect, useRef } from "react";
import {
  ChevronDown,
  FilePlus2,
  Link as LinkIcon,
  Plus,
  Upload,
} from "lucide-react";

export function DocumentAddMenu({
  disabled,
  onCreate,
  onUpload,
  onLink,
}: {
  disabled?: boolean;
  onCreate: () => void;
  onUpload: () => void;
  onLink: () => void;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (menu.current && !menu.current.contains(event.target as Node))
        menu.current.open = false;
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  const choose = (action: () => void) => {
    if (menu.current) menu.current.open = false;
    action();
  };
  return (
    <details
      ref={menu}
      className="group relative"
      onKeyDown={(event) => {
        if (event.key === "Escape" && menu.current?.open) {
          menu.current.open = false;
          menu.current.querySelector("summary")?.focus();
          event.stopPropagation();
        }
      }}
    >
      <summary
        aria-disabled={disabled}
        onClick={(event) => {
          if (disabled) event.preventDefault();
        }}
        className={`flex min-h-9 cursor-pointer list-none items-center justify-center gap-2 rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary)] px-4 py-1.5 text-sm font-semibold text-[var(--college-on-primary)] dark:text-[var(--college-on-primary-dark)] outline-none transition hover:bg-[var(--color-primary-dark)] focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)] [&::-webkit-details-marker]:hidden ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      >
        <Plus className="h-4 w-4" />
        Add document
        <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
      </summary>
      <div className="absolute right-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-[var(--shadow-modal)]">
        {[
          {
            label: "Upload working file",
            description: "Add a PDF, Word, or text file",
            Icon: Upload,
            action: onUpload,
          },
          {
            label: "Create Google document",
            description: "Start an editable draft in Google",
            Icon: FilePlus2,
            action: onCreate,
          },
          {
            label: "Link Google document",
            description: "Add an existing Google Docs or Drive link",
            Icon: LinkIcon,
            action: onLink,
          },
        ].map(({ label, description, Icon, action }) => (
          <button
            key={label}
            type="button"
            onClick={() => choose(action)}
            className="flex w-full items-start gap-3 rounded-lg p-3 text-left outline-none hover:bg-[var(--color-surface-muted)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--college-focus-ring)]"
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary)]" />
            <span>
              <span className="block text-sm font-semibold text-[var(--color-text-primary)]">
                {label}
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-[var(--color-text-secondary)]">
                {description}
              </span>
            </span>
          </button>
        ))}
      </div>
    </details>
  );
}
