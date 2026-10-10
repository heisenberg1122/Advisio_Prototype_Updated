"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  ChevronDown,
  Menu,
  Search,
  LogOut,
  Settings,
  User,
  Moon,
  Sun,
  X,
  ArrowRight,
  Sparkles,
  Check,
  Calendar,
  FileText,
  Users,
  LayoutDashboard,
  MessageSquare,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { NotificationPopover } from "@/components/notifications/NotificationPopover";
import { Avatar } from "@/components/ui/Avatar";
import { useProfile } from "@/hooks/use-profile";
import { useAuth } from "@/hooks/use-auth";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { useTheme } from "@/providers/theme-provider";
import { cn } from "@/lib/utils";

export interface AppTopbarProps {
  title?: string;
  hideTitle?: boolean;
  subtitle?: string;
  breadcrumbs?: { label: string; href?: string }[];
  notificationsHref?: string;
  settingsHref?: string;
  onOpenMobileMenu?: () => void;
  actions?: React.ReactNode;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  profileHref?: string;
  variant?: "default" | "workspace";
}

interface SearchItem {
  id: string;
  label: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  action?: () => void;
  category: "Navigation" | "Quick Action";
}

export function AppTopbar({
  breadcrumbs,
  notificationsHref = "/student/notifications",
  settingsHref = "/student/settings",
  onOpenMobileMenu,
  actions,
  searchPlaceholder = "Search anything...",
  onSearch,
  profileHref = "/student/profile",
  variant = "default",
}: AppTopbarProps) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const { profile } = useProfile();
  const { logout } = useAuth();
  const { openMobile } = useSidebarCollapsed();
  const { theme, isDark, toggleTheme } = useTheme();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const displayName = profile?.name || "Academic User";
  const initials = profile?.initials || displayName.slice(0, 2).toUpperCase() || "UA";
  const userEmail = profile?.email || "user@university.edu.ph";
  const roleName = profile?.role ? profile.role.replace(/_/g, " ") : "Institutional User";
  const isWorkspace = variant === "workspace";

  // Close popovers on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsProfileOpen(false);
        setIsSearchOpen(false);
      }
      // ⌘K or Ctrl+K shortcut to focus search
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setIsSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Determine role prefix from pathname
  const rolePrefix = pathname.startsWith("/adviser")
    ? "/adviser"
    : pathname.startsWith("/admin")
    ? "/admin"
    : pathname.startsWith("/professor")
    ? "/professor"
    : pathname.startsWith("/panelist")
    ? "/panelist"
    : "/student";

  // Predefined searchable items
  const allSearchItems: SearchItem[] = [
    {
      id: "dashboard",
      label: "Overview Dashboard",
      subtitle: "Main academic workspace and stream",
      icon: LayoutDashboard,
      href: `${rolePrefix}/dashboard`,
      category: "Navigation",
    },
    {
      id: "advisees",
      label: "My Advisees / Groups",
      subtitle: "Assigned research teams and cohorts",
      icon: Users,
      href: `${rolePrefix}/dashboard?tab=advisees`,
      category: "Navigation",
    },
    {
      id: "documents",
      label: "Document Workspace",
      subtitle: "Live Google Docs deliverables and university submissions",
      icon: FileText,
      href: "/student/documents",
      category: "Navigation",
    },
    {
      id: "reviews",
      label: "Document Reviews",
      subtitle: "Pending manuscripts and draft reviews",
      icon: FileText,
      href: `${rolePrefix}/dashboard?tab=reviews`,
      category: "Navigation",
    },
    {
      id: "consultations",
      label: "Consultations & Meetings",
      subtitle: "Google Meet sessions and appointment schedule",
      icon: Calendar,
      href: `${rolePrefix}/dashboard?tab=consultations`,
      category: "Navigation",
    },
    {
      id: "messages",
      label: "Group Messages & Chats",
      subtitle: "Direct communication with research teams",
      icon: MessageSquare,
      href: `${rolePrefix}/dashboard?tab=group-chats`,
      category: "Navigation",
    },
    {
      id: "milestones",
      label: "Institutional Milestones",
      subtitle: "Workflow progress and deadlines",
      icon: Clock,
      href: `${rolePrefix}/dashboard?tab=milestones`,
      category: "Navigation",
    },
    {
      id: "profile",
      label: "User Profile",
      subtitle: "View and edit personal academic profile",
      icon: User,
      href: profileHref,
      category: "Navigation",
    },
    {
      id: "settings",
      label: "Account Settings",
      subtitle: "Preferences, appearance, and security",
      icon: Settings,
      href: settingsHref,
      category: "Navigation",
    },
    {
      id: "theme-toggle",
      label: isDark ? "Switch to Light Mode" : "Switch to Dark Mode",
      subtitle: `Currently using ${theme} mode`,
      icon: isDark ? Sun : Moon,
      action: () => toggleTheme(),
      category: "Quick Action",
    },
  ];

  // Filter items based on query
  const filteredSearchItems = searchQuery.trim()
    ? allSearchItems.filter(
        (item) =>
          item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.subtitle && item.subtitle.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : allSearchItems;

  const handleSelectSearchItem = (item: SearchItem) => {
    setIsSearchOpen(false);
    setSearchQuery("");
    if (item.action) {
      item.action();
    } else if (item.href) {
      router.push(item.href);
    }
  };

  return (
    <header className={cn(
      "sticky top-0 z-30 flex shrink-0 items-center justify-between px-4 transition-colors sm:px-6 lg:px-6",
      isWorkspace
        ? "h-[72px] border-0 bg-[#F4F6F8] shadow-none dark:bg-[#080E18]"
        : "h-16 border-b border-[#E2E8F0] bg-white shadow-xs dark:border-white/10 dark:bg-[#0D1525] lg:px-8"
    )}>
      {/* Left: Mobile Toggle & Page Title / Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileMenu ?? openMobile}
          className="rounded-xl p-2 text-slate-500 outline-none hover:bg-slate-100 hover:text-slate-900 focus:outline-none dark:text-slate-300 dark:hover:bg-white/10 lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0">
          {breadcrumbs && breadcrumbs.length > 0 ? (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-0.5">
              {breadcrumbs.map((bc, idx) => (
                <React.Fragment key={bc.label}>
                  {idx > 0 && <span className="text-slate-300 dark:text-slate-600">/</span>}
                  {bc.href ? (
                    <Link href={bc.href} className="hover:text-[#0B3A53] dark:hover:text-[#C9A227] hover:underline truncate">
                      {bc.label}
                    </Link>
                  ) : (
                    <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                      {bc.label}
                    </span>
                  )}
                </React.Fragment>
              ))}
            </div>
          ) : null}

        </div>
      </div>

      {/* Right: Notifications, Actions, User Menu */}
      <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
        {/* Centered Interactive Search Bar */}
        <div ref={searchRef} className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
          <label className={cn(
            "flex h-10 items-center gap-2.5 rounded-xl px-3.5 text-slate-400 transition-all focus-within:border-[#0B3A53] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0B3A53]/10 cursor-text dark:focus-within:bg-[#101b2b]",
            isWorkspace
              ? "w-[240px] border-0 bg-white shadow-xs dark:bg-white/10 lg:w-[320px]"
              : "w-[220px] border border-slate-200 bg-slate-50/70 dark:border-white/10 dark:bg-white/5 lg:w-[280px]"
          )}>
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onFocus={() => setIsSearchOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
                onSearch?.(e.target.value);
              }}
              className="w-full bg-transparent text-xs text-[#17212B] dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none outline-none"
              aria-label="Search navigation and topics"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="hidden items-center rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-semibold text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-500 lg:inline-flex">
                ⌘K
              </kbd>
            )}
          </label>

          {/* Search Dropdown / Live Results */}
          {isSearchOpen && (
            <div className="absolute right-0 top-11 z-50 w-[320px] lg:w-[380px] rounded-2xl border border-[#E2E8F0] dark:border-white/15 bg-white dark:bg-[#111A2E] p-2 shadow-xl animate-fade-in-up">
              <div className="mb-1 flex items-center justify-between border-b border-slate-100 px-3 py-1.5 pb-2 text-xs font-bold uppercase tracking-wider text-slate-400 dark:border-white/5 dark:text-slate-500">
                <span>{searchQuery ? "Search Results" : "Quick Navigation"}</span>
                <span>{filteredSearchItems.length} items</span>
              </div>

              <div className="max-h-[300px] overflow-y-auto space-y-1">
                {filteredSearchItems.length > 0 ? (
                  filteredSearchItems.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelectSearchItem(item)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group outline-none"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0B3A53]/10 dark:bg-white/10 text-[#0B3A53] dark:text-[#C9A227] group-hover:scale-105 transition-transform">
                          <ItemIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-[#17212B] dark:text-white truncate">
                            {item.label}
                          </p>
                          {item.subtitle && (
                            <p className="truncate text-xs text-slate-400 dark:text-slate-500">
                              {item.subtitle}
                            </p>
                          )}
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 group-hover:text-[#0B3A53] dark:group-hover:text-white transition-all shrink-0" />
                      </button>
                    );
                  })
                ) : (
                  <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                    No results found for “{searchQuery}”
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {actions && <div className="flex items-center gap-2">{actions}</div>}

        <NotificationPopover viewAllHref={notificationsHref} compact />

        {/* User Profile Dropdown Menu */}
        <div ref={profileRef} className="relative">
          <button
            type="button"
            onClick={() => setIsProfileOpen((prev) => !prev)}
            aria-expanded={isProfileOpen}
            aria-haspopup="true"
            className="flex items-center gap-2 rounded-full p-1 sm:pr-2.5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 select-none cursor-pointer"
          >
            <Avatar initials={initials} name={displayName} src={profile?.photoUrl} size="sm" className="h-8 w-8 border-white/20 bg-[#0B3A53] text-xs font-black text-white shadow-xs" />
            <span className="hidden sm:block text-left">
              <span className="block text-xs font-bold text-[#17212B] dark:text-white truncate max-w-[120px]">
                {displayName}
              </span>
              {isWorkspace && (
                <span className="block max-w-[120px] truncate text-xs capitalize text-slate-500 dark:text-slate-400">
                  {roleName.toLowerCase()}
                </span>
              )}
            </span>
            <ChevronDown
              className={cn(
                "hidden sm:block h-3.5 w-3.5 text-slate-400 transition-transform duration-200",
                isProfileOpen && "rotate-180 text-[#0B3A53] dark:text-white"
              )}
            />
          </button>

          {/* Profile Dropdown Panel */}
          {isProfileOpen && (
            <div className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-[#E2E8F0] dark:border-white/15 bg-white dark:bg-[#111A2E] p-4 shadow-xl animate-fade-in-up">
              {/* User Identity Header */}
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-white/10">
                <Avatar initials={initials} name={displayName} src={profile?.photoUrl} size="lg" className="h-12 w-12 border-2 border-[#C9A227] bg-[#0B3A53] text-sm font-black text-[#FDF8E8] shadow-sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#17212B] dark:text-white">
                    {displayName}
                  </p>
                  <p className="truncate text-xs text-slate-400 dark:text-slate-400">
                    {userEmail}
                  </p>
                  <span className="mt-1 inline-flex items-center rounded-full border border-[#C9A227]/30 bg-[#C9A227]/15 px-2 py-0.5 text-xs font-extrabold uppercase tracking-wide text-[#8A6A0B] dark:text-[#C9A227]">
                    {roleName}
                  </span>
                </div>
              </div>

              {/* Theme Toggle & Links */}
              <div className="py-2 space-y-1">
                {/* Theme Switcher Button */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors outline-none cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    {isDark ? (
                      <Moon className="h-4 w-4 text-[#38bdf8]" />
                    ) : (
                      <Sun className="h-4 w-4 text-[#C9A227]" />
                    )}
                    <span>Dark Mode</span>
                  </span>
                  <div
                    className={cn(
                      "w-9 h-5 rounded-full p-0.5 transition-colors relative",
                      isDark ? "bg-[#38bdf8]" : "bg-slate-300"
                    )}
                  >
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full bg-white shadow-xs transition-transform duration-200",
                        isDark && "translate-x-4"
                      )}
                    />
                  </div>
                </button>

                {/* Profile Link */}
                <Link
                  href={profileHref}
                  onClick={() => setIsProfileOpen(false)}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-[#0B3A53] dark:hover:text-white transition-colors outline-none"
                >
                  <User className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <span>My Profile</span>
                </Link>

                {/* Settings Link */}
                <Link
                  href={settingsHref}
                  onClick={() => setIsProfileOpen(false)}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-[#0B3A53] dark:hover:text-white transition-colors outline-none"
                >
                  <Settings className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <span>Account Settings</span>
                </Link>
              </div>

              {/* Institutional Branding Badge */}
              <div className="flex items-center justify-between border-t border-slate-100 px-2 pb-2 pt-2 text-xs text-slate-400 dark:border-white/10 dark:text-slate-500">
                <span>University of the Assumption</span>
                <span className="font-bold text-[#0B3A53] dark:text-[#C9A227]">UA ADVISIO</span>
              </div>

              {/* Sign Out Button */}
              <div className="pt-1 border-t border-slate-100 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors outline-none cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
