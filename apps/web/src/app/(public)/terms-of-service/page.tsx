import React from "react";
import { Link } from "react-router-dom";
import PublicLayout, { PolicySection } from "@/components/public/PublicLayout";

export default function TermsOfServicePage() {
  return (
    <PublicLayout title="Terms of service">
      <article className="mx-auto max-w-3xl px-6 py-14 sm:py-20">
        <p className="text-sm font-bold uppercase tracking-widest text-[#9a6100]">Public information</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#0b3553]">Terms of service</h1>
        <p className="mb-8 mt-4 text-sm text-slate-500">Effective date: October 26, 2026</p>
        <PolicySection id="acceptance" title="1. Using Advisio">
          <p>These terms govern your use of Advisio, a platform for academic research projects, advising, document submissions, reviews, consultations, and defense coordination. By using Advisio, you agree to these terms and the applicable rules of your institution. If you do not agree, do not use the service.</p>
          <p>Questions about these terms can be sent to <a href="mailto:advisio.main@gmail.com">advisio.main@gmail.com</a>.</p>
        </PolicySection>
        <PolicySection id="accounts" title="2. Eligibility and account responsibilities">
          <p>You must be authorized to participate in your institution’s research activities and provide accurate account information. Account requests, registration, and Google sign-in remain subject to configured eligibility, approval, and role requirements.</p>
          <p>Keep your credentials private, use only your own account, and promptly report suspected unauthorized access. You are responsible for activity you authorize through your account. Do not impersonate another person, share credentials, or attempt to obtain roles or records you are not entitled to access.</p>
        </PolicySection>
        <PolicySection id="conduct" title="3. Acceptable use and academic integrity">
          <p>Use Advisio for legitimate academic and administrative purposes. Do not upload unlawful material, malware, or content that infringes someone else’s rights; harass others; falsify submissions, evaluations, approvals, or signatures; bypass access controls; or disrupt the service.</p>
          <p>Follow your institution’s requirements for academic honesty, research ethics, confidentiality, informed consent, and handling personal or sensitive research data. Upload only information you are authorized to share with the intended academic participants.</p>
        </PolicySection>
        <PolicySection id="content" title="4. Your content and academic decisions">
          <p>You retain the rights you hold in your research and other submitted content, subject to your institution’s policies and any separate agreements. You grant Advisio permission to host, store, reproduce, transmit, and display that content only as needed to provide, secure, and maintain the service and its authorized workflows.</p>
          <p>You are responsible for your content’s accuracy and necessary permissions. Academic approvals, grades, research ownership, authorship, and institutional decisions remain the responsibility of the relevant institution and authorized people. Advisio records and supports those processes; use of the platform does not guarantee any academic outcome.</p>
        </PolicySection>
        <PolicySection id="integrations" title="5. Google and other connected services">
          <p>Google sign-in, Google Drive storage, Calendar scheduling, and other integrations are available only when configured and authorized. Their providers’ terms also apply. You must have authority to connect an account and grant the requested permissions.</p>
          <p>Revoking permissions or disconnecting an integration may prevent related features from working. Disconnecting does not automatically delete files or academic records already created. Our <Link to="/privacy-policy">privacy policy</Link> explains how Google data and other personal information are handled, and how to request deletion.</p>
        </PolicySection>
        <PolicySection id="availability" title="6. Availability and service changes">
          <p>We aim to keep Advisio useful and available, but maintenance, software changes, outages, and third-party failures may interrupt access. Features may change over time. Keep copies of important work where your institution’s rules permit, and contact your coordinator if an interruption affects a deadline.</p>
          <p>To the extent permitted by applicable law, the service is provided on an “as available” basis without a guarantee of uninterrupted or error-free operation or suitability for a particular purpose. Nothing in these terms excludes rights or liabilities that cannot lawfully be excluded.</p>
        </PolicySection>
        <PolicySection id="suspension" title="7. Suspension and ending access">
          <p>Access may be restricted or suspended to protect security, respond to misuse, comply with legal obligations, or enforce institutional authorization. Account access may end when your academic role or institutional eligibility ends.</p>
          <p>You may stop using Advisio at any time. For account closure or data requests, contact <a href="mailto:advisio.main@gmail.com">advisio.main@gmail.com</a>. Academic and audit records may remain subject to institutional and legal retention requirements described in the privacy policy.</p>
        </PolicySection>
        <PolicySection id="changes" title="8. Changes and questions">
          <p>Revised terms will be posted here with an updated effective date. Continued use after changes take effect constitutes acceptance to the extent allowed by applicable law. For service concerns or questions about these terms, email <a href="mailto:advisio.main@gmail.com">advisio.main@gmail.com</a>. Academic disputes should also be raised through your institution’s established process.</p>
        </PolicySection>
      </article>
    </PublicLayout>
  );
}
