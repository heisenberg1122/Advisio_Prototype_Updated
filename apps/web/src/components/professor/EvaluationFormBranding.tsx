import { useState } from "react";
import {
  defaultEvaluationBranding,
  type EvaluationBranding,
  type StructuredForm,
} from "@research-management/validations";
import {
  evaluationCard,
  evaluationInput,
} from "@/components/defense/StructuredEvaluationFields";

export async function prepareCollegeLogo(file: File): Promise<string> {
  if (
    !["image/png", "image/jpeg"].includes(file.type) ||
    file.size > 2 * 1024 * 1024
  )
    throw new Error("Choose a PNG or JPEG image up to 2 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (image.width * image.height > 16000000)
      throw new Error("Choose a logo smaller than 16 megapixels.");
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 512 / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let x0 = canvas.width,
      y0 = canvas.height,
      x1 = -1,
      y1 = -1;
    for (let y = 0; y < canvas.height; y++)
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        if (Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) < 220) {
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
      }
    if (x1 < x0)
      throw new Error(
        "This image appears blank. Choose a visible college logo.",
      );
    const output = document.createElement("canvas");
    output.width = output.height = 256;
    const target = output.getContext("2d")!,
      w = x1 - x0 + 1,
      h = y1 - y0 + 1,
      s = 256 / Math.max(w, h);
    target.fillStyle = "white";
    target.fillRect(0, 0, 256, 256);
    target.drawImage(
      canvas,
      x0,
      y0,
      w,
      h,
      (256 - w * s) / 2,
      (256 - h * s) / 2,
      w * s,
      h * s,
    );
    return output.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function EvaluationFormHeader({ form }: { form: StructuredForm }) {
  const b = form.branding || defaultEvaluationBranding;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-center text-[#002654]">
      <div className="grid grid-cols-[52px_minmax(0,1fr)_52px] items-center gap-3 sm:grid-cols-[72px_minmax(0,1fr)_72px]">
        <div className="aspect-square">
          {b.schoolLogo && (
            <img
              src={b.schoolLogo}
              alt="School logo"
              className="h-full w-full object-contain"
            />
          )}
        </div>
        <div>
          <p className="font-serif text-lg font-bold sm:text-2xl">
            {b.schoolName}
          </p>
          <p className="mt-1 text-[10px] sm:text-xs">{b.schoolAddress}</p>
          <p className="font-serif text-sm font-bold sm:text-lg">
            {b.collegeName}
          </p>
        </div>
        <div className="aspect-square">
          {b.collegeLogo && (
            <img
              src={b.collegeLogo}
              alt="College logo"
              className="h-full w-full object-contain"
            />
          )}
        </div>
      </div>
      <div className="mx-14 mt-2 border-t border-slate-400" />
      <p className="mt-2 text-right text-xs italic text-black">
        {b.templateName}
      </p>
      <p className="mt-3 font-bold uppercase text-black">{form.name}</p>
    </div>
  );
}

export function EvaluationFormBranding({
  form,
  onChange,
  disabled,
}: {
  form: StructuredForm;
  onChange: (form: StructuredForm) => void;
  disabled: boolean;
}) {
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const branding = form.branding || defaultEvaluationBranding;
  const update = (patch: Partial<EvaluationBranding>) =>
    onChange({ ...form, branding: { ...branding, ...patch } });
  return (
    <section className={evaluationCard}>
      <h3 className="font-bold">School header & form titles</h3>
      <p className="mt-1 text-sm">
        School details stay consistent. Set the college identity and titles for
        this template. Publishing saves a fixed copy.
      </p>
      <fieldset disabled={disabled || loading} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            School name
            <input
              readOnly
              className={`${evaluationInput} mt-1`}
              value={branding.schoolName}
            />
          </label>
          <label className="text-sm">
            School address
            <input
              readOnly
              className={`${evaluationInput} mt-1`}
              value={branding.schoolAddress}
            />
          </label>
          <label className="text-sm">
            College name
            <input
              className={`${evaluationInput} mt-1`}
              maxLength={150}
              value={branding.collegeName}
              onChange={(e) => update({ collegeName: e.target.value })}
            />
          </label>
          <label className="text-sm">
            Template form name / code
            <input
              className={`${evaluationInput} mt-1`}
              maxLength={150}
              value={branding.templateName}
              onChange={(e) => update({ templateName: e.target.value })}
            />
          </label>
        </div>
        <label className="block text-sm">
          College logo (PNG or JPEG, up to 2 MB)
          <input
            type="file"
            accept="image/png,image/jpeg"
            className="mt-2 block max-w-full text-sm"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setLoading(true);
              setError("");
              try {
                update({ collegeLogo: await prepareCollegeLogo(file) });
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Unable to read logo.",
                );
              } finally {
                setLoading(false);
              }
            }}
          />
        </label>
        {branding.collegeLogo && (
          <button
            type="button"
            className="text-sm underline"
            onClick={() => update({ collegeLogo: "" })}
          >
            Remove college logo
          </button>
        )}
      </fieldset>
      {loading && (
        <p role="status" className="mt-2 text-sm">
          Preparing logo…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
      <p className="my-4 text-xs">
        Logo padding is trimmed automatically; both logos use matching sizes and
        aligned edges.
      </p>
      <EvaluationFormHeader form={form} />
    </section>
  );
}
