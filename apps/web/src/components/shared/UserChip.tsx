import React from "react";
import { Avatar } from "@/components/ui/Avatar";
import type { StudentProfile } from "@/types/student";
import { useProfile } from "@/hooks/use-profile";
import { useAuth } from "@/hooks/use-auth";

interface UserChipProps {
  profile: StudentProfile;
  collapsed?: boolean;
}

export function UserChip({ profile: initialProfile, collapsed = false }: UserChipProps) {
  const { profile } = useProfile();
  const { user, logout } = useAuth();
  
  const displayName = user ? `${user.firstName} ${user.lastName}` : (profile?.name || initialProfile.name);
  const displayRole = user ? (user.roles[0] || "Researcher") : (profile?.role || initialProfile.role);
  const initials = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : (initialProfile.initials || "AD");

  return (
    <div className={`flex items-center gap-[10px] text-white ${collapsed ? "justify-center" : ""}`}>
      <div title={collapsed ? `${displayName} (Click to Logout)` : undefined} onClick={() => collapsed && logout()} className={collapsed ? "cursor-pointer" : ""}>
        <Avatar
          initials={initials}
          colorVariant="info"
          size="md"
        />
      </div>
      {!collapsed && (
        <div className="flex-1 min-w-0 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[13px] font-bold truncate text-white">
              {displayName}
            </div>
            <div className="text-[10px] text-slate-350 capitalize font-medium">
              {displayRole.toLowerCase().replace(/_/g, " ")}
            </div>
          </div>
          <button 
            onClick={logout} 
            title="Sign Out" 
            className="p-1 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition cursor-pointer text-xs"
          >
            <i className="ti ti-logout text-sm" />
          </button>
        </div>
      )}
    </div>
  );
}
