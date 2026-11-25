import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, CircleHelp } from "lucide-react";
import { useParams } from "react-router-dom";
import { ApiError, apiClient } from "@/lib/api-client";

const awardDate = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "long",
  timeZone: "Asia/Manila",
});

type VerifiedCertificate = {
  recipientName: string;
  collegeName: string;
  awardedAt: string;
};

export default function CertificateVerificationPage() {
  const { code = "" } = useParams();
  const certificate = useQuery({
    queryKey: ["public-certificate-verification", code],
    queryFn: ({ signal }) => apiClient.get<VerifiedCertificate>(
      `/api/certificates/verify/${encodeURIComponent(code)}`,
      { signal },
    ),
    retry: false,
  });
  const notFound = certificate.error instanceof ApiError && certificate.error.statusCode === 404;

  return (
    <main className="grid min-h-dvh place-items-center bg-[#f2f6f9] px-5 py-10 text-[#243047]">
      <title>Final Defense Certificate Verification | Advisio</title>
      <meta name="robots" content="noindex, nofollow" />
      <section className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#d5e3ee] bg-white shadow-sm">
        <div className="h-2 bg-[#a9c6dd]" />
        <div className="p-6 sm:p-9">
          <div className="flex items-center gap-3">
            <img src="/school-logo.png" alt="" className="h-12 w-12 object-contain" />
            <div>
              <p className="font-bold text-[#0b3a53]">University of the Assumption</p>
              <p className="text-sm text-[#58647a]">Final Defense certificate verification</p>
            </div>
          </div>
          {certificate.isPending ? (
            <p className="mt-8" role="status">Checking certificate…</p>
          ) : certificate.data ? (
            <>
              <div className="mt-8 flex items-center gap-2 text-[#246749]">
                <BadgeCheck size={23} aria-hidden />
                <h1 className="text-xl font-bold">Certificate verified</h1>
              </div>
              <dl className="mt-5 grid gap-4 rounded-xl border border-[#d5e3ee] bg-[#f8fafc] p-4 sm:p-5">
                <div>
                  <dt className="text-sm font-medium text-[#58647a]">Awarded to</dt>
                  <dd className="mt-0.5 break-words text-xl font-bold text-[#0b3a53]">{certificate.data.recipientName}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-[#58647a]">College</dt>
                  <dd className="mt-0.5 break-words">{certificate.data.collegeName}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-[#58647a]">Award date</dt>
                  <dd className="mt-0.5">{awardDate.format(new Date(certificate.data.awardedAt))}</dd>
                </div>
              </dl>
              <p className="mt-4 text-sm text-[#58647a]">Compare these details with the certificate presented to you.</p>
            </>
          ) : (
            <div className="mt-8" role="alert">
              <h1 className="flex items-center gap-2 text-xl font-bold">
                <CircleHelp size={22} aria-hidden />
                {notFound ? "Certificate not found" : "Verification unavailable"}
              </h1>
              <p className="mt-2 text-[#58647a]">
                {notFound ? "No issued certificate matches this code." : "Try opening the verification link again in a moment."}
              </p>
            </div>
          )}
          <div className="mt-7 flex items-center gap-2 border-t border-[#d5e3ee] pt-4 text-sm font-semibold text-[#58647a]">
            <img src="/advisio-logo.png" alt="" className="h-5 w-6 object-contain" />
            Advisio
          </div>
        </div>
      </section>
    </main>
  );
}
