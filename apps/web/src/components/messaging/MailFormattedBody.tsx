import { Fragment } from "react";

const INLINE_MARKUP = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;

function InlineText({ value }: { value: string }) {
  return value.split(INLINE_MARKUP).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export function MailFormattedBody({ body }: { body: string }) {
  const lines = body.split("\n");
  return (
    <div className="space-y-1 whitespace-pre-wrap break-words text-base leading-6">
      {lines.map((line, index) =>
        line.startsWith("- ") ? (
          <div key={index} className="flex gap-2 pl-2">
            <span aria-hidden="true">&bull;</span>
            <span>
              <InlineText value={line.slice(2)} />
            </span>
          </div>
        ) : (
          <p key={index} className={line ? undefined : "h-3"}>
            <InlineText value={line} />
          </p>
        ),
      )}
    </div>
  );
}
