import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { evaluationRequest, type EvaluationSession } from "./evaluation-client";

// Compatibility for previously printed links; there is no separate guide step.
export default function EvaluationGuide() {
  const location = useLocation();
  const [home, setHome] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    evaluationRequest<EvaluationSession>("session")
      .then((session) => {
        if (!current) return;
        localStorage.setItem("advisio_token", "__evaluation__");
        setHome(session.home);
      })
      .catch(() => {
        if (current) setHome("/evaluate" + location.search);
      });
    return () => {
      current = false;
    };
  }, [location.search]);
  return home ? (
    <Navigate to={home} replace />
  ) : (
    <main className="evaluation-page">
      <p role="status">Opening your evaluation workspace…</p>
    </main>
  );
}
