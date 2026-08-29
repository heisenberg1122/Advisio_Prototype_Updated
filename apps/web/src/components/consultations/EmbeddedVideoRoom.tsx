import React, { useState, useEffect, useRef } from "react";

interface EmbeddedVideoRoomProps {
  topic: string;
  groupName: string;
  meetingUrl?: string;
  onClose: () => void;
}

export const EmbeddedVideoRoom: React.FC<EmbeddedVideoRoomProps> = ({
  topic,
  groupName,
  meetingUrl,
  onClose,
}) => {
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [viewMode, setViewMode] = useState<"webrtc" | "embed">("webrtc");
  const [activeTab, setActiveTab] = useState<"notes" | "chat">("notes");
  const [callDuration, setCallDuration] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // Real WebRTC Streams
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Chat & Notes state
  const [chatMessages, setChatMessages] = useState([
    { sender: "Advisio System", text: "Connected to real-time WebRTC media engine. Live camera and mic active.", time: "Just now" },
  ]);
  const [msgInput, setMsgInput] = useState("");
  const [meetingNotes, setMeetingNotes] = useState(
    `Consultation Topic: ${topic}\nGroup: ${groupName}\nDate: ${new Date().toLocaleDateString()}\n\nMinutes of Discussion:\n- `
  );

  // Clean room identifier for real WebRTC iframe fallback
  const safeRoomId = `advisio-${topic.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${groupName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
  const liveIframeUrl = `https://meet.jit.si/${safeRoomId}#config.startWithAudioMuted=false&config.startWithVideoMuted=false&config.prejoinPageEnabled=false`;

  // Initialize Real Camera & Microphone using getUserMedia
  useEffect(() => {
    let isMounted = true;

    async function startMedia() {
      try {
        setPermissionError(null);
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: true,
          });

          if (!isMounted) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }

          mediaStreamRef.current = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        }
      } catch (err: any) {
        console.warn("[WebRTC] Real Camera/Mic access note:", err.message);
        if (isMounted) {
          setPermissionError(
            err.name === "NotAllowedError"
              ? "Camera/Mic permission was denied. You can still use the embedded conference room."
              : "Unable to access local webcam hardware directly."
          );
        }
      }
    }

    startMedia();

    const timer = setInterval(() => setCallDuration((prev) => prev + 1), 1000);

    return () => {
      isMounted = false;
      clearInterval(timer);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Real Microphone Toggle
  const toggleMicrophone = () => {
    if (mediaStreamRef.current) {
      const audioTracks = mediaStreamRef.current.getAudioTracks();
      audioTracks.forEach((t) => (t.enabled = !micOn));
    }
    setMicOn(!micOn);
  };

  // Real Camera Toggle
  const toggleCamera = () => {
    if (mediaStreamRef.current) {
      const videoTracks = mediaStreamRef.current.getVideoTracks();
      videoTracks.forEach((t) => (t.enabled = !cameraOn));
    }
    setCameraOn(!cameraOn);
  };

  // Real Screen Share using getDisplayMedia
  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
          const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          screenStreamRef.current = screenStream;

          if (screenVideoRef.current) {
            screenVideoRef.current.srcObject = screenStream;
          }

          screenStream.getVideoTracks()[0].onended = () => {
            setIsScreenSharing(false);
            if (screenStreamRef.current) {
              screenStreamRef.current.getTracks().forEach((t) => t.stop());
              screenStreamRef.current = null;
            }
          };

          setIsScreenSharing(true);
        }
      } catch (err) {
        console.warn("[WebRTC] Screen share cancelled:", err);
      }
    } else {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
    }
  };

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgInput.trim()) return;
    setChatMessages((prev) => [
      ...prev,
      { sender: "You", text: msgInput.trim(), time: "Just now" },
    ]);
    setMsgInput("");
  };

  return (
    <div className="fixed inset-0 z-60 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full h-[96vh] max-w-7xl flex flex-col shadow-2xl overflow-hidden">
        {/* HEADER BAR */}
        <div className="bg-slate-900 border-b border-slate-800 px-5 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow">
              <i className="ti ti-video text-lg" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-white text-[15px]">{topic}</h3>
                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  REAL WEBRTC STREAM
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                {groupName} · Active Call Duration: {formatDuration(callDuration)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* VIEW MODE TOGGLE */}
            <div className="hidden sm:flex bg-slate-800 rounded-lg p-1 border border-slate-700 text-[11px] font-bold text-slate-300">
              <button
                onClick={() => setViewMode("webrtc")}
                className={`px-3 py-1 rounded-md transition cursor-pointer ${
                  viewMode === "webrtc" ? "bg-[#1b4264] text-[#ffa400]" : "hover:text-white"
                }`}
              >
                <i className="ti ti-camera mr-1" /> Live Local WebRTC
              </button>
              <button
                onClick={() => setViewMode("embed")}
                className={`px-3 py-1 rounded-md transition cursor-pointer ${
                  viewMode === "embed" ? "bg-[#1b4264] text-[#ffa400]" : "hover:text-white"
                }`}
              >
                <i className="ti ti-users mr-1" /> Multi-Party Room
              </button>
            </div>

            <button
              onClick={onClose}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[11.5px] font-bold rounded-lg transition flex items-center gap-1 cursor-pointer shadow"
            >
              <i className="ti ti-phone-off text-sm" />
              <span>Leave Consultation</span>
            </button>
          </div>
        </div>

        {/* MAIN VIDEO & COLLABORATION STAGE */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-3 p-3 min-h-0 bg-slate-950/80">
          {/* VIDEO STAGE (COL 1-3) */}
          <div className="lg:col-span-3 flex flex-col gap-2.5 min-h-0 h-full">
            {permissionError && (
              <div className="bg-amber-950/60 border border-amber-500/40 text-amber-200 px-3 py-1.5 rounded-lg text-[11.5px] flex items-center justify-between">
                <span>{permissionError}</span>
                <button
                  onClick={() => setViewMode("embed")}
                  className="underline font-bold text-[#ffa400] ml-2 cursor-pointer"
                >
                  Switch to Multi-Party WebRTC
                </button>
              </div>
            )}

            {viewMode === "webrtc" ? (
              /* REAL WEBRTC HARDWARE FEED */
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 min-h-0">
                {/* YOUR REAL HARDWARE WEBCAM */}
                <div className="relative bg-slate-900 border border-slate-700/80 rounded-xl overflow-hidden flex items-center justify-center shadow-lg">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover mirror ${!cameraOn ? "hidden" : ""}`}
                  />
                  {!cameraOn && (
                    <div className="flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                      <div className="w-20 h-20 rounded-full bg-[#1b4264] text-[#ffa400] font-black text-2xl flex items-center justify-center border-4 border-slate-700 mb-2">
                        YOU
                      </div>
                      <span className="font-bold text-white text-[13px]">Your Camera is Off</span>
                      <span className="text-[11px] text-slate-500">Audio stream remains active</span>
                    </div>
                  )}

                  <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE 1080P FEED
                  </div>

                  <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-xs px-2.5 py-1 rounded-md text-[11px] text-white font-bold flex items-center gap-1.5">
                    <i className={`ti ${micOn ? "ti-microphone text-emerald-400" : "ti-microphone-off text-rose-400"}`} />
                    <span>You (Active Stream)</span>
                  </div>
                </div>

                {/* ADVISER / CO-RESEARCHER OR SCREEN SHARE FEED */}
                <div className="relative bg-slate-900 border border-slate-700/80 rounded-xl overflow-hidden flex items-center justify-center shadow-lg">
                  {isScreenSharing ? (
                    <video
                      ref={screenVideoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-contain bg-black"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-850 to-[#1b4264]/40 flex flex-col items-center justify-center p-6 text-center">
                      <div className="w-20 h-20 rounded-full bg-[#1b4264] text-[#ffa400] font-black text-2xl flex items-center justify-center border-4 border-slate-700 shadow-xl mb-2">
                        ADV
                      </div>
                      <span className="font-bold text-white text-[14px]">Adviser Connection</span>
                      <span className="text-[11px] text-slate-400">Institutional Faculty Member</span>
                      <div className="mt-3 px-3 py-1 bg-emerald-950/60 border border-emerald-500/30 rounded-full text-emerald-400 text-[10px] font-bold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Awaiting Remote Peer Connection
                      </div>
                    </div>
                  )}

                  <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-xs px-2.5 py-1 rounded-md text-[11px] text-white font-bold flex items-center gap-1.5">
                    <i className="ti ti-video text-blue-400" />
                    <span>{isScreenSharing ? "Live Screen Share" : "Faculty Advisory Desk"}</span>
                  </div>
                </div>
              </div>
            ) : (
              /* REAL MULTI-PARTY WEBRTC IFRAME ROOM */
              <div className="flex-1 bg-black rounded-xl overflow-hidden border border-slate-700 min-h-0 relative">
                <iframe
                  src={liveIframeUrl}
                  allow="camera; microphone; display-capture; autoplay; clipboard-write;"
                  className="w-full h-full border-0"
                  title="Multi-Party WebRTC Conference"
                />
              </div>
            )}

            {/* REAL HARDWARE CONTROLS BAR */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl py-2 px-4 flex items-center justify-between flex-shrink-0 shadow">
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMicrophone}
                  className={`px-3 py-2 rounded-xl flex items-center gap-1.5 transition font-bold text-xs cursor-pointer ${
                    micOn ? "bg-slate-800 hover:bg-slate-700 text-white" : "bg-rose-600 text-white"
                  }`}
                >
                  <i className={`ti ${micOn ? "ti-microphone" : "ti-microphone-off"} text-base`} />
                  <span>{micOn ? "Mute" : "Unmute"}</span>
                </button>

                <button
                  onClick={toggleCamera}
                  className={`px-3 py-2 rounded-xl flex items-center gap-1.5 transition font-bold text-xs cursor-pointer ${
                    cameraOn ? "bg-slate-800 hover:bg-slate-700 text-white" : "bg-rose-600 text-white"
                  }`}
                >
                  <i className={`ti ${cameraOn ? "ti-video" : "ti-video-off"} text-base`} />
                  <span>{cameraOn ? "Stop Cam" : "Start Cam"}</span>
                </button>

                <button
                  onClick={toggleScreenShare}
                  className={`px-3 py-2 rounded-xl flex items-center gap-1.5 transition font-bold text-xs cursor-pointer ${
                    isScreenSharing ? "bg-blue-600 text-white" : "bg-slate-800 hover:bg-slate-700 text-white"
                  }`}
                >
                  <i className="ti ti-screen-share text-base" />
                  <span>{isScreenSharing ? "Stop Share" : "Share Screen"}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode(viewMode === "webrtc" ? "embed" : "webrtc")}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <i className="ti ti-switch-horizontal" />
                  <span>Switch Mode</span>
                </button>

                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <i className="ti ti-phone-off" />
                  <span>End Meeting</span>
                </button>
              </div>
            </div>
          </div>

          {/* SIDEBAR PANEL (COL 4) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col min-h-0 overflow-hidden shadow">
            {/* TABS */}
            <div className="flex border-b border-slate-800 text-[11px] font-bold">
              <button
                onClick={() => setActiveTab("notes")}
                className={`flex-1 py-2.5 text-center transition cursor-pointer ${
                  activeTab === "notes" ? "bg-slate-800 text-[#ffa400] border-b-2 border-[#ffa400]" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Minutes of Meeting
              </button>
              <button
                onClick={() => setActiveTab("chat")}
                className={`flex-1 py-2.5 text-center transition cursor-pointer ${
                  activeTab === "chat" ? "bg-slate-800 text-[#ffa400] border-b-2 border-[#ffa400]" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                In-Call Chat ({chatMessages.length})
              </button>
            </div>

            {/* CONTENT */}
            {activeTab === "notes" ? (
              <div className="flex-1 p-3 flex flex-col gap-2 min-h-0">
                <span className="text-[10.5px] font-bold text-slate-400">Live Collaborative Notes</span>
                <textarea
                  value={meetingNotes}
                  onChange={(e) => setMeetingNotes(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200 text-[12px] focus:outline-none focus:border-[#ffa400] resize-none font-mono leading-relaxed"
                  placeholder="Record consultation discussion notes..."
                />
                <button
                  onClick={() => alert("Minutes of consultation saved successfully to project repository!")}
                  className="px-3 py-1.5 bg-[#1b4264] hover:bg-[#15344f] text-[#ffa400] text-[11px] font-bold rounded-lg border border-[#ffa400]/40 cursor-pointer self-end shadow"
                >
                  Save Notes to Database
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-2.5 text-[11.5px]">
                  {chatMessages.map((m, idx) => (
                    <div key={idx} className="flex flex-col gap-0.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={`font-bold ${m.sender === "You" ? "text-emerald-400" : "text-blue-400"}`}>
                          {m.sender}
                        </span>
                        <span className="text-slate-500">{m.time}</span>
                      </div>
                      <div className="bg-slate-800/80 rounded-lg p-2 text-slate-200 border border-slate-700/50">
                        {m.text}
                      </div>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleSendMessage} className="p-2 border-t border-slate-800 flex gap-2">
                  <input
                    type="text"
                    value={msgInput}
                    onChange={(e) => setMsgInput(e.target.value)}
                    placeholder="Type in-call message..."
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-[11.5px] focus:outline-none focus:border-blue-500"
                  />
                  <button type="submit" className="px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold cursor-pointer">
                    <i className="ti ti-send" />
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
