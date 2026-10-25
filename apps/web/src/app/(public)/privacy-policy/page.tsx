import React from "react";
import { Link } from "react-router-dom";
import PublicLayout, { PolicySection } from "@/components/public/PublicLayout";

export default function PrivacyPolicyPage() {
  return (
    <PublicLayout title="Privacy policy">
      <article className="mx-auto max-w-3xl px-6 py-14 sm:py-20">
        <p className="text-sm font-bold uppercase tracking-widest text-[#9a6100]">Public information</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#0b3553]">Privacy policy</h1>
        <p className="mb-8 mt-4 text-sm text-slate-500">Effective date: October 26, 2026</p>
        <PolicySection id="overview" title="1. About this policy">
          <p>This policy explains how Advisio handles personal information when you use its research, advising, document review, and academic management services. It covers this website and connected Google services. Your institution determines access to its academic records and may apply additional institutional privacy and retention rules.</p>
          <p>For privacy questions or requests, contact <a href="mailto:advisio.main@gmail.com">advisio.main@gmail.com</a>. Requests concerning institutional academic records may also need to be coordinated with your institution’s research coordinator or authorized administrator.</p>
        </PolicySection>
        <PolicySection id="information" title="2. Information we handle">
          <p>Account and academic information may include your name, email address, university or student identifier, college, program, assigned roles, and profile details. We also handle content you submit, including research projects, manuscripts, attachments, messages, consultations, reviews, evaluations, signatures, and scheduling information.</p>
          <p>Technical and security information may include request and error logs, IP addresses, account activity, and audit records. The website uses browser storage for your session token and preferences, such as your theme and selected workspace.</p>
        </PolicySection>
        <PolicySection id="google" title="3. Google user data and permissions">
          <p><strong>Google sign-in:</strong> when you choose Google sign-in, Advisio verifies a Google-issued identity token and uses your Google account identifier, verified email address, and available name information to authenticate you, associate an account, or create an account where registration is enabled. Google sign-in does not itself authorize access to your Drive files or Calendar.</p>
          <p><strong>Google Drive:</strong> an authorized administrator may separately connect a storage account. The OAuth integration requests the <code>drive.file</code> permission to work with files created by Advisio or explicitly made available to the app. Advisio uses this connection to store, organize, retrieve, and manage research documents and related files. It stores the connected account’s email, display name, profile photo URL when available, folder identifiers, file metadata, connection status, and an encrypted refresh token so authorized storage operations can continue.</p>
          <p><strong>Google Calendar:</strong> where configured, the scheduling integration uses Calendar and event permissions to create and manage consultation or meeting events, including titles, dates, times, participant email addresses, and conferencing details. Calendar authorization is separate from Google sign-in and Drive storage.</p>
          <p>Google user data is used only to provide and maintain the features described here. We do not sell Google user data, use it for advertising, or use it to train generalized artificial intelligence or machine learning models. Advisio’s use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>, including its Limited Use requirements.</p>
        </PolicySection>
        <PolicySection id="purposes" title="4. How information is used and shared">
          <p>Information is used to authenticate accounts, enforce permissions, coordinate research workflows, store documents, provide feedback and evaluations, send service communications, troubleshoot problems, and maintain security and auditability.</p>
          <p>Academic content is available to users whose assigned roles and project or institutional relationships permit access, such as research teammates, advisers, reviewers, and administrators. Service providers supporting hosting, databases, document storage, email, and scheduling process information needed for those functions. Google receives information needed for integrations you or your institution enable.</p>
          <p>Access to Google user data by people is limited to situations permitted by Google’s Limited Use requirements, such as your explicit consent for specific content, necessary security investigations, or legal obligations. Information may be disclosed where required by law or necessary to address fraud, abuse, or security incidents. Service providers may process data outside your country.</p>
        </PolicySection>
        <PolicySection id="security-retention" title="5. Security and retention">
          <p>Advisio uses authentication, role-based access controls, and audit logging to restrict access. OAuth refresh tokens for the connected Drive storage account are stored encrypted. No online service can guarantee absolute security.</p>
          <p>Account and research records are retained while needed to provide the service and meet institutional academic, audit, dispute-resolution, and applicable legal requirements. Retention depends on the record and the institution’s requirements; this policy does not promise a fixed deletion period. Backup copies may remain until their normal retention cycle ends.</p>
        </PolicySection>
        <PolicySection id="choices" title="6. Your choices, revocation, and deletion requests">
          <p>You may request access to, correction of, or deletion of your personal information by emailing <a href="mailto:advisio.main@gmail.com">advisio.main@gmail.com</a>. Include your account email and the request, but do not send passwords or access tokens. We may verify your identity and coordinate with your institution before acting. Some academic or audit records may need to be retained; we will explain applicable limits when responding.</p>
          <p>You can revoke Google access through your <a href="https://myaccount.google.com/connections" target="_blank" rel="noopener noreferrer">Google Account connections</a>. An authorized administrator can also disconnect Drive in Advisio’s storage integration settings, which removes the stored refresh token and attempts to revoke it at Google. Disconnecting or revoking access stops future authorized integration access; it does not automatically delete existing files in Drive or academic records in Advisio. Request removal of retained data separately through the contact above.</p>
          <p>You may use email and password sign-in if your account supports it. Clearing browser storage removes local session and preference data from that browser and may sign you out.</p>
        </PolicySection>
        <PolicySection id="updates" title="7. Policy updates and contact">
          <p>Updates will be published on this page with a revised effective date. For questions about this policy, contact <a href="mailto:advisio.main@gmail.com">advisio.main@gmail.com</a>. See also our <Link to="/terms-of-service">terms of service</Link>.</p>
        </PolicySection>
      </article>
    </PublicLayout>
  );
}
