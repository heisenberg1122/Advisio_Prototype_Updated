import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SubmissionTextAnchor } from "@/lib/submission-highlight";

export type SavedSubmissionHighlight = {
  id: string;
  textAnchor: SubmissionTextAnchor;
};
type HighlightContext = {
  versionId: string;
  canComment: boolean;
  setCanComment: (allowed: boolean) => void;
  draft: SubmissionTextAnchor | null;
  compose: (anchor: SubmissionTextAnchor) => void;
  clearDraft: () => void;
  highlights: SavedSubmissionHighlight[];
  setHighlights: (items: SavedSubmissionHighlight[]) => void;
  focused: (SavedSubmissionHighlight & { nonce: number }) | null;
  focusHighlight: (highlight: SavedSubmissionHighlight) => void;
};
const Context = createContext<HighlightContext | null>(null);

// Mount with a version key so draft anchors and highlights cannot bleed into a
// different submitted version while moving through revision history.
export function SubmissionHighlightProvider({
  versionId,
  onCompose,
  children,
}: {
  versionId: string;
  onCompose?: () => void;
  children: ReactNode;
}) {
  const [draft, setDraft] = useState<SubmissionTextAnchor | null>(null);
  const [highlights, setHighlights] = useState<SavedSubmissionHighlight[]>([]);
  const [focused, setFocused] = useState<HighlightContext["focused"]>(null);
  const [canComment, setCanComment] = useState(false);
  const value = useMemo(
    () => ({
      versionId,
      draft,
      highlights,
      focused,
      canComment,
      setCanComment,
      setHighlights,
      compose: (anchor: SubmissionTextAnchor) => {
        if (canComment) {
          setDraft(anchor);
          onCompose?.();
        }
      },
      clearDraft: () => setDraft(null),
      focusHighlight: (highlight: SavedSubmissionHighlight) =>
        setFocused((previous) => ({
          ...highlight,
          nonce: (previous?.nonce || 0) + 1,
        })),
    }),
    [versionId, draft, highlights, focused, canComment, onCompose],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useSubmissionHighlights = () => useContext(Context);
