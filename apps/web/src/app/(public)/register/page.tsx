"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [universityId, setUniversityId] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("RESEARCHER");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);

  // TOA Modal State
  const [showToaModal, setShowToaModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredUser, setRegisteredUser] = useState<{
    name: string;
    email: string;
    universityId: string;
    role: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError("Please provide your full first and last name.");
      return;
    }

    if (!universityId.trim()) {
      setError("University / Student ID is required.");
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid institutional email address.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!agreed) {
      setError("You must review and agree to the Terms of Agreement (TOA) to proceed.");
      return;
    }

    setLoading(true);

    try {
      const res = await register({
        universityId: universityId.trim(),
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password,
        role,
      });

      if (!res.success) {
        setError(res.error || "Failed to register account.");
        setLoading(false);
        return;
      }

      setRegisteredUser({
        name: `${firstName.trim()} ${lastName.trim()}`,
        email: email.trim(),
        universityId: universityId.trim(),
        role: role === "ADVISER" ? "Faculty / Research Adviser" : "Student / Researcher",
      });
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during registration.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7fa] flex flex-col md:flex-row text-slate-800 font-sans">
      
      {/* ─── LEFT COLUMN: ADVISIO HERO (40% width) ─── */}
      <div 
        className="w-full md:w-[42%] bg-[#1b4264] text-white p-8 md:p-12 flex flex-col justify-between border-r border-[#15344f] select-none relative overflow-hidden shrink-0"
      >
        {/* Background subtle amber grid */}
        <div className="absolute inset-0 opacity-5 bg-[linear-gradient(to_right,#ffa400_1px,transparent_1px),linear-gradient(to_bottom,#ffa400_1px,transparent_1px)] bg-[size:30px_30px]" />
        
        {/* Branding */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shadow-lg backdrop-blur-sm">
            <i className="ti ti-school text-2xl text-[#ffa400]" />
          </div>
          <div>
            <span className="font-extrabold text-[22px] tracking-tight block leading-none text-white">ADVISIO</span>
            <span className="text-[10px] uppercase tracking-widest text-[#ffa400] font-semibold">Research Portal</span>
          </div>
        </div>

        {/* Center Institutional Security Content */}
        <div className="relative z-10 my-10 md:my-auto flex flex-col gap-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-[#ffa400]/15 text-[#ffa400] px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border border-[#ffa400]/30 mb-3">
              <i className="ti ti-shield-lock" />
              <span>Institutional Gatekeeper</span>
            </div>
            <h2 className="text-[28px] md:text-[32px] font-bold leading-tight tracking-tight text-white">
              Create Your Research Account
            </h2>
            <div className="h-1.5 w-16 bg-[#ffa400] rounded-full mt-3" />
            <p className="text-slate-200 text-[13.5px] mt-3.5 leading-relaxed font-light">
              Advisio is the official university platform for managing capstone research, thesis manuscripts, consultations, and panel defenses.
            </p>
          </div>

          {/* Verification Protocol Box */}
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10 backdrop-blur-md shadow-inner flex flex-col gap-3.5">
            <div className="text-[11px] uppercase tracking-wider text-[#ffa400] font-bold flex items-center justify-between">
              <span>Security & Verification Protocol</span>
              <span className="w-2 h-2 rounded-full bg-[#ffa400] animate-pulse" />
            </div>
            
            <div className="flex gap-3 text-[12.5px] text-slate-200">
              <div className="w-6 h-6 rounded-full bg-[#ffa400]/20 text-[#ffa400] flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                1
              </div>
              <div>
                <h4 className="font-bold text-white">Registration Submission</h4>
                <p className="text-[11px] text-slate-300 font-light mt-0.5">
                  Submit credentials with your university ID and institutional email.
                </p>
              </div>
            </div>

            <div className="flex gap-3 text-[12.5px] text-slate-200">
              <div className="w-6 h-6 rounded-full bg-[#ffa400]/20 text-[#ffa400] flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                2
              </div>
              <div>
                <h4 className="font-bold text-white">Administrator Verification</h4>
                <p className="text-[11px] text-slate-300 font-light mt-0.5">
                  Your identity is cross-checked and approved by <strong className="text-[#ffa400] font-mono">admin01@university.edu.ph</strong>.
                </p>
              </div>
            </div>

            <div className="flex gap-3 text-[12.5px] text-slate-200">
              <div className="w-6 h-6 rounded-full bg-[#ffa400]/20 text-[#ffa400] flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                3
              </div>
              <div>
                <h4 className="font-bold text-white">Active Research Access</h4>
                <p className="text-[11px] text-slate-300 font-light mt-0.5">
                  Sign in to collaborate on documents, book advising Google Meets, and schedule committee defenses.
                </p>
              </div>
            </div>
          </div>

          {/* Quick policy tags */}
          <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
            <span className="bg-white/10 px-2.5 py-1 rounded-md border border-white/10 flex items-center gap-1.5">
              <i className="ti ti-check text-[#ffa400]" /> Student & Faculty Roster
            </span>
            <span className="bg-white/10 px-2.5 py-1 rounded-md border border-white/10 flex items-center gap-1.5">
              <i className="ti ti-check text-[#ffa400]" /> Anti-Plagiarism Safeguards
            </span>
            <span className="bg-white/10 px-2.5 py-1 rounded-md border border-white/10 flex items-center gap-1.5">
              <i className="ti ti-check text-[#ffa400]" /> End-to-End Audit Logs
            </span>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 border-t border-white/10 pt-4 text-[11px] text-slate-300 flex justify-between">
          <span>Advisio Portal v1.0</span>
          <span>Administrator: admin01@university.edu.ph</span>
        </div>

      </div>

      {/* ─── RIGHT COLUMN: ELEVATED CARD CONTAINER (58% width) ─── */}
      <div className="w-full md:w-[58%] p-6 md:p-12 flex flex-col justify-center items-center overflow-y-auto">
        <div className="w-full max-w-[500px] flex flex-col gap-6 my-auto animate-fade-in-up">
          
          {registeredUser ? (
            /* ─── SUCCESS / PENDING VERIFICATION CARD ─── */
            <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-xl relative overflow-hidden text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-[#ffa400]/15 border border-[#ffa400]/30 text-[#1b4264] flex items-center justify-center text-3xl mb-4 shadow-sm">
                <i className="ti ti-clock-check text-[#ffa400]" />
              </div>

              <div className="inline-flex items-center gap-1.5 bg-[#ffa400]/15 text-[#1b4264] text-[11px] font-extrabold uppercase tracking-wider rounded-full px-3 py-1 border border-[#ffa400]/30 mb-2">
                <span className="w-2 h-2 rounded-full bg-[#ffa400] animate-pulse" />
                <span>Pending Admin Verification</span>
              </div>

              <h2 className="text-[24px] font-extrabold text-[#1b4264] tracking-tight">
                Registration Submitted!
              </h2>

              <p className="text-[13px] text-slate-600 mt-2 leading-relaxed max-w-md">
                Account created for <strong className="text-slate-900 font-bold">{registeredUser.name}</strong>. Your profile has been queued for verification.
              </p>

              {/* Summary Table */}
              <div className="w-full bg-slate-50 rounded-xl border border-slate-200 p-4 mt-5 text-left text-[12.5px] flex flex-col gap-2.5">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Applicant Name</span>
                  <span className="font-bold text-[#1b4264]">{registeredUser.name}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Email Address</span>
                  <span className="font-bold text-[#1b4264]">{registeredUser.email}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">University ID</span>
                  <span className="font-bold text-slate-700">{registeredUser.universityId}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Selected Role</span>
                  <span className="font-bold text-slate-700">{registeredUser.role}</span>
                </div>
                <div className="flex justify-between items-center pt-0.5">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Assigned Verifier</span>
                  <span className="text-[11px] font-extrabold text-[#1b4264] bg-[#ffa400]/15 px-2 py-0.5 rounded border border-[#ffa400]/30">
                    admin01@university.edu.ph
                  </span>
                </div>
              </div>

              {/* Instructions banner */}
              <div className="w-full bg-amber-50 border border-amber-200 rounded-xl p-3.5 mt-4 text-[12px] text-amber-900 text-left flex items-start gap-2.5">
                <i className="ti ti-info-circle text-amber-600 text-base shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong className="block font-bold">What happens next?</strong>
                  The system administrator (<strong className="font-semibold">admin01@university.edu.ph</strong>) will review and approve your registration. Once approved, you can immediately sign in with your password.
                </div>
              </div>

              {/* Actions */}
              <div className="w-full flex flex-col gap-2 mt-6">
                <Link
                  href="/login"
                  className="w-full bg-[#1b4264] hover:bg-[#15344f] text-white py-3 rounded-xl text-[13px] font-bold shadow-md text-center transition cursor-pointer"
                >
                  Return to Sign In
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setRegisteredUser(null);
                    setFirstName("");
                    setLastName("");
                    setEmail("");
                    setUniversityId("");
                    setPassword("");
                    setConfirmPassword("");
                    setAgreed(false);
                  }}
                  className="text-[12px] text-slate-500 hover:text-[#1b4264] transition py-1 cursor-pointer"
                >
                  Register another account
                </button>
              </div>
            </div>
          ) : (
            /* ─── REGISTRATION CARD (ELEVATED) ─── */
            <div className="bg-white rounded-2xl border border-slate-200/80 p-8 md:p-10 shadow-xl relative overflow-hidden">
              
              {/* Header */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <div className="w-10 h-10 rounded-xl bg-[#1b4264] flex items-center justify-center shadow-md">
                    <i className="ti ti-user-plus text-[#ffa400] text-xl" />
                  </div>
                  <span className="text-[11px] font-bold text-[#1b4264] uppercase tracking-wider bg-[#1b4264]/5 px-2.5 py-1 rounded-full border border-[#1b4264]/10">
                    Step 1 of 2
                  </span>
                </div>
                <h2 className="text-[24px] font-extrabold tracking-tight text-[#1b4264]">Create Account</h2>
                <p className="text-[13px] text-slate-500 mt-1">
                  New profiles are verified by <span className="text-[#1b4264] font-semibold">admin01@university.edu.ph</span> before access is activated.
                </p>
              </div>

              {/* Error Alert Display */}
              {error && (
                <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700 flex items-start gap-2.5 animate-pulse-soft">
                  <i className="ti ti-alert-circle text-base text-red-500 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Registration Form */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                
                {/* Role Selector Tabs */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-[#1b4264] uppercase tracking-wider">
                    Institutional Role
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole("RESEARCHER")}
                      className={`p-2.5 rounded-xl border text-[12px] font-bold text-left flex items-center gap-2.5 transition cursor-pointer ${
                        role === "RESEARCHER"
                          ? "bg-[#1b4264]/5 border-[#1b4264] text-[#1b4264] shadow-xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${role === "RESEARCHER" ? "bg-[#1b4264] text-[#ffa400]" : "bg-slate-100 text-slate-500"}`}>
                        <i className="ti ti-user-graduation text-sm" />
                      </div>
                      <div>
                        <div className="leading-tight">Student</div>
                        <div className="text-[10px] text-slate-400 font-normal">Researcher</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole("ADVISER")}
                      className={`p-2.5 rounded-xl border text-[12px] font-bold text-left flex items-center gap-2.5 transition cursor-pointer ${
                        role === "ADVISER"
                          ? "bg-[#1b4264]/5 border-[#1b4264] text-[#1b4264] shadow-xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${role === "ADVISER" ? "bg-[#1b4264] text-[#ffa400]" : "bg-slate-100 text-slate-500"}`}>
                        <i className="ti ti-user-check text-sm" />
                      </div>
                      <div>
                        <div className="leading-tight">Faculty</div>
                        <div className="text-[10px] text-slate-400 font-normal">Adviser</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* First Name & Last Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="first-name" className="text-[11px] font-bold text-[#1b4264] uppercase tracking-wider">
                      First Name
                    </label>
                    <input 
                      id="first-name"
                      type="text" 
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g. Maria"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[13.5px] text-slate-900 focus:outline-none focus:border-[#ffa400] focus:ring-1 focus:ring-[#ffa400] transition-colors placeholder:text-slate-400"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="last-name" className="text-[11px] font-bold text-[#1b4264] uppercase tracking-wider">
                      Last Name
                    </label>
                    <input 
                      id="last-name"
                      type="text" 
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="e.g. Santos"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[13.5px] text-slate-900 focus:outline-none focus:border-[#ffa400] focus:ring-1 focus:ring-[#ffa400] transition-colors placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* University ID & Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="university-id" className="text-[11px] font-bold text-[#1b4264] uppercase tracking-wider">
                      University ID / ID No.
                    </label>
                    <input 
                      id="university-id"
                      type="text" 
                      required
                      value={universityId}
                      onChange={(e) => setUniversityId(e.target.value)}
                      placeholder="e.g. 2026-10025"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[13.5px] text-slate-900 focus:outline-none focus:border-[#ffa400] focus:ring-1 focus:ring-[#ffa400] transition-colors placeholder:text-slate-400"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="reg-email" className="text-[11px] font-bold text-[#1b4264] uppercase tracking-wider">
                      Institutional Email
                    </label>
                    <input 
                      id="reg-email"
                      type="email" 
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@university.edu.ph"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[13.5px] text-slate-900 focus:outline-none focus:border-[#ffa400] focus:ring-1 focus:ring-[#ffa400] transition-colors placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Password & Confirm */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="reg-password" className="text-[11px] font-bold text-[#1b4264] uppercase tracking-wider">
                      Password (min 8 chars)
                    </label>
                    <div className="relative">
                      <input 
                        id="reg-password"
                        type={showPassword ? "text" : "password"} 
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[13.5px] text-slate-900 focus:outline-none focus:border-[#ffa400] focus:ring-1 focus:ring-[#ffa400] transition-colors pr-9 placeholder:text-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer text-sm"
                      >
                        <i className={`ti ${showPassword ? "ti-eye-off" : "ti-eye"}`} />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="confirm-pw" className="text-[11px] font-bold text-[#1b4264] uppercase tracking-wider">
                      Confirm Password
                    </label>
                    <input 
                      id="confirm-pw"
                      type={showPassword ? "text" : "password"} 
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[13.5px] text-slate-900 focus:outline-none focus:border-[#ffa400] focus:ring-1 focus:ring-[#ffa400] transition-colors placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Terms of Agreement (TOA) Checkbox & Modal Trigger */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col gap-2">
                  <div className="flex items-start gap-2.5 select-none">
                    <input 
                      id="terms-checkbox"
                      type="checkbox" 
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      className="w-4 h-4 mt-0.5 text-[#1b4264] border-slate-300 rounded focus:ring-[#ffa400] focus:ring-0 focus:ring-offset-0 cursor-pointer shrink-0"
                    />
                    <label htmlFor="terms-checkbox" className="text-[12px] text-slate-700 leading-snug cursor-pointer">
                      I have read and agree to the university's{" "}
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); setShowToaModal(true); }}
                        className="font-bold text-[#1b4264] underline hover:text-[#ffa400] transition cursor-pointer"
                      >
                        Terms of Agreement (TOA) & Research Integrity Policy
                      </button>
                      .
                    </label>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10.5px] text-slate-400 pl-6">
                    <i className="ti ti-shield-check text-emerald-600" />
                    <span>Includes admin verification policy & plagiarism compliance</span>
                  </div>
                </div>

                {/* Submit Button */}
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full mt-2 bg-[#ffa400] hover:bg-[#e09000] text-[#1b4264] py-3 rounded-xl text-[14px] font-extrabold shadow-md active:scale-[0.98] transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-[#1b4264] border-t-transparent rounded-full animate-spin" />
                      <span>Submitting Registration...</span>
                    </>
                  ) : (
                    <>
                      <i className="ti ti-user-check text-base" />
                      <span>Submit for Verification</span>
                    </>
                  )}
                </button>

              </form>

              {/* Bottom Sign In Link */}
              <div className="border-t border-slate-100 pt-4 mt-6 text-center text-[12.5px] text-slate-500">
                Already registered or approved?{" "}
                <Link 
                  href="/login" 
                  className="font-extrabold text-[#1b4264] hover:text-[#ffa400] transition-colors"
                >
                  Sign In to Portal
                </Link>
              </div>

            </div>
          )}

        </div>
      </div>

      {/* ─── TOA (TERMS OF AGREEMENT) MODAL DIALOG ─── */}
      {showToaModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-scale-up">
            
            {/* Modal Header */}
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

            {/* Modal Body / Scrollable Content */}
            <div className="p-6 overflow-y-auto text-[13px] text-slate-700 leading-relaxed flex flex-col gap-4">
              
              <div className="bg-[#1b4264]/5 border border-[#1b4264]/15 rounded-xl p-3.5 text-[#1b4264]">
                <strong className="block font-bold mb-0.5">Important Notice to Applicants:</strong>
                By creating an account on the Advisio Research Management System, you confirm that you are an officially registered student or faculty member of this institution and agree to adhere to all terms stipulated below.
              </div>

              {/* Section 1 */}
              <div>
                <h4 className="font-extrabold text-[#1b4264] text-[13.5px] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <i className="ti ti-id text-[#ffa400]" /> 1. Identity & System Admin Verification
                </h4>
                <p className="text-slate-600">
                  All newly registered accounts are subject to verification by the designated System Administrator (<span className="font-mono text-[#1b4264] font-semibold">admin01@university.edu.ph</span>). Accounts will remain in a pending state until university enrollment or faculty credentials are authenticated against institutional databases. Providing inaccurate or fraudulent IDs will result in immediate suspension and reporting to the student disciplinary committee.
                </p>
              </div>

              {/* Section 2 */}
              <div>
                <h4 className="font-extrabold text-[#1b4264] text-[13.5px] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <i className="ti ti-copyright text-[#ffa400]" /> 2. Intellectual Property & Research Ownership
                </h4>
                <p className="text-slate-600">
                  All manuscripts, methodology plans, and dataset uploads remain the intellectual property of the respective research group and university advisory committee under university research guidelines. Advisio stores all documents securely with role-based access control to prevent unauthorized disclosure before defense.
                </p>
              </div>

              {/* Section 3 */}
              <div>
                <h4 className="font-extrabold text-[#1b4264] text-[13.5px] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <i className="ti ti-scan text-[#ffa400]" /> 3. Plagiarism & Generative AI Restrictions
                </h4>
                <p className="text-slate-600">
                  Drafts uploaded to Advisio are scanned for similarity metrics and original scholarship compliance. Any unauthorized reproduction, fabrications of data, ghostwriting, or uncredited AI generation constitutes a violation of institutional academic integrity rules, leading to rejection of the study.
                </p>
              </div>

              {/* Section 4 */}
              <div>
                <h4 className="font-extrabold text-[#1b4264] text-[13.5px] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <i className="ti ti-lock-check text-[#ffa400]" /> 4. Consultation Privacy & Defense Confidentiality
                </h4>
                <p className="text-slate-600">
                  Transcripts, audio/video conferencing links (such as Google Meet), panelist evaluations, and score sheets are confidential academic records. Users agree not to record or distribute advising sessions or evaluation rubrics without unanimous panel approval.
                </p>
              </div>

              {/* Section 5 */}
              <div>
                <h4 className="font-extrabold text-[#1b4264] text-[13.5px] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <i className="ti ti-gavel text-[#ffa400]" /> 5. Accountability & Policy Violations
                </h4>
                <p className="text-slate-600">
                  The institution reserves the right to revoke or suspend access for any user found violating university policies, harassing group members, or tampering with digital audit trails.
                </p>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between gap-3">
              <span className="text-[11.5px] text-slate-500">
                Official Campus Research Policy Compliance
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
                    setAgreed(true);
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

    </div>
  );
}
