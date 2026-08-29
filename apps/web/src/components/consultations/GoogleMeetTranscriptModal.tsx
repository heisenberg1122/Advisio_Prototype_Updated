import React, { useState, useEffect } from "react";
import { ConsultationItem } from "@/lib/consultation-store";

export interface ParsedChatMessage {
  id: string;
  sender: string;
  time: string;
  content: string;
}

interface GoogleMeetTranscriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  consultation: ConsultationItem | null;
  onSaveNotes: (consultationId: string, notes: string, actionItems: string[], transcript: ParsedChatMessage[]) => void;
}

export const parseGoogleMeetChat = (rawText: string): ParsedChatMessage[] => {
  if (!rawText || !rawText.trim()) return [];

  const raw = rawText.trim();
  const messages: ParsedChatMessage[] = [];

  const lines = raw.split(/\r?\n/);
  let currentSender = "";
  let currentTime = "";
  let currentLines: string[] = [];

  const flushMessage = () => {
    if (currentLines.length > 0) {
      messages.push({
        id: Math.random().toString(),
        sender: currentSender || "Participant",
        time: currentTime || "In-call",
        content: currentLines.join("\n").trim(),
      });
      currentLines = [];
    }
  };

  const timeOnlyRegex = /^(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)$/i;
  const standardGoogleMeetHeader = /^(.+?)\s*(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))$/i;
  const zoomTeamsHeader = /^(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:From\s+)?(.+?)(?:\s+to\s+Everyone)?\s*:\s*(.*)$/i;
  const bracketHeader = /^\[(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\]\s*(.+?)\s*:\s*(.*)$/i;
  const dashHeader = /^(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)\s*[-–—]\s*(.+?)\s*:\s*(.*)$/i;
  const colonHeader = /^(.+?)\s*:\s*(.*)$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      if (currentLines.length > 0) currentLines.push("");
      continue;
    }

    // Check zoom/teams format: 10:45 From Juan to Everyone: Message
    const zoomMatch = line.match(zoomTeamsHeader);
    if (zoomMatch) {
      flushMessage();
      currentTime = zoomMatch[1].trim();
      currentSender = zoomMatch[2].trim();
      if (zoomMatch[3] && zoomMatch[3].trim()) {
        currentLines.push(zoomMatch[3].trim());
      }
      continue;
    }

    // Check bracket format: [10:45 AM] Juan: Hello
    const bracketMatch = line.match(bracketHeader);
    if (bracketMatch) {
      flushMessage();
      currentTime = bracketMatch[1].trim();
      currentSender = bracketMatch[2].trim();
      if (bracketMatch[3] && bracketMatch[3].trim()) {
        currentLines.push(bracketMatch[3].trim());
      }
      continue;
    }

    // Check dash format: 10:45 AM - Juan: Hello
    const dashMatch = line.match(dashHeader);
    if (dashMatch) {
      flushMessage();
      currentTime = dashMatch[1].trim();
      currentSender = dashMatch[2].trim();
      if (dashMatch[3] && dashMatch[3].trim()) {
        currentLines.push(dashMatch[3].trim());
      }
      continue;
    }

    // Check Google Meet copy/paste: "Juan Reyes10:45 AM" or "You 10:45 AM"
    const gmMatch = line.match(standardGoogleMeetHeader);
    if (gmMatch && gmMatch[1].length < 50) {
      flushMessage();
      currentSender = gmMatch[1].trim();
      currentTime = gmMatch[2].trim();
      continue;
    }

    // Check timestamp only line: "10:45 AM"
    if (timeOnlyRegex.test(line) && i > 0 && lines[i - 1].trim().length < 40) {
      currentTime = line;
      continue;
    }

    // Check if line looks like a Sender name and next line is timestamp
    if (
      i + 1 < lines.length &&
      timeOnlyRegex.test(lines[i + 1].trim()) &&
      line.length < 50
    ) {
      flushMessage();
      currentSender = line;
      continue;
    }

    // Check plain Name: Message
    const colonMatch = line.match(colonHeader);
    if (colonMatch && colonMatch[1].length < 35 && !colonMatch[1].includes("http")) {
      flushMessage();
      currentSender = colonMatch[1].trim();
      currentTime = "During call";
      if (colonMatch[2] && colonMatch[2].trim()) {
        currentLines.push(colonMatch[2].trim());
      }
      continue;
    }

    currentLines.push(line);
  }

  flushMessage();

  // If no formatted messages were separated, treat lines/paragraphs as distinct messages
  if (messages.length === 0 && raw.length > 0) {
    const paragraphs = raw.split(/\n\s*\n/);
    return paragraphs.map((p, idx) => ({
      id: String(idx + 1),
      sender: "Participant",
      time: "In-call",
      content: p.trim(),
    }));
  }

  return messages;
};

