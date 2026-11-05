import type { StructuredForm } from "@research-management/validations";

export function EvaluationFormBranding({ form }: { form: StructuredForm }) {
  const branding = form.branding;
  if (!branding) return null;
  return (
    <div className="mb-4 flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
      {branding.schoolLogo && (
        <img
          src={branding.schoolLogo}
          alt={`${branding.schoolName} logo`}
          className="h-16 w-16 shrink-0 object-contain"
        />
      )}
      <div className="min-w-0 text-center">
        <p className="text-sm font-bold">{branding.schoolName}</p>
        <p className="mt-1 text-sm">{branding.collegeName}</p>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          {branding.templateName}
        </p>
      </div>
      {branding.collegeLogo && (
        <img
          src={branding.collegeLogo}
          alt={`${branding.collegeName} logo`}
          className="h-16 w-16 shrink-0 object-contain"
        />
      )}
    </div>
  );
}
