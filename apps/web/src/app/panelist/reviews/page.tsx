import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  defensePacketsTab,
  panelistReviewRoutes,
} from "@research-management/shared/src/panelist-review-routes";
import { ManuscriptReviewWorkspace } from "@/components/documents/ManuscriptReviewWorkspace";
import { DefensePacketReview } from "@/components/panelist/DefensePacketReview";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/utils";

const reviewViews = [
  { href: panelistReviewRoutes.reviews, label: "Assigned Reviews" },
  { href: panelistReviewRoutes.packet, label: "Defense Packets" },
];

export default function PanelistReviewsPage() {
  const [params] = useSearchParams();
  const { search } = useLocation();
  const showPackets = params.get("tab") === defensePacketsTab;
  const activeHref = showPackets ? panelistReviewRoutes.packet : panelistReviewRoutes.reviews;
  const sessionId = params.get("sessionId") || "";
  const review = params.get("review");
  const navigation = (
    <nav
      aria-label="Manuscript review views"
      className="flex flex-wrap gap-2 border-b border-[var(--color-border)]"
    >
      {reviewViews.map(({ href, label }) => (
        <Link
          key={href}
          to={activeHref === href ? { search } : href}
          aria-current={activeHref === href ? "page" : undefined}
          className={cn(
            "border-b-2 px-4 py-2 text-sm font-semibold hover:text-[var(--color-primary)]",
            activeHref === href
              ? "border-[var(--color-primary)] text-[var(--color-primary)]"
              : "border-transparent text-[var(--color-text-secondary)]",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );

  if (showPackets) {
    return (
      <PageContainer>
        <PageHeader
          title="Manuscript Reviews"
          subtitle="Review published manuscripts and shared feedback for your defense sessions."
          category="Research workspace"
        />
        {navigation}
        <DefensePacketReview
          key={JSON.stringify([sessionId, review])}
          sessionId={sessionId}
          initialFilter={review === "pending" || review === "history" ? review : "all"}
        />
      </PageContainer>
    );
  }

  return <ManuscriptReviewWorkspace navigation={navigation} />;
}
