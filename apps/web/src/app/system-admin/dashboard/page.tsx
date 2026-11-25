"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SystemAnnouncements } from "@/components/system-admin/SystemAnnouncements";
import { UserManagement } from "@/components/system-admin/UserManagement";
import { GoogleDriveIntegration } from "@/components/system-admin/GoogleDriveIntegration";
import { AcademicStructureManagement } from "@/components/system-admin/AcademicStructureManagement";
import {
  SystemAdminOverview,
} from "@/components/system-admin/SystemAdminOverview";
import { AuditTrail } from "@/components/system-admin/AuditTrail";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import {
  DatabaseBackupsScreen,
  PortalSettingsScreen,
  RolePermissionsScreen,
  SystemConfigurationScreen,
} from "@/components/system-admin/SystemAdminStaticScreens";

function SystemAdminDashboardContent() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";

  return (
    <div className="flex min-h-full flex-1 flex-col bg-transparent text-slate-800 transition-colors dark:text-slate-100">
      {/* MAIN CONTAINER */}
      <main className="workspace-page mx-auto flex w-full max-w-[1360px] flex-1 flex-col gap-6 overflow-y-auto p-4 sm:p-6 lg:p-8">
        {/* TAB CONTENTS */}
        {(() => {
          if (activeTab === "announcements") return <SystemAnnouncements />;
          if (activeTab === "users")
            return (
              <UserManagement
                key={searchParams.get("status") || "ALL"}
                initialStatus={searchParams.get("status") || "ALL"}
              />
            );
          if (activeTab === "integrations") return <GoogleDriveIntegration />;

          if (activeTab === "onboarding") {
            return <AcademicStructureManagement />;
          }

          if (activeTab === "logs") return <AuditTrail />;

          if (activeTab === "backups") return <DatabaseBackupsScreen />;
          if (activeTab === "roles") return <RolePermissionsScreen />;
          if (activeTab === "config") return <SystemConfigurationScreen />;
          if (activeTab === "settings") return <PortalSettingsScreen />;

          return <SystemAdminOverview />;
        })()}
      </main>
    </div>
  );
}

export default function SystemAdminDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <SystemAdminDashboardContent />
    </Suspense>
  );
}
