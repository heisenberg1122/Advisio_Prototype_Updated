"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useLocation } from "react-router-dom";
import { CircleHelp, ArrowRight, ChevronDown } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useActiveProjectContext } from "@/providers/active-project-provider";
import { workspaceGuide } from "@/lib/workspace-guide";

export function WorkspaceHelp() {
  const [open, setOpen] = useState(false);
  const { pathname, search } = useLocation();
  const { projectHref } = useActiveProjectContext();
  const guide = workspaceGuide(pathname, search);

  return <>
    <button type="button" aria-label="Help & Guide" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}
      className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-xs font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--nav-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)] sm:px-3 sm:text-sm">
      <CircleHelp className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="sm:hidden">Help</span><span className="hidden sm:inline">Help &amp; Guide</span>
    </button>
    {open && createPortal(
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Quick guide" subtitle={`${guide.role} workspace`} maxWidth="xl"
        className="max-h-[calc(100dvh-2rem)] [&>div:first-child]:shrink-0 [&>div:last-child]:min-h-0">
        <div className="space-y-6 text-sm text-[var(--color-text-primary)]">
          <section aria-label="Help for this page" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-light)] p-4">
            <p className="mb-1 text-xs font-semibold text-[var(--color-primary)]">On this page</p>
            <h4 className="font-bold">{guide.page.title}</h4>
            <p className="mt-2 leading-6 text-[var(--color-text-secondary)]">{guide.page.description}</p>
          </section>
          <section aria-label="Getting started">
            <h4 className="text-base font-bold">Start here</h4>
            <p className="mt-1 leading-6 text-[var(--color-text-secondary)]">{guide.introduction}</p>
            <ol className="mt-4 space-y-4">
              {guide.steps.map((step, index) => <li key={step.href} className="flex gap-3">
                <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-xs font-bold text-[var(--color-primary)]">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <h5 className="font-semibold">{step.title}</h5>
                  <p className="mt-1 leading-6 text-[var(--color-text-secondary)]">{step.description}</p>
                  <Link href={projectHref(step.href)} onClick={() => setOpen(false)} className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-lg px-1 font-semibold text-[var(--color-primary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)]">
                    {step.action}<ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                  </Link>
                </div>
              </li>)}
            </ol>
          </section>
          <section aria-label="Common questions">
            <h4 className="mb-3 text-base font-bold">Common questions</h4>
            {[guide.navigationQuestion, ...guide.questions].map(({ question, answer }) => <details key={question} className="group border-t border-[var(--color-border)]">
              <summary tabIndex={0} className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg py-3 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)] [&::-webkit-details-marker]:hidden">
                {question}<ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="pb-4 leading-6 text-[var(--color-text-secondary)]">{answer}</p>
            </details>)}
          </section>
          <p className="rounded-xl bg-[var(--color-surface-subtle)] p-4 leading-6 text-[var(--color-text-secondary)]">{guide.support}</p>
        </div>
      </Modal>, document.body,
    )}
  </>;
}
