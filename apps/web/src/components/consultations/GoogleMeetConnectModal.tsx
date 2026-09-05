import React, { useState } from "react";

interface GoogleMeetConnectModalProps {
  currentUrl: string;
  defaultEmail: string;
  defaultName: string;
  role: string;
  isOpen: boolean;
  onClose: () => void;
  onLaunch: (selectedUrl: string, selectedEmail: string) => void;
}

export const GoogleMeetConnectModal: React.FC<GoogleMeetConnectModalProps> = ({
  currentUrl,
  defaultEmail,
  defaultName,
  role,
  isOpen,
  onClose,
  onLaunch,
}) => {
  const [selectedEmail, setSelectedEmail] = useState(defaultEmail);
  const [roomUrlInput, setRoomUrlInput] = useState(currentUrl);
  const [useCustomEmail, setUseCustomEmail] = useState(false);
  const [customEmailInput, setCustomEmailInput] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let finalUrl = roomUrlInput.trim();
    if (!finalUrl.startsWith("http")) {
      finalUrl = `https://meet.google.com/${finalUrl.replace(/[^a-z0-9-]/gi, "")}`;
    }
    const finalEmail = useCustomEmail && customEmailInput.trim() ? customEmailInput.trim() : selectedEmail;
    onLaunch(finalUrl, finalEmail);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-5 text-slate-800 dark:text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center p-1 shadow border border-slate-200">
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
              <h3 className="font-extrabold text-[#1b4264] dark:text-white text-[15px]">Connect Google Meet Account</h3>
              <p className="text-[10.5px] text-slate-400 font-medium">Synchronize room URL and active Google identity</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 cursor-pointer text-sm"
          >
            <i className="ti ti-x" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs">
          {/* GMAIL ACCOUNT SELECTION */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-slate-600 dark:text-slate-300 flex items-center justify-between">
              <span>Google Account / Gmail</span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-normal">Active Identity</span>
            </label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:border-blue-500 transition">
                <input
                  type="radio"
                  name="gmailSelect"
                  checked={!useCustomEmail}
                  onChange={() => setUseCustomEmail(false)}
                  className="text-blue-600"
                />
                <div className="flex-1 min-w-0">
                  <span className="font-bold block text-slate-800 dark:text-slate-200">{defaultName} ({role})</span>
                  <span className="text-[10.5px] text-slate-500 truncate block">{defaultEmail}</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:border-blue-500 transition">
                <input
                  type="radio"
                  name="gmailSelect"
                  checked={useCustomEmail}
                  onChange={() => setUseCustomEmail(true)}
                  className="text-blue-600"
                />
                <div className="flex-1 min-w-0">
                  <span className="font-bold block text-slate-800 dark:text-slate-200">Use Custom Google Account</span>
                  {useCustomEmail && (
                    <input
                      type="email"
                      value={customEmailInput}
                      onChange={(e) => setCustomEmailInput(e.target.value)}
                      placeholder="e.g. personal.email@gmail.com"
                      className="w-full mt-1.5 p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs focus:outline-none focus:border-blue-500"
                      required
                    />
                  )}
                </div>
              </label>
            </div>
          </div>

          {/* SYNCHRONIZED GOOGLE MEET URL */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-slate-600 dark:text-slate-300 flex items-center justify-between">
              <span>Google Meet Room Link or Code</span>
              <span className="text-[10px] text-emerald-600 font-mono font-bold">Synchronized to Group</span>
            </label>
            <input
              type="text"
              value={roomUrlInput}
              onChange={(e) => setRoomUrlInput(e.target.value)}
              placeholder="https://meet.google.com/xxx-yyyy-zzz or xxx-yyyy-zzz"
              className="p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-xs text-blue-600 dark:text-blue-400 focus:outline-none focus:border-blue-500 shadow-inner"
              required
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              Both you and all participants in this consultation will enter this exact same Google Meet room.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow transition"
            >
              <i className="ti ti-video" />
              <span>Launch & Sync Google Meet</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
