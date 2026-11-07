import React, { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown, FolderOpen, ListChecks, MessageCircle, MoreHorizontal, Plus } from "lucide-react";
import { initials } from "@/lib/project-overview-display";
import "./project-group.css";

export interface ProjectGroupMember<T = unknown> {
  id: string;
  name: string;
  email?: string;
  leader: boolean;
  isYou: boolean;
  /** The original membership record, passed back to the action callbacks. */
  raw: T;
}

function MemberActions<T>({
  member,
  onTransfer,
  onRemove,
}: {
  member: ProjectGroupMember<T>;
  onTransfer: (member: T) => void;
  onRemove: (member: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const choose = (action: (member: T) => void) => {
    setOpen(false);
    action(member.raw);
  };

  return (
    <div className="pg-menu-wrap" ref={wrapper}>
      <button
        ref={button}
        type="button"
        className="pg-menu-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Actions for ${member.name}`}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal size={18} aria-hidden="true" />
      </button>
      {open && (
        <div className="pg-menu" role="menu" id={menuId}>
          <button type="button" role="menuitem" autoFocus onClick={() => choose(onTransfer)}>
            Transfer leadership
          </button>
          <hr />
          <button type="button" role="menuitem" className="pg-menu-danger" onClick={() => choose(onRemove)}>
            Remove from group
          </button>
        </div>
      )}
    </div>
  );
}

export function ProjectGroupPanel<T>({
  groupName,
  projectTitle,
  isLeader,
  logoSrc,
  members,
  joinRequests,
  onTransfer,
  onRemove,
  onLeave,
  onMessages,
  onTasks,
  onFiles,
  invite,
  settings,
}: {
  groupName: string;
  projectTitle?: string | null;
  isLeader: boolean;
  logoSrc?: string;
  members: ProjectGroupMember<T>[];
  /** Pending join requests, shown to the leader above the member list. */
  joinRequests?: ReactNode;
  onTransfer: (member: T) => void;
  onRemove: (member: T) => void;
  /** Offered to members who are not the leader. */
  onLeave?: () => void;
  onMessages: () => void;
  onTasks: () => void;
  onFiles: () => void;
  /** Leader-only invite tools: email invitation and invitation code. */
  invite?: ReactNode;
  /** Leader-only access settings, kept in a collapsed section. */
  settings?: { summary: string; content: ReactNode };
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const invitePanelId = useId();

  return (
    <div className="pg-page mp-group">
      <section className="mp-panel pg-cover" data-guide="group-identity" aria-label="Research group">
        {logoSrc && <img className="pg-cover-seal" src={logoSrc} alt="" aria-hidden="true" draggable={false} />}
        <div className="pg-cover-inner">
          <p className="pg-meta">{projectTitle || "Research project awaiting registration by your leader."}</p>
          <h2 className="pg-title">{groupName}</h2>
          <p className="pg-role">Your role: <b>{isLeader ? "Group leader" : "Member"}</b></p>
          <nav className="pg-links" aria-label="Group shortcuts">
            <button type="button" onClick={onMessages}><MessageCircle size={16} strokeWidth={1.8} aria-hidden="true" />Group messages</button>
            <button type="button" onClick={onTasks}><ListChecks size={16} strokeWidth={1.8} aria-hidden="true" />Tasks</button>
            <button type="button" onClick={onFiles}><FolderOpen size={16} strokeWidth={1.8} aria-hidden="true" />Shared files</button>
          </nav>
        </div>
      </section>

      {joinRequests}

      <section className="mp-panel pg-members" data-guide="group-members" aria-labelledby="pg-members-title">
        <div className="pg-head">
          <h2 id="pg-members-title">Active researchers <span>· {members.length} {members.length === 1 ? "member" : "members"}</span></h2>
          {isLeader && invite && (
            <button
              type="button"
              className="mp-button mp-button--primary pg-invite-button"
              aria-expanded={inviteOpen}
              aria-controls={invitePanelId}
              onClick={() => setInviteOpen((open) => !open)}
            >
              <Plus size={16} strokeWidth={2} aria-hidden="true" />
              Invite
            </button>
          )}
        </div>
        {isLeader && invite && (
          <div className="pg-invite" id={invitePanelId} hidden={!inviteOpen}>
            {invite}
          </div>
        )}
        <ul className="pg-member-list">
          {members.map((member) => (
            <li key={member.id} className="pg-member">
              <span className={`pg-avatar ${member.isYou ? "pg-avatar--you" : ""}`} aria-hidden="true">{initials(member.name)}</span>
              <span className="pg-who">
                <b>{member.name}{member.isYou ? " (You)" : ""}</b>
                {member.email && <small>{member.email}</small>}
              </span>
              <span className={`pg-role-tag ${member.leader ? "pg-role-tag--leader" : ""}`}>{member.leader ? "Group leader" : "Member"}</span>
              {isLeader && !member.leader && !member.isYou ? (
                <MemberActions member={member} onTransfer={onTransfer} onRemove={onRemove} />
              ) : (
                <span className="pg-menu-spacer" aria-hidden="true" />
              )}
            </li>
          ))}
        </ul>
        {onLeave && (
          <div className="pg-leave">
            <button type="button" onClick={onLeave}>Leave group</button>
          </div>
        )}
      </section>

      {isLeader && settings && (
        <details className="mp-panel pg-settings">
          <summary>
            <span><b>Group settings</b><small>{settings.summary}</small></span>
            <ChevronDown size={18} strokeWidth={2} aria-hidden="true" className="pg-chevron" />
          </summary>
          <div className="pg-settings-body">{settings.content}</div>
        </details>
      )}
    </div>
  );
}
