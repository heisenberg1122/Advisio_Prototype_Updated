import React, { forwardRef } from 'react';
import {
  Link as RouterLink,
  useNavigate,
  useLocation,
  useSearchParams as useRouterSearchParams,
  useParams as useRouterParams,
} from 'react-router-dom';

// ─── next/link compatibility component ──────────────────────────────
export interface NextLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string | { pathname?: string; query?: Record<string, string | number | boolean> };
  children?: React.ReactNode;
  replace?: boolean;
  scroll?: boolean;
  className?: string;
  passHref?: boolean;
  as?: string;
}

export const Link = forwardRef<HTMLAnchorElement, NextLinkProps>(function Link(
  { href, children, replace, className, passHref, as, ...props },
  ref
) {
  let to = '';
  if (typeof href === 'string') {
    to = href;
  } else if (href && typeof href === 'object') {
    const pathname = href.pathname || '';
    const searchParams = href.query
      ? '?' + new URLSearchParams(href.query as Record<string, string>).toString()
      : '';
    to = `${pathname}${searchParams}`;
  }

  return (
    <RouterLink
      ref={ref}
      to={to}
      replace={replace}
      className={className}
      {...(props as any)}
    >
      {children}
    </RouterLink>
  );
});

export default Link;

// ─── next/navigation compatibility hooks ────────────────────────────
export function usePathname(): string {
  const location = useLocation();
  return location.pathname;
}

export function useSearchParams(): URLSearchParams {
  const location = useLocation();
  return new URLSearchParams(location.search);
}

export function useRouter() {
  const navigate = useNavigate();
  return {
    push: (url: string) => navigate(url),
    replace: (url: string) => navigate(url, { replace: true }),
    back: () => navigate(-1),
    forward: () => navigate(1),
    refresh: () => window.location.reload(),
    prefetch: () => {},
  };
}

export function useParams<T extends Record<string, string | string[]> = Record<string, string>>(): T {
  return useRouterParams() as unknown as T;
}

export function redirect(url: string) {
  window.location.href = url;
}

export function notFound() {
  console.warn('Page not found');
}
