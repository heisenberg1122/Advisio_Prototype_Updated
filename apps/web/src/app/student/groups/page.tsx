"use client";

import { useStudentGroup } from "@/hooks/use-student";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Tag";
import { ListPageSkeleton } from "@/components/ui/Skeleton";

export default function GroupsPage() {
  const { data: group, isPending } = useStudentGroup();

  if (isPending) return <ListPageSkeleton rows={5} />;
  if (!group) return null;

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Group info card */}
      <Card>
        <CardHeader>
          <CardTitle icon="ti-users">{group.name}</CardTitle>
          <Tag variant="info">Active</Tag>
        </CardHeader>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-4">
          Research title: <span className="font-semibold text-slate-800 dark:text-slate-200">{group.researchTitle}</span>
        </p>

        <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">
          Members
        </div>

        <div className="divide-y divide-[#EEF2F6] dark:divide-white/10">
          {group.members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3.5 py-3"
            >
              <Avatar
                initials={member.initials}
                colorVariant={member.colorVariant ?? "info"}
                size="lg"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs sm:text-sm font-bold text-[#17212B] dark:text-white">
                  {member.name}
                  {member.isYou && (
                    <span className="text-slate-400 font-normal ml-1.5">(you)</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {member.role === "leader" ? "Group leader" : "Member"}
                </div>
              </div>
              {member.role === "leader" && <Tag variant="info">Leader</Tag>}
            </div>
          ))}
        </div>
      </Card>

      {/* Workspace thread card */}
      <Card>
        <CardTitle icon="ti-message-circle" className="mb-2">
          Group workspace thread
        </CardTitle>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-4">
          Created by your adviser — you were added automatically.
        </p>
        <div>
          <button className="inline-flex items-center gap-2 rounded-xl bg-[#0B3A53] hover:bg-[#072A3D] text-white px-5 py-2.5 text-xs font-bold shadow-xs transition cursor-pointer">
            <i className="ti ti-external-link" aria-hidden="true" />
            Open workspace
          </button>
        </div>
      </Card>
    </div>
  );
}
