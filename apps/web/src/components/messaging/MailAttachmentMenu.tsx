"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Eye, MoreVertical, Paperclip, PenLine } from "lucide-react";

export type MailAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  sourceAttachmentId?: string | null;
  signedById?: string | null;
  signedAt?: string | null;
  verificationCode?: string | null;
};

export function MailAttachmentMenu({ attachment, mine, canSign, onOpen, onDownload, onSign }: {
  attachment: MailAttachment;
  mine?: boolean;
  canSign?: boolean;
  onOpen: () => void;
  onDownload: () => void;
  onSign: () => void;
}) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const longPressRef = useRef<number | null>(null);
  const eligible = Boolean(canSign && attachment.mimeType === "application/pdf" && !attachment.sourceAttachmentId && !attachment.signedById);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("blur", close);
    return () => { window.removeEventListener("click", close); window.removeEventListener("blur", close); };
  }, [menu]);

  const openAt = (x: number, y: number) => {
    const width = 190;
    const height = eligible ? 132 : 92;
    setMenu({ x: Math.min(x, window.innerWidth - width - 12), y: Math.min(y, window.innerHeight - height - 12) });
  };
  const clearLongPress = () => {
    if (longPressRef.current != null) window.clearTimeout(longPressRef.current);
    longPressRef.current = null;
  };

  return <div
    className="group/attachment relative mt-3"
    onContextMenu={(event) => { event.preventDefault(); openAt(event.clientX, event.clientY); }}
    onPointerDown={(event) => { if (event.pointerType === "mouse") return; clearLongPress(); longPressRef.current = window.setTimeout(() => openAt(event.clientX, event.clientY), 550); }}
    onPointerUp={clearLongPress}
    onPointerCancel={clearLongPress}
    onPointerMove={clearLongPress}
  >
    <button type="button" onClick={onOpen} className={`${mine ? "bg-white/10" : "bg-slate-100 text-[#173f63]"} flex w-full items-center gap-2 rounded-xl p-3 pr-11 text-left text-xs font-extrabold`}>
      <Paperclip className="h-4 w-4" /><span className="min-w-0 flex-1 truncate">{attachment.fileName}</span>
      {attachment.signedAt && <span className="rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-black text-emerald-700">SIGNED</span>}
    </button>
    <button
      ref={triggerRef}
      type="button"
      aria-label={`Actions for ${attachment.fileName}`}
      aria-haspopup="menu"
      aria-expanded={Boolean(menu)}
      onClick={(event) => { event.stopPropagation(); const bounds = triggerRef.current?.getBoundingClientRect(); if (bounds) openAt(bounds.right - 190, bounds.bottom + 6); }}
      onKeyDown={(event) => { if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) { event.preventDefault(); const bounds = triggerRef.current?.getBoundingClientRect(); if (bounds) openAt(bounds.right - 190, bounds.bottom + 6); } }}
      className={`absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg opacity-70 transition hover:opacity-100 focus:opacity-100 group-hover/attachment:opacity-100 ${mine ? "hover:bg-white/15" : "hover:bg-white"}`}
    ><MoreVertical className="h-4 w-4" /></button>
    {menu && <div role="menu" aria-label={`Actions for ${attachment.fileName}`} onClick={(event) => event.stopPropagation()} style={{ left: menu.x, top: menu.y }} className="fixed z-[140] w-[190px] rounded-xl border border-slate-200 bg-white p-1.5 text-slate-700 shadow-2xl">
      <button role="menuitem" type="button" onClick={() => { setMenu(null); onOpen(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold hover:bg-slate-100"><Eye className="h-4 w-4" />Preview document</button>
      <button role="menuitem" type="button" onClick={() => { setMenu(null); onDownload(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold hover:bg-slate-100"><Download className="h-4 w-4" />Download</button>
      {eligible && <button role="menuitem" type="button" onClick={() => { setMenu(null); onSign(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-black text-[#173f63] hover:bg-amber-50"><PenLine className="h-4 w-4 text-[#C58A18]" />Review &amp; sign</button>}
    </div>}
  </div>;
}
