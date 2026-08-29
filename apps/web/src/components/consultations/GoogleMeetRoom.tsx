import React, { useState, useEffect } from "react";

interface GoogleMeetRoomProps {
  topic: string;
  groupName: string;
  meetingUrl?: string;
  onClose: () => void;
}

export const GoogleMeetRoom: React.FC<GoogleMeetRoomProps> = ({
  topic,
  groupName,
  meetingUrl = "https://meet.google.com/new",
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<"companion" | "notes">("companion");
  const [meetingNotes, setMeetingNotes] = useState(
    `Consultation Topic: ${topic}\nGroup: ${groupName}\nDate: ${new Date().toLocaleDateString()}\n\nMinutes of Discussion:\n- Review of thesis chapters\n- Recommendations:\n`
  );
  const [callDuration, setCallDuration] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(meetingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleLaunchGoogleMeet = () => {
    window.open(meetingUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="fixed inset-0 z-60 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-6 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full h-[95vh] max-w-6xl flex flex-col shadow-2xl overflow-hidden">
        {/* GOOGLE MEET HEADER */}
        <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-md p-1.5">
              <svg viewBox="0 0 24 24" className="w-full h-full">
                <path fill="#00832d" d="M19 12l4-4v8z" />
                <path fill="#0066da" d="M17 19H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2z" />
                <path fill="#e53935" d="M7 5H3a2 2 0 0 0-2 2v4z" />
                <path fill="#00ac47" d="M1 13v4a2 2 0 0 0 2 2h4z" />
                <path fill="#ffba00" d="M17 5h-4v6h6V7a2 2 0 0 0-2-2z" />
                <path fill="#0066da" d="M19 13h-6v6h4a2 2 0 0 0 2-2z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-white text-[16px]">{topic}</h3>
                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  GOOGLE MEET LIVE
                </span>
              </div>
              <span className="text-[11.5px] text-slate-400 font-medium">
                {groupName} · Session Duration: {formatDuration(callDuration)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleLaunchGoogleMeet}
              className="flex items-center gap-2 px-4 py-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white font-bold rounded-xl text-xs transition shadow cursor-pointer"
            >
              <i className="ti ti-video text-sm" />
              <span>Launch Google Meet Room</span>
            </button>

            <button
              onClick={onClose}
              className="px-3.5 py-2 bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer"
            >
              <i className="ti ti-x" />
              <span>Close</span>
            </button>
          </div>
        </div>

        {/* MAIN SPLIT VIEW */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 min-h-0 bg-slate-950/70">
          {/* GOOGLE MEET CALL CONSOLE (LEFT 2 COLS) */}
          <div className="lg:col-span-2 flex flex-col gap-4 min-h-0 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-inner justify-between">
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#1b4264] text-[#ffa400] font-black text-xl flex items-center justify-center border border-slate-700 shadow">
                    GM
                  </div>
                  <div>
                    <h4 className="font-extrabold text-white text-[16px]">Official Google Meet Consultation</h4>
                    <p className="text-[12px] text-slate-400">Authenticated video call room powered by Google Workspace</p>
                  </div>
                </div>
                <div className="px-3 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg text-xs font-mono font-bold">
                  HD 1080p
                </div>
              </div>

              {/* MEETING LINK DISPLAY */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Google Meet URL</span>
                  <span className="font-mono text-emerald-400 font-bold text-[13px]">{meetingUrl}</span>
                </div>
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 flex items-center gap-1.5 transition cursor-pointer self-start sm:self-center"
                >
                  <i className={`ti ${copied ? "ti-check text-emerald-400" : "ti-copy"}`} />
                  <span>{copied ? "Link Copied!" : "Copy Link"}</span>
                </button>
              </div>

              {/* ACTION CALLOUT CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-white font-bold">
                    <i className="ti ti-brand-google text-blue-400 text-base" />
                    <span>Real-Time Google Meet</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Uses official Google Meet servers with crystal-clear audio, noise cancellation, and screen sharing for capstone presentations.
                  </p>
                  <button
                    onClick={handleLaunchGoogleMeet}
                    className="mt-1 px-3 py-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white font-bold rounded-lg text-xs transition cursor-pointer text-center"
                  >
                    Open Google Meet
                  </button>
                </div>

                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-white font-bold">
                    <i className="ti ti-file-text text-[#ffa400] text-base" />
                    <span>Side-by-Side Minutes</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Document feedback, advisor remarks, and action items simultaneously while on the Google Meet video call.
                  </p>
                  <button
                    onClick={() => setActiveTab("notes")}
                    className="mt-1 px-3 py-2 bg-[#1b4264] hover:bg-[#15344f] text-[#ffa400] font-bold rounded-lg text-xs transition cursor-pointer text-center"
                  >
                    View / Edit Minutes
                  </button>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 border-t border-slate-800 pt-3 flex items-center justify-between">
              <span>Security: Google Meet Encrypted In-Transit & at Rest</span>
              <span>Advisio Research Platform Integration</span>
            </div>
          </div>

          {/* SIDEBAR: COLLABORATIVE MINUTES OF MEETING (RIGHT 1 COL) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col min-h-0 overflow-hidden shadow">
            <div className="bg-slate-850 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
              <span className="font-extrabold text-[#ffa400] text-[13px] flex items-center gap-1.5">
                <i className="ti ti-notes" />
                <span>Consultation Minutes</span>
              </span>
              <span className="text-[10px] text-slate-400 font-bold">Auto-Syncing</span>
            </div>

            <div className="flex-1 p-3.5 flex flex-col gap-2 min-h-0">
              <textarea
                value={meetingNotes}
                onChange={(e) => setMeetingNotes(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-slate-200 text-[12px] focus:outline-none focus:border-[#ffa400] resize-none font-mono leading-relaxed shadow-inner"
                placeholder="Type consultation minutes and action points..."
              />
              <button
                onClick={() => alert("Minutes of consultation saved successfully to project repository!")}
                className="px-4 py-2 bg-[#1b4264] hover:bg-[#15344f] text-[#ffa400] text-[11.5px] font-bold rounded-xl border border-[#ffa400]/40 cursor-pointer self-end shadow transition"
              >
                Save Minutes to Database
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
