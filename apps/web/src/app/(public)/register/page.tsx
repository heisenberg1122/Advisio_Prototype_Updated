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
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!agreed) {
      setError("Please agree to the university's research integrity terms.");
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
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-800 font-sans">
      
      {/* ─── LEFT COLUMN: NAVY BLUE HERO (40% width) ─── */}
      <div 
        className="w-full md:w-[40%] bg-[#1b4264] text-white p-8 md:p-12 flex flex-col justify-between border-r border-[#15344f] select-none relative overflow-hidden"
      >
        {/* Background decorative grids */}
        <div className="absolute inset-0 opacity-5 bg-[linear-gradient(to_right,#ffa400_1px,transparent_1px),linear-gradient(to_bottom,#ffa400_1px,transparent_1px)] bg-[size:30px_30px]" />
        
        {/* Logo and Brand */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shadow-lg backdrop-blur-sm">
            <i className="ti ti-school text-xl text-[#ffa400]" />
          </div>
          <div>
            <span className="font-extrabold text-[22px] tracking-tight block leading-none text-white">ADVISIO</span>
            <span className="text-[10px] uppercase tracking-widest text-[#ffa400] font-semibold">Account Registration</span>
          </div>
        </div>

        {/* Content & Security Visuals */}
        <div className="relative z-10 my-8 md:my-auto flex flex-col gap-6">
          <div>
            <h2 className="text-[26px] md:text-[30px] font-bold leading-tight tracking-tight text-white">
              Institutional Gatekeeper & Access Control
            </h2>
            <div className="h-1.5 w-16 bg-[#ffa400] rounded-full mt-3" />
            <p className="text-slate-200 text-[13.5px] mt-3.5 leading-relaxed font-light">
              Advisio is a secure campus research platform. To protect student intellectual property and grading confidentiality, all newly registered accounts undergo verification by the system administrator before activation.
            </p>
          </div>

          {/* Verification Protocol Box */}
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10 backdrop-blur-md shadow-inner flex flex-col gap-3.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#ffa400] animate-pulse" />
              <h3 className="text-[11px] uppercase tracking-wider text-[#ffa400] font-bold">Verification Policy</h3>
            </div>
            
            <div className="flex gap-3 text-[12.5px] text-slate-200">
              <i className="ti ti-user-shield text-[#ffa400] text-[18px] mt-0.5 shrink-0" />
              <div>
                <h4 className="font-bold text-white">Admin Approval Required</h4>
                <p className="text-[11px] text-slate-300 font-light mt-0.5">
                  Accounts are verified by <span className="text-[#ffa400] font-semibold font-mono">admin01@university.edu.ph</span> before granting access to studies, drafts, and panel defense rooms.
                </p>
              </div>
            </div>

            <div className="flex gap-3 text-[12.5px] text-slate-200">
              <i className="ti ti-id text-[#ffa400] text-[18px] mt-0.5 shrink-0" />
              <div>
                <h4 className="font-bold text-white">Institutional Identity Validation</h4>
                <p className="text-[11px] text-slate-300 font-light mt-0.5">
                  Matches your Student or Employee ID against the registrar roster to confirm eligibility.
                </p>
              </div>
            </div>

            <div className="flex gap-3 text-[12.5px] text-slate-200">
              <i className="ti ti-lock-check text-[#ffa400] text-[18px] mt-0.5 shrink-0" />
              <div>
                <h4 className="font-bold text-white">Encrypted Research Vault</h4>
                <p className="text-[11px] text-slate-300 font-light mt-0.5">
                  Safeguards thesis manuscripts, plagiarism checks, and confidential adviser annotations.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 border-t border-white/10 pt-4 text-[11px] text-slate-300 flex justify-between">
          <span>Advisio Portal v1.0</span>
          <span>Administrator: admin01@university.edu.ph</span>
        </div>

      </div>

      {/* ─── RIGHT SIDE: FORM / CONFIRMATION (60% width) ─── */}
      <div className="w-full md:w-[60%] bg-white p-6 md:p-12 flex items-center justify-center overflow-y-auto">
        <div className="w-full max-w-[480px] flex flex-col gap-6 my-auto animate-fade-in-up">
          
          {registeredUser ? (
            /* ─── SUCCESS: PENDING VERIFICATION STATE ─── */
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 md:p-8 flex flex-col items-center text-center shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-[#ffa400]/15 border border-[#ffa400]/30 text-[#1b4264] flex items-center justify-center text-3xl mb-4 shadow-sm">
                <i className="ti ti-clock-check text-[#ffa400]" />
              </div>

              <span className="px-3 py-1 bg-[#ffa400]/15 text-[#1b4264] text-[11px] font-extrabold uppercase tracking-wider rounded-full border border-[#ffa400]/30 mb-2">
                Pending Admin Verification
              </span>

              <h2 className="text-[22px] font-extrabold text-[#1b4264] tracking-tight">
                Account Created Successfully!
              </h2>

              <p className="text-[13px] text-slate-600 mt-2 leading-relaxed">
                Thank you, <strong className="text-slate-900">{registeredUser.name}</strong>. Your account has been created and submitted to the university registrar.
              </p>

              {/* Summary Card */}
              <div className="w-full bg-white rounded-xl border border-slate-200 p-4 mt-5 text-left text-[12px] flex flex-col gap-2 shadow-xs">
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Email</span>
                  <span className="font-bold text-[#1b4264]">{registeredUser.email}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">University ID</span>
                  <span className="font-bold text-slate-700">{registeredUser.universityId}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Role</span>
                  <span className="font-bold text-slate-700">{registeredUser.role}</span>
                </div>
                <div className="flex justify-between items-center pt-0.5">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Verification Admin</span>
                  <span className="text-[11px] font-extrabold text-[#1b4264] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    admin01@university.edu.ph
                  </span>
                </div>
              </div>

              {/* Alert notice */}
              <div className="w-full bg-amber-50 border border-amber-200 rounded-xl p-3.5 mt-4 text-[12px] text-amber-900 text-left flex items-start gap-2.5">
                <i className="ti ti-info-circle text-amber-600 text-base shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Approval in Progress</span>
                  Your profile requires administrator verification before you can log in. The administrator (<strong className="font-semibold">admin01@university.edu.ph</strong>) will review your credentials.
                </div>
              </div>

              {/* Return to Sign in */}
              <div className="w-full flex flex-col gap-2 mt-6">
                <Link
                  href="/login"
                  className="w-full bg-[#1b4264] hover:bg-[#15344f] text-white py-2.5 rounded-lg text-[13px] font-bold shadow-md text-center transition cursor-pointer"
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
                  }}
                  className="text-[12px] text-slate-500 hover:text-[#1b4264] transition py-1 cursor-pointer"
                >
                  Register another account
                </button>
              </div>
            </div>
          ) : (
            /* ─── REGISTRATION FORM ─── */
            <>
              {/* Header */}
              <div>
                <div className="inline-flex items-center gap-1.5 bg-[#ffa400]/15 text-[#1b4264] px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide border border-[#ffa400]/30 mb-2">
                  <i className="ti ti-user-check" />
                  <span>Student & Faculty Enrollment</span>
                </div>
                <h2 className="text-[26px] font-extrabold tracking-tight text-[#1b4264]">Create Advisio Account</h2>
                <p className="text-[13px] text-slate-500 mt-1">
                  Enter your credentials. Accounts are submitted to <strong className="text-[#1b4264]">admin01@university.edu.ph</strong> for verification.
                </p>
              </div>

              {/* Error banner */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3.5 py-2.5 rounded-lg text-[12.5px] flex items-center gap-2 animate-shake">
                  <i className="ti ti-alert-circle text-base shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
                
                {/* Role selection */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-extrabold text-[#1b4264] uppercase tracking-wider">Account Role</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole("RESEARCHER")}
                      className={`p-2.5 rounded-lg border text-[12px] font-bold text-left flex items-center gap-2 transition cursor-pointer ${
                        role === "RESEARCHER"
                          ? "bg-[#1b4264]/5 border-[#1b4264] text-[#1b4264]"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <i className="ti ti-user-graduation text-base text-[#ffa400]" />
                      <div>
                        <div className="leading-tight">Student / Researcher</div>
                        <div className="text-[10px] text-slate-400 font-normal">Enrolled in capstone</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole("ADVISER")}
                      className={`p-2.5 rounded-lg border text-[12px] font-bold text-left flex items-center gap-2 transition cursor-pointer ${
                        role === "ADVISER"
                          ? "bg-[#1b4264]/5 border-[#1b4264] text-[#1b4264]"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <i className="ti ti-user-check text-base text-[#1b4264]" />
                      <div>
                        <div className="leading-tight">Faculty Adviser</div>
                        <div className="text-[10px] text-slate-400 font-normal">Advising & Panels</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Name Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="first-name" className="text-[11px] font-extrabold text-[#1b4264] uppercase tracking-wider">
                      First Name
                    </label>
                    <input 
                      id="first-name"
                      type="text" 
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g. Maria"
                      className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:border-[#ffa400] transition"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label htmlFor="last-name" className="text-[11px] font-extrabold text-[#1b4264] uppercase tracking-wider">
                      Last Name
                    </label>
                    <input 
                      id="last-name"
                      type="text" 
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="e.g. Santos"
                      className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:border-[#ffa400] transition"
                    />
                  </div>
                </div>

                {/* University ID & Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="university-id" className="text-[11px] font-extrabold text-[#1b4264] uppercase tracking-wider">
                      Student / Employee ID
                    </label>
                    <input 
                      id="university-id"
                      type="text" 
                      required
                      value={universityId}
                      onChange={(e) => setUniversityId(e.target.value)}
                      placeholder="e.g. 2026-00123"
                      className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:border-[#ffa400] transition"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label htmlFor="reg-email" className="text-[11px] font-extrabold text-[#1b4264] uppercase tracking-wider">
                      Institutional Email
                    </label>
                    <input 
                      id="reg-email"
                      type="email" 
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. name@university.edu.ph"
                      className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:border-[#ffa400] transition"
                    />
                  </div>
                </div>

                {/* Password & Confirm */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="reg-password" className="text-[11px] font-extrabold text-[#1b4264] uppercase tracking-wider">
                      Password (min 8 chars)
                    </label>
                    <div className="relative">
                      <input 
                        id="reg-password"
                        type={showPassword ? "text" : "password"} 
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:border-[#ffa400] transition pr-9"
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

                  <div className="flex flex-col gap-1">
                    <label htmlFor="confirm-pw" className="text-[11px] font-extrabold text-[#1b4264] uppercase tracking-wider">
                      Confirm Password
                    </label>
                    <input 
                      id="confirm-pw"
                      type={showPassword ? "text" : "password"} 
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:border-[#ffa400] transition"
                    />
                  </div>
                </div>

                {/* Admin Notice Box */}
                <div className="bg-[#1b4264]/5 border border-[#1b4264]/15 rounded-xl p-3 text-[12px] text-slate-700 flex items-start gap-2.5">
                  <i className="ti ti-shield-lock text-[#ffa400] text-base shrink-0 mt-0.5" />
                  <p className="leading-snug">
                    <strong className="text-[#1b4264]">Verification Notice:</strong> Newly registered accounts must be approved by the administrator (<span className="font-mono text-[#1b4264] font-bold">admin01@university.edu.ph</span>) prior to first login.
                  </p>
                </div>

                {/* Terms and Conditions Checkbox */}
                <div className="flex items-start gap-2.5">
                  <input 
                    id="terms"
                    type="checkbox" 
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="w-4 h-4 mt-0.5 text-[#1b4264] border-slate-300 rounded focus:ring-[#ffa400] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <label htmlFor="terms" className="text-[12px] text-slate-600 select-none leading-snug cursor-pointer">
                    I agree to the university's academic research guidelines and acknowledge that account activation requires admin approval.
                  </label>
                </div>

                {/* Submit Button */}
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full mt-1 bg-[#ffa400] hover:bg-[#e09000] text-[#1b4264] py-2.5 rounded-lg text-[13.5px] font-extrabold shadow-md active:scale-[0.98] transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-[#1b4264] border-t-transparent rounded-full animate-spin" />
                      <span>Submitting Registration...</span>
                    </>
                  ) : (
                    <>
                      <i className="ti ti-send text-base" />
                      <span>Create Account & Request Verification</span>
                    </>
                  )}
                </button>

              </form>

              {/* Divider */}
              <div className="border-t border-slate-200 pt-3 text-center text-[12.5px] text-slate-600">
                Already registered or verified?{" "}
                <Link 
                  href="/login" 
                  className="font-extrabold text-[#1b4264] hover:text-[#ffa400] transition"
                >
                  Sign In Here
                </Link>
              </div>
            </>
          )}

        </div>
      </div>

    </div>
  );
}
