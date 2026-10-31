import { cn } from "@/lib/utils";
import "./advisio-brand-mark.css";

/** Display the symbol from the supplied logo without changing the source image. */
export function AdvisioBrandMark({
  className,
  alt = "Advisio",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <span className={cn("advisio-brand-mark inline-flex h-11 w-11", className)}>
      <span className="advisio-brand-mark__viewport">
        <img
          src="/advisio-logo.png"
          alt={alt}
          width={1254}
          height={1254}
          decoding="async"
          draggable={false}
        />
      </span>
    </span>
  );
}
