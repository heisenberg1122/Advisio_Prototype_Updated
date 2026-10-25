import React, { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

export function PublicLinks() {
  return (
    <nav aria-label="Public information" className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
      <Link to="/" className="hover:underline">Home</Link>
      <Link to="/privacy-policy" className="hover:underline">Privacy policy</Link>
      <Link to="/terms-of-service" className="hover:underline">Terms of service</Link>
    </nav>
  );
}

export default function PublicLayout({ title, children }: { title: string; children: React.ReactNode }) {
  const { pathname } = useLocation();
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} | Advisio`;
    window.scrollTo(0, 0);
    return () => { document.title = previousTitle; };
  }, [title, pathname]);

  return (
    <div className="min-h-screen bg-[#f4f7fb] font-sans text-slate-900">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:block focus:p-4">Skip to content</a>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <Link to="/" aria-label="Advisio home" className="flex items-center gap-3">
            <img src="/ao-logo.png" alt="" className="h-11 w-11 object-contain" />
            <span className="text-lg font-extrabold tracking-widest text-[#0b3553]">ADVISIO<span className="block text-xs font-semibold tracking-normal text-slate-500">Research, advising & management</span></span>
          </Link>
          <Link to="/login" className="rounded-xl bg-[#0b3553] px-5 py-3 text-sm font-bold text-white hover:bg-[#164866]">Sign in to Advisio</Link>
        </div>
      </header>
      <main id="main-content">{children}</main>
      <footer className="border-t border-slate-200 bg-white px-6 py-8 text-slate-600">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 sm:flex-row">
          <p className="text-sm">© {new Date().getFullYear()} Advisio</p>
          <PublicLinks />
          <a href="mailto:advisio.main@gmail.com" className="text-sm hover:underline">Contact support</a>
        </div>
      </footer>
    </div>
  );
}

export function PolicySection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-8 border-t border-slate-200 py-7 first:border-0">
      <h2 id={`${id}-heading`} className="mb-3 text-xl font-bold text-[#0b3553]">{title}</h2>
      <div className="space-y-4 leading-7 text-slate-600 [&_a]:text-[#164866] [&_a]:underline">{children}</div>
    </section>
  );
}
