import { Navigate, useLocation } from "react-router-dom";

export default function ConsultationsPage() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  params.set("tab", "consultations");
  return <Navigate replace to={`/student/dashboard?${params}`} />;
}
