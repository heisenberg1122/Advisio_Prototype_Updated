"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function SetupFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get query params
  const role = searchParams.get("role") || "student";
  const initialEmail = searchParams.get("email") || "";

  // Form states
  const [fullName, setFullName] = useState("");
  const [contact, setContact] = useState("");
  const [department, setDepartment] = useState("");
  const [course, setCourse] = useState("");
  const [interest, setInterest] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [agreedToa, setAgreedToa] = useState(false);
  const [showToaModal, setShowToaModal] = useState(false);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoPreview(URL.createObjectURL(file));
    } else {
      setPhotoPreview("https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80");
    }
  };

  const handleCompleteSetup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToa) {
      alert("Please agree to the university's Terms of Agreement (TOA) before entering the portal.");
      return;
    }
    // Redirect to the correct role dashboard based on selected role
    if (role === "adviser") {
      router.push("/adviser/dashboard");
    } else if (role === "professor") {
      router.push("/professor/dashboard");
    } else if (role === "panelist") {
      router.push("/panelist/dashboard");
    } else {
      router.push("/student/dashboard");
    }
  };

  return (
    <>
      <div className="w-full max-w-[560px] bg-white rounded-2xl border border-slate-200/80 p-8 md:p-10 shadow-xl flex flex-col gap-6 animate-fade-in-up">
        
        {/* Brand Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1b4264] flex items-center justify-center shadow-md">
              <i className="ti ti-school text-lg text-[#ffa400]" />
            </div>
            <div>
              <span className="font-extrabold text-[18px] tracking-tight block leading-none text-[#1b4264]">ADVISIO</span>
              <span className="text-[9px] uppercase tracking-widest text-[#ffa400] font-extrabold">Research Management</span>
            </div>
          </div>
          <span className="text-[11px] font-extrabold text-[#1b4264] uppercase tracking-wider bg-[#1b4264]/5 px-3 py-1 rounded-full border border-[#1b4264]/10">
            Account Profile Setup
          </span>
        </div>

        {/* Title */}
        <div>
          <div className="inline-flex items-center gap-1.5 bg-[#ffa400]/15 text-[#1b4264] px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold uppercase tracking-wide border border-[#ffa400]/30 mb-2">
            <i className="ti ti-user-check" />
            <span>Profile Personalization</span>
          </div>
          <h1 className="text-[24px] font-extrabold text-[#1b4264] tracking-tight">Complete Your Profile</h1>
          <p className="mt-1 text-[13px] text-slate-500">
            Configure your academic affiliation and research focus before entering the dashboard.
          </p>
        </div>

        <form onSubmit={handleCompleteSetup} className="flex flex-col gap-5">
          
          {/* Profile Photo Uploader Row */}
          <div className="flex items-center gap-4 bg-[#1b4264]/5 p-4 rounded-xl border border-[#1b4264]/15">
            <div className="w-16 h-16 rounded-full bg-white border-2 border-[#1b4264]/20 flex items-center justify-center text-slate-400 overflow-hidden relative shadow-sm shrink-0">
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <i className="ti ti-user text-2xl text-[#1b4264]/50" />
              )}
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-extrabold text-[#1b4264]">Institutional Identification Photo</div>
              <p className="text-[11px] text-slate-500 mt-0.5">Upload a formal university identification or profile portrait.</p>
              <div className="flex items-center gap-2 mt-2">
                <input 
                  type="file" 
                  accept="image/*"
                  id="photo-upload" 
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                <label 
                  htmlFor="photo-upload" 
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-300 rounded-lg text-[11.5px] font-bold text-[#1b4264] hover:bg-slate-50 transition cursor-pointer select-none shadow-xs"
                >
                  <i className="ti ti-camera" />
                  <span>Choose Photo</span>
                </label>
                {photoPreview && (
                  <button
                    type="button"
                    onClick={() => setPhotoPreview(null)}
                    className="text-[11px] text-slate-400 hover:text-red-500 transition cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Full Name & Contact Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="full-name" className="text-[11px] font-bold text-[#1b4264] uppercase tracking-wider">
                Full Name
              </label>
              <input 
                id="full-name"
                type="text" 
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="First Middle Last"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[13.5px] text-slate-900 focus:outline-none focus:border-[#ffa400] focus:ring-1 focus:ring-[#ffa400] transition-colors placeholder:text-slate-400"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="contact" className="text-[11px] font-bold text-[#1b4264] uppercase tracking-wider">
                Contact Number
              </label>
              <input 
                id="contact"
                type="tel" 
                required
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="e.g. +63 917 123 4567"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[13.5px] text-slate-900 focus:outline-none focus:border-[#ffa400] focus:ring-1 focus:ring-[#ffa400] transition-colors placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Department & Course/Program */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="dept" className="text-[11px] font-bold text-[#1b4264] uppercase tracking-wider">
                {role === "adviser" ? "Faculty Department" : "College / Department"}
              </label>
              <select 
                id="dept"
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[13.5px] text-slate-900 focus:outline-none focus:border-[#ffa400] focus:ring-1 focus:ring-[#ffa400] transition-colors"
              >
                <option value="">Select Department</option>
                <option value="Computer Science">Computer Science</option>
                <option value="Information Technology">Information Technology</option>
                <option value="Information Systems">Information Systems</option>
                <option value="Software Engineering">Software Engineering</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="course" className="text-[11px] font-bold text-[#1b4264] uppercase tracking-wider">
                {role === "adviser" ? "Designation / Academic Rank" : "Degree Program"}
              </label>
              <input 
                id="course"
                type="text" 
                required
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                placeholder={role === "adviser" ? "e.g. Associate Professor / MSCS" : "e.g. BSCS - Data Science"}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[13.5px] text-slate-900 focus:outline-none focus:border-[#ffa400] focus:ring-1 focus:ring-[#ffa400] transition-colors placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Research Interest / Specialization Area */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="interest" className="text-[11px] font-bold text-[#1b4264] uppercase tracking-wider">
              {role === "adviser" ? "Research Advising Interests & Specializations" : "Thesis Focus & Technical Interest Areas"}
            </label>
            <textarea 
              id="interest"
              rows={3}
              required
              value={interest}
              onChange={(e) => setInterest(e.target.value)}
              placeholder={role === "adviser" ? "e.g. Computer Vision, Machine Learning, IoT Sensors, Agritech" : "e.g. Deep Learning in Crop Disease Detection, Natural Language Processing"}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[13.5px] text-slate-900 focus:outline-none focus:border-[#ffa400] focus:ring-1 focus:ring-[#ffa400] transition-colors placeholder:text-slate-400 resize-none"
            />
          </div>

          {/* TOA Checkbox */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start gap-2.5">
            <input 
              id="setup-toa"
              type="checkbox"
              checked={agreedToa}
              onChange={(e) => setAgreedToa(e.target.checked)}
              className="w-4 h-4 mt-0.5 text-[#1b4264] border-slate-300 rounded focus:ring-[#ffa400] focus:ring-0 focus:ring-offset-0 cursor-pointer shrink-0"
            />
            <label htmlFor="setup-toa" className="text-[12px] text-slate-700 leading-snug cursor-pointer select-none">
              I agree to the university's{" "}
              <button
                type="button"
                onClick={() => setShowToaModal(true)}
                className="font-bold text-[#1b4264] underline hover:text-[#ffa400] transition cursor-pointer"
              >
                Terms of Agreement (TOA)
              </button>
              {" "}and adhere to academic research integrity standards.
            </label>
          </div>

          {/* Complete Setup Button */}
          <button 
            type="submit"
            className="w-full mt-2 bg-[#ffa400] hover:bg-[#e09000] text-[#1b4264] py-3 rounded-xl text-[14px] font-extrabold shadow-md active:scale-[0.98] transition cursor-pointer flex items-center justify-center gap-2"
          >
            <i className="ti ti-layout-dashboard text-base" />
            <span>Complete Setup & Enter Dashboard</span>
          </button>

        </form>
        
      </div>

      {/* TOA MODAL */}
      {showToaModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-scale-up">
            
            {/* Header */}
            <div className="bg-[#1b4264] text-white p-5 flex items-center justify-between border-b border-[#15344f]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center border border-white/20">
                  <i className="ti ti-file-certificate text-xl text-[#ffa400]" />
                </div>
                <div>
                  <h3 className="text-[16px] font-extrabold leading-tight">Terms of Agreement & Academic Integrity (TOA)</h3>
                  <span className="text-[11px] text-[#ffa400] font-semibold">Institutional Policy v2026.1 • Campus Research Office</span>
                </div>
              </div>
              <button 
                onClick={() => setShowToaModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer"
              >
                <i className="ti ti-x text-lg" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto text-[13px] text-slate-700 leading-relaxed flex flex-col gap-4">
              <div className="bg-[#1b4264]/5 border border-[#1b4264]/15 rounded-xl p-3.5 text-[#1b4264]">
                <strong className="block font-bold mb-0.5">Academic Compliance Notice:</strong>
                All research deliverables, document versions, consultation Google Meets, and defense grade sheets on Advisio are monitored for university compliance.
              </div>

              <div>
                <h4 className="font-extrabold text-[#1b4264] text-[13.5px] uppercase tracking-wider mb-1">
                  1. Identity Verification & Administrator Oversight
                </h4>
                <p className="text-slate-600">
                  Accounts on Advisio are governed by the institution. Verification and administrative actions are handled by <span className="font-mono text-[#1b4264] font-semibold">admin01@university.edu.ph</span>.
                </p>
              </div>

              <div>
                <h4 className="font-extrabold text-[#1b4264] text-[13.5px] uppercase tracking-wider mb-1">
                  2. Intellectual Property Rights
                </h4>
                <p className="text-slate-600">
                  Student groups retain copyright over original methodologies, while the university retains archival and academic publication repository rights.
                </p>
              </div>

              <div>
                <h4 className="font-extrabold text-[#1b4264] text-[13.5px] uppercase tracking-wider mb-1">
                  3. Research Ethics & Data Integrity
                </h4>
                <p className="text-slate-600">
                  Falsification of dataset records, unapproved surveys, plagiarism, or AI-generated ghostwriting are strictly prohibited under university research conduct codes.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between gap-3">
              <span className="text-[11.5px] text-slate-500">
                Official Campus Research Policy
              </span>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowToaModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-[12.5px] font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAgreedToa(true);
                    setShowToaModal(false);
                  }}
                  className="px-5 py-2 bg-[#ffa400] hover:bg-[#e09000] text-[#1b4264] rounded-lg text-[12.5px] font-extrabold shadow transition cursor-pointer"
                >
                  I Understand & Accept Terms
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}

export default function FirstTimeSetupPage() {
  return (
    <div className="min-h-screen bg-[#f4f7fa] flex items-center justify-center p-6 text-slate-800 font-sans relative overflow-hidden">
      {/* Background subtle grid pattern matching login */}
      <div className="absolute inset-0 opacity-40 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      
      <Suspense fallback={
        <div className="flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin border-[#ffa400]" />
        </div>
      }>
        <div className="relative z-10 w-full flex justify-center">
          <SetupFormContent />
        </div>
      </Suspense>
    </div>
  );
}
