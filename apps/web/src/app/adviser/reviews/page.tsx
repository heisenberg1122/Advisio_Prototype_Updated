import { ManuscriptReviewWorkspace } from "@/components/documents/ManuscriptReviewWorkspace";
import "./adviser-reviews.css";

export default function ReviewsPage() {
  return (
    <div className="adviser-reviews adviser-reviews--workspace">
      <ManuscriptReviewWorkspace presentation="adviser" />
    </div>
  );
}
