import { useEffect, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { MessageSquare, Send } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useSubmissionHighlights } from "./SubmissionHighlightContext";
import type { SubmissionTextAnchor } from "@/lib/submission-highlight";
import { formatReviewDateTime } from "@/lib/review-date";

type Comment = {
  id: string;
  body: string;
  pageNumber: number | null;
  textAnchor?: SubmissionTextAnchor | null;
  createdAt: string;
  author: { id: string; firstName: string; lastName: string };
};
type CommentPage = {
  comments: Comment[];
  nextCursor: string | null;
  canComment: boolean;
};

export function SubmissionCommentHistory({ submission }: { submission: any }) {
  const [versionId, setVersionId] = useState(submission.documentVersionId);
  const versions = [
    ...new Map<string, { id: string; versionNumber: number }>([
      ...(submission.attempts || []).flatMap((attempt: any) =>
        attempt.documentVersion
          ? [
              [attempt.documentVersion.id, attempt.documentVersion] as [
                string,
                { id: string; versionNumber: number },
              ],
            ]
          : [],
      ),
      ...(submission.documentVersion
        ? [
            [submission.documentVersion.id, submission.documentVersion] as [
              string,
              { id: string; versionNumber: number },
            ],
          ]
        : []),
    ]).values(),
  ].sort((a, b) => b.versionNumber - a.versionNumber);
  return (
    <>
      {versions.length > 1 && (
        <label className="mb-4 block text-sm font-semibold text-[var(--color-text-primary)]">
          Comments for submitted version
          <select
            value={versionId}
            onChange={(event) => setVersionId(event.target.value)}
            className="ml-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
          >
            {versions.map((version) => (
              <option key={version.id} value={version.id}>
                Version {version.versionNumber}
                {version.id === submission.documentVersionId
                  ? " (current)"
                  : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      <SubmissionComments
        key={versionId}
        submissionId={submission.id}
        versionId={versionId}
        versionNumber={
          versions.find((version) => version.id === versionId)?.versionNumber
        }
      />
    </>
  );
}

export function SubmissionComments({
  submissionId,
  versionId,
  versionNumber,
}: {
  submissionId: string;
  versionId: string;
  versionNumber?: number;
}) {
  const client = useQueryClient();
  const [body, setBody] = useState("");
  const [pageNumber, setPageNumber] = useState("");
  const [notice, setNotice] = useState("");
  const discussion = useSubmissionHighlights();
  const draft = discussion?.versionId === versionId ? discussion.draft : null;
  const composer = useRef<HTMLTextAreaElement>(null);
  const commentNodes = useRef(new Map<string, HTMLLIElement>());
  const queryKey = ["submission-comments", submissionId, versionId];
  const endpoint = `/api/workflows/tasks/submissions/${submissionId}/comments`;
  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      apiClient.get<CommentPage>(endpoint, {
        params: {
          documentVersionId: versionId,
          ...(pageParam ? { cursor: pageParam } : {}),
        },
      }),
    getNextPageParam: (page) => page.nextCursor || undefined,
    refetchInterval: 15000,
  });
  const mutation = useMutation({
    mutationFn: () =>
      apiClient.post(endpoint, {
        documentVersionId: versionId,
        body: body.trim(),
        ...(pageNumber ? { pageNumber: Number(pageNumber) } : {}),
        ...(draft ? { textAnchor: draft, pageNumber: draft.pageNumber } : {}),
      }),
    onSuccess: () => {
      setBody("");
      setPageNumber("");
      setNotice("Comment posted.");
      discussion?.clearDraft();
      void client.invalidateQueries({ queryKey });
    },
  });
  const comments = [
    ...new Map(
      (query.data?.pages.flatMap((page) => page.comments) || []).map(
        (comment) => [comment.id, comment],
      ),
    ).values(),
  ].reverse();
  const canComment = query.data?.pages[0]?.canComment;
  const setHighlights = discussion?.setHighlights;
  const setCanComment = discussion?.setCanComment;
  useEffect(() => {
    setHighlights?.(
      (query.data?.pages.flatMap((page) => page.comments) || [])
        .filter((comment) => comment.textAnchor)
        .map((comment) => ({
          id: comment.id,
          textAnchor: comment.textAnchor!,
        })),
    );
  }, [query.data, setHighlights]);
  useEffect(() => {
    setCanComment?.(
      Boolean(canComment && !query.isError && !mutation.isPending),
    );
  }, [canComment, query.isError, mutation.isPending, setCanComment]);
  useEffect(() => {
    if (!draft) return;
    setPageNumber(String(draft.pageNumber));
    composer.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    composer.current?.focus({ preventScroll: true });
  }, [draft]);
  const focused = discussion?.focused;
  useEffect(() => {
    if (focused)
      commentNodes.current
        .get(focused.id)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focused]);
  return (
    <section aria-label="Submission comments" className="space-y-4">
      <div>
        <h3 className="flex items-center gap-2 text-base font-bold text-[var(--color-text-primary)]">
          <MessageSquare className="h-4 w-4" />
          Comments
        </h3>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Shared with this research group and its checkers
          {versionNumber ? ` · Version ${versionNumber}` : ""}.
        </p>
      </div>
      {query.isLoading && (
        <p role="status" className="text-sm">
          Loading comments…
        </p>
      )}
      {query.isError && (
        <div role="alert" className="text-sm text-rose-600">
          <p>{query.error.message}</p>
          <button
            type="button"
            className="mt-2 font-semibold underline"
            onClick={() => void query.refetch()}
          >
            Retry comments
          </button>
        </div>
      )}
      {query.hasNextPage && (
        <button
          type="button"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
          className="text-sm font-bold text-[var(--color-primary)]"
        >
          {query.isFetchingNextPage ? "Loading…" : "Load earlier comments"}
        </button>
      )}
      {comments.length > 0 ? (
        <ol className="space-y-3">
          {comments.map((comment) => (
            <li
              key={comment.id}
              ref={(node) => {
                if (node) commentNodes.current.set(comment.id, node);
                else commentNodes.current.delete(comment.id);
              }}
              data-comment-id={comment.id}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3"
            >
              <p className="text-sm font-bold text-[var(--color-text-primary)]">
                {comment.author.firstName} {comment.author.lastName}
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                <time dateTime={comment.createdAt}>
                  {formatReviewDateTime(comment.createdAt)}
                </time>
                {comment.pageNumber ? ` · Page ${comment.pageNumber}` : ""}
              </p>
              {comment.textAnchor && (
                <blockquote className="mt-2 border-l-3 border-amber-400 bg-amber-50 p-2 text-sm text-slate-800">
                  {discussion ? (
                    <button
                      type="button"
                      onClick={() =>
                        discussion.focusHighlight({
                          id: comment.id,
                          textAnchor: comment.textAnchor!,
                        })
                      }
                      className="w-full text-left"
                      title="Go to highlighted passage"
                    >
                      <span className="block text-xs font-bold">
                        Highlighted text · Page {comment.textAnchor.pageNumber}
                      </span>
                      <span className="mt-1 block whitespace-pre-wrap break-words">
                        “{comment.textAnchor.selectedText}”
                      </span>
                    </button>
                  ) : (
                    <>
                      <span className="block text-xs font-bold">
                        Highlighted text · Page {comment.textAnchor.pageNumber}
                      </span>
                      “{comment.textAnchor.selectedText}”
                    </>
                  )}
                </blockquote>
              )}
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--color-text-primary)]">
                {comment.body}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        query.isSuccess && (
          <p className="rounded-xl bg-[var(--color-surface-subtle)] p-3 text-sm text-[var(--color-text-secondary)]">
            No comments on this version yet.
          </p>
        )
      )}
      {canComment && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (body.trim() && !mutation.isPending) {
              setNotice("");
              mutation.mutate();
            }
          }}
          className="space-y-2"
        >
          {draft && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-slate-800">
              <p className="font-bold">
                Commenting on highlighted text · Page {draft.pageNumber}
              </p>
              <blockquote className="mt-1 whitespace-pre-wrap break-words">
                “{draft.selectedText}”
              </blockquote>
              <button
                type="button"
                disabled={mutation.isPending}
                onClick={() => discussion?.clearDraft()}
                className="mt-2 text-xs font-bold underline"
              >
                Remove text selection
              </button>
            </div>
          )}
          <label className="block text-sm font-semibold text-[var(--color-text-primary)]">
            Add a comment
            <textarea
              ref={composer}
              required
              maxLength={2000}
              rows={3}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              disabled={mutation.isPending}
              placeholder="Write feedback or a reply…"
              className="mt-2 w-full resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 font-normal outline-none focus:ring-2 focus:ring-[var(--college-focus-ring)]"
            />
          </label>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <label className="text-xs text-[var(--color-text-secondary)]">
              Page (optional)
              <input
                type="number"
                min={1}
                max={100000}
                step={1}
                value={pageNumber}
                onChange={(event) => setPageNumber(event.target.value)}
                disabled={mutation.isPending || Boolean(draft)}
                className="mt-1 block h-9 w-24 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text-primary)]"
              />
            </label>
            <button
              type="submit"
              disabled={!body.trim() || mutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-[var(--college-on-primary)] disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {mutation.isPending ? "Posting…" : "Post comment"}
            </button>
          </div>
          {mutation.isError && (
            <p role="alert" className="text-sm text-rose-600">
              {mutation.error.message}
            </p>
          )}
        </form>
      )}
      <p role="status" className="text-sm text-[var(--color-text-secondary)]">
        {notice}
      </p>
    </section>
  );
}
