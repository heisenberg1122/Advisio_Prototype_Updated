import { describe, expect, it } from "vitest";
import type { MailThreadListResponse } from "@/components/messaging/mail-types";
import { isEmptyFolder, mergeObservation, observeFolder, type ResearcherMailFolder } from "./mailbox-presentation";

const empty: MailThreadListResponse = {
  threads: [], counts: { inbox: 0, unread: 7, sent: 0, drafts: 0, archive: 0, trash: 0 },
  pagination: { page: 1, pageSize: 30, total: 0, totalPages: 1 },
};

describe("researcher mailbox presentation", () => {
  it.each<ResearcherMailFolder>(["inbox", "sent", "drafts", "archive", "trash"])("corroborates %s independently of the Inbox unread badge", folder => {
    const observed = observeFolder(folder, empty, "", "all");
    expect(isEmptyFolder(observed, "", false, false)).toBe(true);
  });
  it("never treats an unresolved, loading, errored, or selected mailbox as empty", () => {
    const observed = observeFolder("inbox", empty, "", "all");
    expect(isEmptyFolder(undefined, "", false, false)).toBe(false);
    expect(isEmptyFolder(observed, "", true, false)).toBe(false);
    expect(isEmptyFolder(observed, "", false, true)).toBe(false);
    expect(isEmptyFolder(observed, "sent-only-deep-link", false, false)).toBe(false);
  });
  it("does not replace known folder state with filtered totals or a later page", () => {
    expect(observeFolder("inbox", empty, "search", "all")).toBeUndefined();
    expect(observeFolder("inbox", empty, "", "unread")).toBeUndefined();
    expect(observeFolder("inbox", empty, "", "attachments")).toBeUndefined();
    expect(observeFolder("inbox", { ...empty, pagination: { ...empty.pagination, page: 2 } }, "", "all")).toBeUndefined();
    expect(observeFolder("inbox", undefined, "", "all")).toBeUndefined();
  });
  it("permanently disables collapse for a folder whose count disagrees", () => {
    const bad = observeFolder("sent", { ...empty, counts: { ...empty.counts, sent: 1 } }, "", "all")!;
    const next = mergeObservation(bad, observeFolder("sent", empty, "", "all")!);
    expect(next.inconsistent).toBe(true);
    expect(isEmptyFolder(next, "", false, false)).toBe(false);
  });
  it("checks list emptiness in addition to the pagination total", () => {
    const inconsistent = observeFolder("drafts", { ...empty, pagination: { ...empty.pagination, total: 1 }, counts: { ...empty.counts, drafts: 1 } }, "", "all");
    expect(inconsistent?.inconsistent).toBe(true);
  });
});
