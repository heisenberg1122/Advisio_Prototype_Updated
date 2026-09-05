import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/providers/auth-provider";
import { apiClient } from "@/lib/api-client";

export interface StudentDocument {
  id: string;
  title: string;
  content: string;
  lastSavedAt: string;
  leftMargin?: number;
  rightMargin?: number;
}

interface StudentWorkspaceProps {
  triggerToast: (msg: string) => void;
}

export function StudentWorkspace({ triggerToast }: StudentWorkspaceProps) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);

  // Document canvas states
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [leftMargin, setLeftMargin] = useState(1.0); // in inches
  const [rightMargin, setRightMargin] = useState(1.0); // in inches

  // Editor choices states
  const [activeFont, setActiveFont] = useState("Arial");
  const [activeFontSize, setActiveFontSize] = useState("11");
  const [textColor, setTextColor] = useState("#000000");
  const [highlightColor, setHighlightColor] = useState("transparent");
  const [targetMilestone, setTargetMilestone] = useState("Chapter 1-3 Submission");

  const editorRef = useRef<HTMLDivElement>(null);

  const fontOptions = ["Arial", "Times New Roman", "Courier New", "Georgia", "Verdana", "Impact", "Comic Sans MS"];
  const fontSizeOptions = ["9", "10", "11", "12", "14", "16", "18", "24", "30", "36"];
  const milestonesList = [
    "Proposal Outline Selection",
    "Chapter 1-3 Submission",
    "Ethics Clearance Review",
    "Pre-Defense Presentation",
    "Final Oral Defense"
  ];

  // Sync documents list from localStorage
  const syncDocs = () => {
    const stored = localStorage.getItem("advisio_student_documents");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Purge any legacy default placeholder docs
        const filtered = Array.isArray(parsed)
          ? parsed.filter((d) => d.id !== "doc-default" && !d.title?.includes("Chapter 3 Methodology Draft"))
          : [];
        if (Array.isArray(parsed) && filtered.length !== parsed.length) {
          localStorage.setItem("advisio_student_documents", JSON.stringify(filtered));
        }
        setDocuments(filtered);
        if (filtered.length > 0 && !activeDocId) {
          loadDoc(filtered[0]);
        }
      } catch (e) {
        setDocuments([]);
      }
    } else {
      setDocuments([]);
    }
  };

  useEffect(() => {
    syncDocs();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "advisio_student_documents") {
        syncDocs();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const loadDoc = (doc: StudentDocument) => {
    setActiveDocId(doc.id);
    setDocTitle(doc.title);
    setDocContent(doc.content);
    setLeftMargin(doc.leftMargin ?? 1.0);
    setRightMargin(doc.rightMargin ?? 1.0);

    if (editorRef.current) {
      editorRef.current.innerHTML = doc.content;
    }
  };

  const handleNewDoc = () => {
    setActiveDocId(null);
    setDocTitle("");
    setDocContent("");
    setLeftMargin(1.0);
    setRightMargin(1.0);
    if (editorRef.current) {
      editorRef.current.innerHTML = "";
    }
    triggerToast("Created new document sheet.");
  };

  const handleSaveDoc = () => {
    if (!docTitle.trim()) {
      triggerToast("Please provide a title for the document.");
      return;
    }

    const currentContent = editorRef.current?.innerHTML || "";
    const docId = activeDocId || "doc-" + Date.now();
    const updatedDoc: StudentDocument = {
      id: docId,
      title: docTitle.trim(),
      content: currentContent,
      leftMargin,
      rightMargin,
      lastSavedAt: new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    };

    const newDocs = [...documents];
    const index = documents.findIndex(d => d.id === docId);
    if (index >= 0) {
      newDocs[index] = updatedDoc;
    } else {
      newDocs.push(updatedDoc);
    }

    localStorage.setItem("advisio_student_documents", JSON.stringify(newDocs));
    setDocuments(newDocs);
    setActiveDocId(docId);
    triggerToast(`Document "${docTitle}" saved.`);
  };

  const handleDeleteDoc = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = documents.filter(d => d.id !== id);
    localStorage.setItem("advisio_student_documents", JSON.stringify(filtered));
    setDocuments(filtered);
    if (activeDocId === id) {
      setActiveDocId(null);
      setDocTitle("");
      setDocContent("");
      setLeftMargin(1.0);
      setRightMargin(1.0);
      if (editorRef.current) {
        editorRef.current.innerHTML = "";
      }
    }
    triggerToast("Document deleted.");
  };

  const handleDownloadDoc = () => {
    if (!docTitle.trim()) {
      triggerToast("Cannot download untitled document.");
      return;
    }
    const content = editorRef.current?.innerText || "";
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${docTitle.trim().replace(/\s+/g, "_")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    triggerToast("Downloading document txt export.");
  };

  const handleOneTapSubmit = async () => {
    if (!docTitle.trim()) {
      triggerToast("Please enter a document title first.");
      return;
    }

    // 1. Attempt live API submission
    try {
      const researchList = await apiClient.get<{ projects: any[] }>("/api/research").catch(() => ({ projects: [] }));
      const project = researchList.projects?.[0];
      if (project) {
        await apiClient.post(`/api/research/${project.id}/documents`, {
          title: docTitle.trim(),
          documentType: targetMilestone,
          content: docContent,
          leftMargin,
          rightMargin,
          targetMilestone,
        });
      }
    } catch (e) {
      console.warn("Backend unavailable, using local persistence.");
    }

    // 2. Submit to local submissions system
    const newSubmission = {
      id: "sub-" + Date.now(),
      docName: `${docTitle.trim()} (System Workspace)`,
      milestone: targetMilestone,
      date: new Date().toISOString().split("T")[0],
      version: `v1.${Math.floor(Math.random() * 9) + 1}`,
      status: "pending"
    };

    const storedSubmissions = localStorage.getItem("advisio_student_submissions");
    let submissionsList = [];
    if (storedSubmissions) {
      try { submissionsList = JSON.parse(storedSubmissions); } catch(e) {}
    }
    submissionsList.unshift(newSubmission);
    localStorage.setItem("advisio_student_submissions", JSON.stringify(submissionsList));

    // 3. Alert Adviser
    const storedChat = localStorage.getItem("advisio_chat_store");
    if (storedChat) {
      try {
        const store = JSON.parse(storedChat);
        const studentName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "Student";
        store.notifications.push({
          id: "notif-" + Math.random().toString(36).substr(2, 9),
          userId: "adviser@university.edu.ph",
          msg: `${studentName} submitted a workspace document for "${targetMilestone}" verification.`,
          date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
          read: false
        });
        localStorage.setItem("advisio_chat_store", JSON.stringify(store));
      } catch (e) {}
    }

    triggerToast(`Submitted "${docTitle}" directly to "${targetMilestone}"!`);
  };

  // Google Docs Command Execs
  const execCmd = (cmd: string, val: string = "") => {
    document.execCommand(cmd, false, val);
    triggerToast(`Applied format option.`);
  };

  const handleFontChange = (font: string) => {
    setActiveFont(font);
    execCmd("fontName", font);
  };

  const handleFontSizeChange = (size: string) => {
    setActiveFontSize(size);
    // document.execCommand font size uses 1-7 mappings, we can set style directly or use execCommand
    execCmd("fontSize", size);
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTextColor(e.target.value);
    execCmd("foreColor", e.target.value);
  };

  const handleHighlightChange = (color: string) => {
    setHighlightColor(color);
    execCmd("hiliteColor", color);
  };

  // Draggable Ruler Logic
  const handleDragLeft = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startMargin = leftMargin;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const diffX = moveEvent.clientX - startX;
      const diffInches = diffX / 96; // 96 DPI
      let newMargin = Math.max(0.5, Math.min(3.0, startMargin + diffInches));
      newMargin = Math.round(newMargin * 10) / 10;
      setLeftMargin(newMargin);
    };
    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleDragRight = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startMargin = rightMargin;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const diffX = startX - moveEvent.clientX; // drag left increases margin
      const diffInches = diffX / 96;
      let newMargin = Math.max(0.5, Math.min(3.0, startMargin + diffInches));
      newMargin = Math.round(newMargin * 10) / 10;
      setRightMargin(newMargin);
    };
    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Build ruler markings ticks
  const rulerTicks = [];
  for (let i = 0; i <= 8.5; i += 0.25) {
    rulerTicks.push(i);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in text-slate-800">
      
      {/* LEFT COLUMN: Saved Files directory (3 cols) */}
      <div className="lg:col-span-3 flex flex-col gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-[#1b4264] text-[13px] flex items-center gap-1.5">
              <i className="ti ti-folder text-[#ffa400]" />
              Docs Directory
            </h3>
            <button
              onClick={handleNewDoc}
              className="px-2 py-0.5 text-[9.5px] font-extrabold bg-[#ffa400] text-[#1b4264] hover:bg-[#e09000] border border-[#ffa400] rounded transition cursor-pointer"
            >
              + Create
            </button>
          </div>

          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
            {documents.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-[11px] italic">No saved documents.</div>
            ) : (
              documents.map((doc) => {
                const isActive = doc.id === activeDocId;
                return (
                  <div
                    key={doc.id}
                    onClick={() => loadDoc(doc)}
                    className={`p-2.5 border rounded-lg flex justify-between items-center cursor-pointer transition-all ${
                      isActive
                        ? "bg-[#1b4264] text-white border-[#1b4264]"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-[11px] block truncate">{doc.title}</span>
                      <span className={`text-[8.5px] ${isActive ? "text-slate-200" : "text-slate-400"} block mt-0.5`}>
                        {doc.lastSavedAt}
                      </span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteDoc(doc.id, e)}
                      className="p-0.5 hover:bg-white/10 text-red-500 rounded cursor-pointer ml-1.5"
                    >
                      <i className="ti ti-trash text-xs" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Google Docs Editor (9 cols) */}
      <div className="lg:col-span-9 flex flex-col gap-4">
        
        {/* Editor Wrapper Container */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          
          {/* Header Panel: Document Title and Action Buttons */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
            <div className="flex items-center gap-2 flex-1">
              <i className="ti ti-file-text text-[#1b4264] text-xl" />
              <input
                type="text"
                placeholder="Untitled document"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="bg-transparent font-bold text-slate-800 text-[14px] focus:outline-none focus:bg-white border border-transparent focus:border-slate-200 rounded px-1.5 py-0.5 flex-1 max-w-sm transition-all"
              />
            </div>
            
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleSaveDoc}
                className="px-3.5 py-1.5 bg-[#ffa400] text-[#1b4264] hover:bg-[#e09000] font-extrabold rounded-lg text-xs border border-[#ffa400] shadow-sm transition cursor-pointer flex items-center gap-1"
              >
                <i className="ti ti-device-floppy" /> Save Document
              </button>
              <button
                onClick={handleDownloadDoc}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-xs transition cursor-pointer flex items-center gap-1"
              >
                <i className="ti ti-download" /> TXT Export
              </button>
            </div>
          </div>

          {/* Google Docs Toolbar */}
          <div className="px-4 py-1.5 bg-slate-100 border-b border-slate-200 flex flex-wrap gap-1.5 items-center text-slate-650">
            {/* Undo / Redo */}
            <button onClick={() => execCmd("undo")} className="p-1 hover:bg-slate-250 rounded transition cursor-pointer text-sm" title="Undo"><i className="ti ti-arrow-back-up" /></button>
            <button onClick={() => execCmd("redo")} className="p-1 hover:bg-slate-250 rounded transition cursor-pointer text-sm" title="Redo"><i className="ti ti-arrow-forward-up" /></button>
            <div className="w-px h-4 bg-slate-300 mx-1" />

            {/* Font family */}
            <select
              value={activeFont}
              onChange={(e) => handleFontChange(e.target.value)}
              className="bg-white border border-slate-300 rounded px-2 py-0.5 text-[11px] focus:outline-none focus:border-slate-400 font-medium cursor-pointer"
            >
              {fontOptions.map(font => (
                <option key={font} value={font}>{font}</option>
              ))}
            </select>

            {/* Font size */}
            <select
              value={activeFontSize}
              onChange={(e) => handleFontSizeChange(e.target.value)}
              className="bg-white border border-slate-300 rounded px-1 py-0.5 text-[11px] focus:outline-none focus:border-slate-400 font-medium cursor-pointer"
            >
              {fontSizeOptions.map(size => (
                <option key={size} value={size}>{size}pt</option>
              ))}
            </select>
            <div className="w-px h-4 bg-slate-300 mx-1" />

            {/* Bold / Italic / Underline / Strike */}
            <button onClick={() => execCmd("bold")} className="p-1 hover:bg-slate-250 rounded transition cursor-pointer font-extrabold text-xs px-1.5" title="Bold">B</button>
            <button onClick={() => execCmd("italic")} className="p-1 hover:bg-slate-250 rounded transition cursor-pointer italic text-xs px-1.5 font-serif" title="Italic">I</button>
            <button onClick={() => execCmd("underline")} className="p-1 hover:bg-slate-250 rounded transition cursor-pointer underline text-xs px-1.5" title="Underline">U</button>
            <button onClick={() => execCmd("strikeThrough")} className="p-1 hover:bg-slate-250 rounded transition cursor-pointer line-through text-xs px-1.5" title="Strikethrough">S</button>
            <div className="w-px h-4 bg-slate-300 mx-1" />

            {/* Forecolor */}
            <div className="flex items-center gap-1 relative" title="Text Color">
              <i className="ti ti-palette text-xs" />
              <input
                type="color"
                value={textColor}
                onChange={handleColorChange}
                className="w-5 h-5 border-none p-0 cursor-pointer bg-transparent"
              />
            </div>

            {/* Highlight color picker */}
            <select
              value={highlightColor}
              onChange={(e) => handleHighlightChange(e.target.value)}
              className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[10px] focus:outline-none cursor-pointer"
              title="Highlight Color"
            >
              <option value="transparent">No Highlight</option>
              <option value="yellow">Yellow</option>
              <option value="cyan">Cyan</option>
              <option value="lime">Lime</option>
              <option value="pink">Pink</option>
            </select>
            <div className="w-px h-4 bg-slate-300 mx-1" />

            {/* Alignments */}
            <button onClick={() => execCmd("justifyLeft")} className="p-1 hover:bg-slate-250 rounded transition cursor-pointer text-sm" title="Align Left"><i className="ti ti-align-left" /></button>
            <button onClick={() => execCmd("justifyCenter")} className="p-1 hover:bg-slate-250 rounded transition cursor-pointer text-sm" title="Align Center"><i className="ti ti-align-center" /></button>
            <button onClick={() => execCmd("justifyRight")} className="p-1 hover:bg-slate-250 rounded transition cursor-pointer text-sm" title="Align Right"><i className="ti ti-align-right" /></button>
            <button onClick={() => execCmd("justifyFull")} className="p-1 hover:bg-slate-250 rounded transition cursor-pointer text-sm" title="Justify"><i className="ti ti-align-justified" /></button>
            <div className="w-px h-4 bg-slate-300 mx-1" />

            {/* Lists */}
            <button onClick={() => execCmd("insertUnorderedList")} className="p-1 hover:bg-slate-250 rounded transition cursor-pointer text-sm" title="Bulleted List"><i className="ti ti-list" /></button>
            <button onClick={() => execCmd("insertOrderedList")} className="p-1 hover:bg-slate-250 rounded transition cursor-pointer text-sm" title="Numbered List"><i className="ti ti-list-numbers" /></button>
            <button onClick={() => execCmd("removeFormat")} className="p-1 hover:bg-red-50 text-red-500 rounded transition cursor-pointer text-sm" title="Clear Formatting"><i className="ti ti-clear-formatting" /></button>
          </div>

          {/* Google Docs Canvas containing Ruler and A4 Sheet */}
          <div className="bg-slate-150 py-6 overflow-y-auto flex flex-col items-center h-[550px] min-h-[400px] border-b border-slate-200 relative">
            
            {/* Horizontal Ruler Strip (816px wide corresponding to A4) */}
            <div className="w-[816px] h-6 bg-white border-b border-slate-200 relative select-none flex items-end pb-0.5 flex-shrink-0 shadow-sm rounded-t">
              
              {/* Ruler Markings every 0.25 inches (1 inch = 96 pixels) */}
              {rulerTicks.map((val) => {
                const isInch = val % 1 === 0;
                const isHalf = val % 0.5 === 0;
                const pos = val * 96;
                return (
                  <div
                    key={val}
                    style={{ left: `${pos}px` }}
                    className={`absolute bottom-0 flex flex-col items-center ${
                      isInch ? "h-3" : isHalf ? "h-2" : "h-1"
                    } border-l border-slate-400`}
                  >
                    {isInch && val > 0 && val < 8.5 && (
                      <span className="text-[7.5px] font-bold text-slate-500 absolute -top-3.5 -translate-x-1/2">
                        {val}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Left Margin Indicator Marker (Draggable) */}
              <div
                onMouseDown={handleDragLeft}
                style={{ left: `${leftMargin * 96}px` }}
                className="absolute bottom-0 w-3 h-3.5 bg-blue-600 hover:bg-blue-700 cursor-col-resize -translate-x-1/2 flex flex-col items-center justify-end shadow-sm"
                title={`Left Margin: ${leftMargin} in`}
              >
                <span className="w-1 h-2 bg-white rounded-full mb-0.5" />
              </div>

              {/* Right Margin Indicator Marker (Draggable) */}
              <div
                onMouseDown={handleDragRight}
                style={{ left: `${816 - (rightMargin * 96)}px` }}
                className="absolute bottom-0 w-3 h-3.5 bg-blue-600 hover:bg-blue-700 cursor-col-resize -translate-x-1/2 flex flex-col items-center justify-end shadow-sm"
                title={`Right Margin: ${rightMargin} in`}
              >
                <span className="w-1 h-2 bg-white rounded-full mb-0.5" />
              </div>

            </div>

            {/* A4 Sheet Container */}
            <div
              id="doc-editor-page"
              style={{
                width: "816px",
                minHeight: "1056px",
                paddingLeft: `${leftMargin}in`,
                paddingRight: `${rightMargin}in`,
                paddingTop: "1.0in",
                paddingBottom: "1.0in"
              }}
              className="bg-white shadow-xl border border-slate-300/40 relative text-left mt-2 flex flex-col flex-shrink-0"
            >
              {/* Rich-Text Editable Body */}
              <div
                id="doc-editor-content"
                ref={editorRef}
                contentEditable
                className="w-full flex-1 focus:outline-none text-slate-800 text-[13px] leading-relaxed border-none outline-none font-sans min-h-[864px]"
                onInput={() => {
                  if (editorRef.current) {
                    setDocContent(editorRef.current.innerHTML);
                  }
                }}
              />
            </div>

          </div>

          {/* Document Footer: Target Selector and Direct Submit */}
          <div className="p-3 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row gap-3 justify-between items-center">
            
            <div className="flex items-center gap-2 text-xs">
              <span className="font-extrabold text-[#1b4264] text-[11px] uppercase tracking-wider">
                Select Submission Milestone:
              </span>
              <select
                value={targetMilestone}
                onChange={(e) => setTargetMilestone(e.target.value)}
                className="bg-white border border-slate-350 rounded-lg p-1.5 focus:outline-none text-[11px] font-semibold cursor-pointer"
              >
                {milestonesList.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleOneTapSubmit}
              className="w-full sm:w-auto px-4 py-2 bg-[#1b4264] text-white hover:bg-slate-800 font-extrabold rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1.5 border border-[#1b4264] shadow-md"
            >
              <i className="ti ti-circle-check text-[#ffa400] text-sm animate-pulse" />
              1-Tap Submit to System
            </button>
            
          </div>

        </div>
      </div>

    </div>
  );
}