export function GoogleMeetTranscriptModal({
  isOpen,
  onClose,
  consultation,
  onSaveNotes,
}: GoogleMeetTranscriptModalProps) {
  const [activeTab, setActiveTab] = useState<"transcript" | "minutes">("transcript");
  const [rawChatText, setRawChatText] = useState("");
  const [parsedMessages, setParsedMessages] = useState<ParsedChatMessage[]>([]);
  const [notesSummary, setNotesSummary] = useState("");
  const [actionItemsText, setActionItemsText] = useState("");

  useEffect(() => {
    if (consultation && isOpen) {
      setNotesSummary(consultation.notes || "");
      setActionItemsText(consultation.actionItems ? consultation.actionItems.join("\n") : "");
      if (consultation.transcript && consultation.transcript.length > 0) {
        setParsedMessages(consultation.transcript);
        setRawChatText(
          consultation.transcript
            .map((m) => `${m.time} - ${m.sender}: ${m.content}`)
            .join("\n")
        );
      } else {
        setParsedMessages([]);
        setRawChatText("");
      }
    }
  }, [consultation, isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setRawChatText(text);
      const parsed = parseGoogleMeetChat(text);
      setParsedMessages(parsed);
    };
    reader.readAsText(file);
  };

  const handleParseManual = () => {
    if (!rawChatText.trim()) return;
    const parsed = parseGoogleMeetChat(rawChatText);
    setParsedMessages(parsed);
  };

  const handleSave = () => {
    if (!consultation) return;
    const actionItems = actionItemsText
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    // If there is raw text but not yet parsed, parse it on save
    let finalTranscript = parsedMessages;
    if (finalTranscript.length === 0 && rawChatText.trim()) {
      finalTranscript = parseGoogleMeetChat(rawChatText);
    }

    onSaveNotes(consultation.id, notesSummary, actionItems, finalTranscript);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1b4264] to-[#2a5d8c] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl text-[#ffa400]">
              <i className="ti ti-file-text" />
            </div>
            <div>
              <h2 className="font-extrabold text-base leading-tight">Consultation Records & Google Meet Chat Archive</h2>
              <p className="text-xs text-slate-300">
                {consultation?.topic || "Consultation Session"} · {consultation?.groupName || "Research Group"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-200 cursor-pointer transition"
          >
            <i className="ti ti-x text-lg" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-3 gap-3">
          <button
            onClick={() => setActiveTab("transcript")}
            className={`pb-2.5 font-bold text-xs flex items-center gap-2 cursor-pointer transition border-b-2 ${
              activeTab === "transcript"
                ? "border-[#1b4264] text-[#1b4264]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <i className="ti ti-messages" />
            <span>Google Meet In-Call Chat ({parsedMessages.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("minutes")}
            className={`pb-2.5 font-bold text-xs flex items-center gap-2 cursor-pointer transition border-b-2 ${
              activeTab === "minutes"
                ? "border-[#1b4264] text-[#1b4264]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <i className="ti ti-checklist" />
            <span>Advising Minutes & Action Items</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4 text-xs">
          {activeTab === "transcript" ? (
            <>
              {/* Uploader / Paste Area */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <label className="font-extrabold text-[#1b4264] flex items-center gap-1.5">
                    <i className="ti ti-upload text-sm" />
                    <span>Upload Google Meet Chat file (.txt / .vtt) or paste text</span>
                  </label>
                  <label className="px-3 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg font-bold text-slate-700 cursor-pointer shadow-sm text-[11px]">
                    Browse File
                    <input
                      type="file"
                      accept=".txt,.vtt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <textarea
                  value={rawChatText}
                  onChange={(e) => {
                    setRawChatText(e.target.value);
                    const parsed = parseGoogleMeetChat(e.target.value);
                    setParsedMessages(parsed);
                  }}
                  placeholder="Paste Google Meet in-call messages here (e.g. 'Juan Reyes 10:45 AM: Here is our code repo...')"
                  rows={4}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-700 text-xs focus:outline-none focus:border-[#1b4264] font-mono resize-none"
                />

                <div className="flex justify-between items-center text-[11px] text-slate-400">
                  <span>Supports all Google Meet chat formats, exported .txt files, and manual pastes.</span>
                  <button
                    type="button"
                    onClick={handleParseManual}
                    disabled={!rawChatText.trim()}
                    className="px-3 py-1.5 bg-[#1b4264] text-[#ffa400] font-bold rounded-lg cursor-pointer disabled:opacity-50"
                  >
                    Format Messages
                  </button>
                </div>
              </div>

              {/* Parsed Message Stream Preview */}
              {parsedMessages.length > 0 ? (
                <div className="flex flex-col gap-2.5 mt-1">
                  <div className="flex justify-between items-center text-slate-500 font-bold text-[11px]">
                    <span>Parsed In-Call Discussion ({parsedMessages.length} messages)</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(rawChatText);
                      }}
                      className="text-blue-600 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <i className="ti ti-copy" />
                      <span>Copy Full Log</span>
                    </button>
                  </div>
                  <div className="max-h-56 overflow-y-auto flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    {parsedMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-1"
                      >
                        <div className="flex justify-between items-center text-[10.5px]">
                          <span className="font-extrabold text-[#1b4264]">{msg.sender}</span>
                          <span className="text-slate-400 font-mono">{msg.time}</span>
                        </div>
                        <p className="text-slate-700 text-[11.5px] leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-slate-400 border border-dashed border-slate-300 rounded-xl">
                  <i className="ti ti-message-2 text-2xl mb-1 block text-slate-300" />
                  <p className="font-medium">No messages imported yet. Upload your Google Meet `messages.txt` or paste the conversation log above.</p>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Advising Minutes & Action Items */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700">Meeting Summary & Adviser Feedback</label>
                  <textarea
                    value={notesSummary}
                    onChange={(e) => setNotesSummary(e.target.value)}
                    placeholder="Summarize key feedback, methodology decisions, and chapter recommendations..."
                    rows={4}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-700 text-xs focus:outline-none focus:border-[#1b4264] resize-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700">Action Items & Deliverables (One per line)</label>
                  <textarea
                    value={actionItemsText}
                    onChange={(e) => setActionItemsText(e.target.value)}
                    placeholder="e.g.&#10;1. Update Chapter 3 Neural Network Architecture diagram&#10;2. Normalize dataset before training iteration&#10;3. Submit revised draft by Friday"
                    rows={4}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-700 text-xs focus:outline-none focus:border-[#1b4264] font-mono resize-none"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-2 bg-[#ffa400] hover:bg-[#e09000] text-[#1b4264] font-extrabold rounded-lg shadow cursor-pointer transition text-xs border border-[#ffa400]"
          >
            <i className="ti ti-device-floppy" />
            <span>Save to Consultation History</span>
          </button>
        </div>
      </div>
    </div>
  );
}
