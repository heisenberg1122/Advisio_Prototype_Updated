import { SUPPORTED_UPLOAD_TYPES } from "@/lib/task-submission";

export function SubmissionFileTypes({ value, onChange }: {
  value: string;
  onChange: (value: string) => void;
}) {
  const selected = value.toUpperCase().split(",").map((type) => type.trim());
  const all = selected.includes("ALL");
  return (
    <fieldset className="mt-3 min-w-0">
      <legend className="text-sm font-bold text-slate-700">Accepted file types</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {["ALL", ...SUPPORTED_UPLOAD_TYPES].map((type) => (
          <label key={type} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700">
            <input type="checkbox" checked={type === "ALL" ? all : !all && selected.includes(type)}
              disabled={type === "ALL" ? all : !all && selected.length === 1 && selected.includes(type)}
              onChange={() => {
                if (type === "ALL") onChange("ALL");
                else if (all) onChange(type);
                else onChange((selected.includes(type) ? selected.filter((item) => item !== type) : [...selected, type]).join(","));
              }} className="accent-[#173f63]" />
            {type === "ALL" ? "All files" : type}
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">All files accepts the supported formats shown above. Maximum 10 MB per submission. Defense manuscript packets require PDF.</p>
    </fieldset>
  );
}
