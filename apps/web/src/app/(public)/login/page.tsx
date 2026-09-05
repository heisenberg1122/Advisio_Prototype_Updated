import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { loginAction } from "@/actions/auth";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDemoAccs, setShowDemoAccs] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);

    try {
      // First try live backend API
      const result = await login(email, password);
      
      if (result.success && result.role) {
        const role = result.role.toLowerCase();
        if (role.includes("researcher") || role.includes("student")) {
          router.push("/student/dashboard");
        } else if (role.includes("adviser")) {
          router.push("/adviser/dashboard");
        } else if (role.includes("professor") || role.includes("coordinator")) {
          router.push("/professor/dashboard");
        } else if (role.includes("panelist")) {
          router.push("/panelist/dashboard");
        } else if (role.includes("admin")) {
          router.push("/admin/dashboard");
        } else {
          router.push("/student/dashboard");
        }
        return;
      }

      // Fallback to local demo action if backend is unavailable
      const fallbackResult = await loginAction({ email, password });
      if (fallbackResult.success) {
        const role = fallbackResult.user?.role;
        if (role === "student") router.push("/student/dashboard");
        else if (role === "adviser") router.push("/adviser/dashboard");
        else if (role === "professor") router.push("/professor/dashboard");
        else if (role === "panelist") router.push("/panelist/dashboard");
        else if (role === "admin") router.push("/admin/dashboard");
        else if (role === "system_admin") router.push("/system-admin/dashboard");
        return;
      }

      setError(result.error || fallbackResult.error || "Invalid email or password.");
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Failed to authenticate.");
      setLoading(false);
    }
  };

  const handleFillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("password123");
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-800 font-sans">
      
      {/* ─── LEFT COLUMN: NAVY BLUE HERO (40% width) ─── */}
      <div 
        className="w-full md:w-[40%] bg-[#1b4264] text-white p-8 md:p-12 flex flex-col justify-between select-none relative overflow-hidden"
      >
        {/* Background decorative grid */}
        <div className="absolute inset-0 opacity-5 bg-[linear-gradient(to_right,#ffa400_1px,transparent_1px),linear-gradient(to_bottom,#ffa400_1px,transparent_1px)] bg-[size:30px_30px]" />
        
        {/* Top Branding Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shadow-lg backdrop-blur-sm">
            <i className="ti ti-school text-xl text-[#ffa400]" />
          </div>
          <div>
            <span className="font-extrabold text-[22px] tracking-tight block leading-none text-white">ADVISIO</span>
            <span className="text-[10px] uppercase tracking-widest text-[#ffa400] font-semibold">Research Portal</span>
          </div>
        </div>

        {/* Center Main Copy & Illustration */}
        <div className="relative z-10 my-12 md:my-auto flex flex-col gap-8">
          <div>
            <h2 className="text-[28px] md:text-[34px] font-bold leading-tight tracking-tight text-white">
              Capstone, Thesis, & Research Advising Management
            </h2>
            <div className="h-1.5 w-16 bg-[#ffa400] rounded-full mt-4" />
            <p className="text-slate-200 text-[14px] mt-4 leading-relaxed font-light">
              Streamlining the entire academic research journey from proposal selection to final defense, grading, and plagiarism check.
            </p>
          </div>

          {/* Simple Clean Workflow Steps */}
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10 backdrop-blur-md shadow-inner flex flex-col gap-4">
            <div className="text-[11px] uppercase tracking-wider text-[#ffa400] font-bold">Research Stages</div>
            
            <div className="flex flex-col gap-3.5 text-[13px] font-medium text-slate-100">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#ffa400]/25 border border-[#ffa400] flex items-center justify-center text-[10px] text-[#ffa400] font-bold mt-0.5">
                  1
                </div>
                <div>
                  <span className="font-bold text-white block">Proposal Outline & Matching</span>
                  <span className="text-[11px] text-slate-300 font-light">Find advising matches and outline scope.</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#ffa400]/25 border border-[#ffa400] flex items-center justify-center text-[10px] text-[#ffa400] font-bold mt-0.5">
                  2
                </div>
                <div>
                  <span className="font-bold text-white block">Milestone & Review Submissions</span>
                  <span className="text-[11px] text-slate-300 font-light">Submit drafts for chapters and request validation.</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#ffa400]/25 border border-[#ffa400] flex items-center justify-center text-[10px] text-[#ffa400] font-bold mt-0.5">
                  3
                </div>
                <div>
                  <span className="font-bold text-white block">Committee Defense Center</span>
                  <span className="text-[11px] text-slate-300 font-light">Schedule defense panels and submit final uploads.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Feature Highlights checklist */}
          <div className="flex flex-col gap-2.5 text-[12.5px] text-slate-250">
            <div className="flex items-center gap-2">
              <i className="ti ti-checkbox text-[#ffa400] text-[15px]" />
              <span>Real-time Consultation & Audio/Video Conferencing</span>
            </div>
            <div className="flex items-center gap-2">
              <i className="ti ti-checkbox text-[#ffa400] text-[15px]" />
              <span>Automated Defense Scheduling & Panel Assignment</span>
            </div>
            <div className="flex items-center gap-2">
              <i className="ti ti-checkbox text-[#ffa400] text-[15px]" />
              <span>Plagiarism Check and Similarity Monitoring</span>
            </div>
          </div>
        </div>

        {/* Footer Brand Info */}
        <div className="relative z-10 border-t border-white/10 pt-4 text-[11px] text-slate-300 flex justify-between">
          <span>Version 1.2</span>
          <span>© University Research Management System</span>
        </div>

      </div>

      {/* ─── RIGHT COLUMN: WHITE LOGIN CARD CONTAINER (60% width) ─── */}
      <div className="w-full md:w-[60%] bg-slate-100 p-6 md:p-16 flex flex-col justify-center items-center">
        
        <div className="w-full max-w-[440px] flex flex-col gap-6 animate-fade-in-up">
          
          {/* Main Login Card */}
          <div className="bg-white rounded-2xl border border-slate-200/70 p-8 shadow-xl relative overflow-hidden">
            
            {/* Header Section */}
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#1b4264] flex items-center justify-center shadow-md mb-3">
                <i className="ti ti-lock text-[#ffa400] text-xl" />
              </div>
              <h2 className="text-[24px] font-bold tracking-tight text-[#1b4264]">Welcome to Advisio</h2>
              <p className="text-[13px] text-slate-500 mt-1">Sign in with your university account credentials.</p>
            </div>

            {/* Error Alert Display */}
            {error && (
              <div className={`mb-5 p-3.5 rounded-xl border text-[12px] flex items-start gap-2.5 animate-pulse-soft ${
                error.toLowerCase().includes("pending") || error.toLowerCase().includes("admin01")
                  ? "bg-amber-50 border-amber-300 text-amber-900"
                  : "bg-red-50 border-red-200 text-red-700"
              }`}>
                <i className={`text-[16px] flex-shrink-0 mt-0.5 ${
                  error.toLowerCase().includes("pending") || error.toLowerCase().includes("admin01")
                    ? "ti ti-clock-pause text-amber-600"
                    : "ti ti-alert-circle text-red-500"
                }`} />
                <div className="leading-relaxed">
                  {error.toLowerCase().includes("pending") && (
                    <strong className="block text-amber-950 font-bold mb-0.5">Verification Required</strong>
                  )}
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              
              {/* Email Address */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-[11px] font-bold text-[#1b4264] uppercase tracking-wider">
                  University Email Address
                </label>
                <input 
                  id="email"
                  type="email" 
                  required
                  disabled={loading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@university.edu.ph"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-[14px] text-slate-900 focus:outline-none focus:border-[#ffa400] focus:ring-1 focus:ring-[#ffa400] transition-colors placeholder:text-slate-400 disabled:opacity-50"
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label htmlFor="password" className="text-[11px] font-bold text-[#1b4264] uppercase tracking-wider">
                    Password
                  </label>
                  <Link 
                    href="/forgot-password" 
                    className="text-[11px] font-bold text-[#1b4264] hover:text-[#ffa400] transition-colors"
                  >
                    Forgot Password?
                  </Link>
                </div>
                <input 
                  id="password"
                  type="password" 
                  required
                  disabled={loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-[14px] text-slate-900 focus:outline-none focus:border-[#ffa400] focus:ring-1 focus:ring-[#ffa400] transition-colors placeholder:text-slate-400 disabled:opacity-50"
                />
              </div>

              {/* Keep me signed in */}
              <div className="flex items-center gap-2 mt-1 select-none">
                <input 
                  id="keep-signed-in"
                  type="checkbox" 
                  disabled={loading}
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-[#1b4264] border-slate-300 rounded focus:ring-[#ffa400] focus:ring-0 focus:ring-offset-0 cursor-pointer disabled:opacity-50"
                />
                <label htmlFor="keep-signed-in" className="text-[12.5px] text-slate-650 cursor-pointer">
                  Remember my session on this device
                </label>
              </div>

              {/* Sign In Button */}
              <button 
                type="submit" 
                disabled={loading}
                className="w-full mt-2 bg-[#ffa400] hover:bg-[#e09000] text-[#1b4264] py-2.5 rounded-lg text-[13.5px] font-extrabold shadow-md active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[#1b4264] border-t-transparent rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <i className="ti ti-login-2 text-base" />
                    <span>Sign In to Dashboard</span>
                  </>
                )}
              </button>

            </form>

            {/* Bottom Activation Hint */}
            <div className="text-center text-[12.5px] text-slate-500 mt-6 pt-4 border-t border-slate-100">
              Don't have an account yet?{" "}
              <Link 
                href="/register" 
                className="font-bold text-[#1b4264] hover:text-[#ffa400] transition-colors"
              >
                Create Account (Requires Admin Approval)
              </Link>
            </div>
            
          </div>

          {/* Collapsible Demo credentials card */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <button 
              onClick={() => setShowDemoAccs(!showDemoAccs)}
              className="w-full flex justify-between items-center text-[12px] font-bold text-[#1b4264] hover:text-[#ffa400] transition-colors cursor-pointer focus:outline-none"
            >
              <span className="flex items-center gap-1.5">
                <i className="ti ti-database text-[14px]" />
                Demo Credentials (Role / Status Redirections)
              </span>
              <i className={`ti ${showDemoAccs ? "ti-chevron-up" : "ti-chevron-down"}`} />
            </button>
            
            {showDemoAccs && (
              <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3 animate-fade-in-up text-[11px]">
                <p className="text-slate-500 leading-normal">
                  Click any button to fill credentials (default password: `password123`).
                </p>
                
                {/* Section: Valid Roles */}
                <div className="flex flex-col gap-1.5">
                  <div className="font-bold text-[#1b4264] border-b border-slate-100 pb-0.5">Active Roles</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => handleFillDemo("student01@university.edu.ph")}
                      className="px-2 py-1 text-left bg-slate-50 hover:bg-[#ffa400]/10 border border-slate-200 rounded text-slate-700 hover:border-[#ffa400] transition text-[10px] cursor-pointer"
                    >
                      <span className="font-bold block text-[#1b4264]">Student</span>
                      student01@university...
                    </button>
                    <button 
                      onClick={() => handleFillDemo("adviser01@university.edu.ph")}
                      className="px-2 py-1 text-left bg-slate-50 hover:bg-[#ffa400]/10 border border-slate-200 rounded text-slate-700 hover:border-[#ffa400] transition text-[10px] cursor-pointer"
                    >
                      <span className="font-bold block text-[#1b4264]">Adviser</span>
                      adviser01@university...
                    </button>
                    <button 
                      onClick={() => handleFillDemo("professor01@university.edu.ph")}
                      className="px-2 py-1 text-left bg-slate-50 hover:bg-[#ffa400]/10 border border-slate-200 rounded text-slate-700 hover:border-[#ffa400] transition text-[10px] cursor-pointer"
                    >
                      <span className="font-bold block text-[#1b4264]">Professor</span>
                      professor01@university...
                    </button>
                    <button 
                      onClick={() => handleFillDemo("panelist01@university.edu.ph")}
                      className="px-2 py-1 text-left bg-slate-50 hover:bg-[#ffa400]/10 border border-slate-200 rounded text-slate-700 hover:border-[#ffa400] transition text-[10px] cursor-pointer"
                    >
                      <span className="font-bold block text-[#1b4264]">Panelist</span>
                      panelist01@university...
                    </button>
                    <button 
                      onClick={() => handleFillDemo("admin01@university.edu.ph")}
                      className="px-2 py-1 text-left bg-[#1b4264]/5 hover:bg-[#ffa400]/15 border border-[#1b4264]/20 rounded text-slate-700 hover:border-[#ffa400] transition text-[10px] cursor-pointer"
                    >
                      <span className="font-extrabold block text-[#1b4264]">Admin (Verifies Users)</span>
                      admin01@university...
                    </button>
                    <button 
                      onClick={() => handleFillDemo("superadmin01@university.edu.ph")}
                      className="px-2 py-1 text-left bg-slate-50 hover:bg-[#ffa400]/10 border border-slate-200 rounded text-slate-700 hover:border-[#ffa400] transition text-[10px] cursor-pointer"
                    >
                      <span className="font-bold block text-[#1b4264]">System Admin</span>
                      superadmin01@university...
                    </button>
                  </div>
                </div>

                {/* Section: Status Validations */}
                <div className="flex flex-col gap-1.5 mt-1">
                  <div className="font-bold text-[#1b4264] border-b border-slate-100 pb-0.5">Status Check Tests</div>
                  <div className="grid grid-cols-3 gap-2">
                    <button 
                      onClick={() => handleFillDemo("pending@university.edu.ph")}
                      className="px-1.5 py-1 text-center bg-amber-50 hover:bg-[#ffa400]/10 border border-amber-200 rounded text-amber-800 hover:border-[#ffa400] transition text-[9px] font-semibold cursor-pointer"
                    >
                      Pending Account
                    </button>
                    <button 
                      onClick={() => handleFillDemo("inactive@university.edu.ph")}
                      className="px-1.5 py-1 text-center bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded text-gray-700 hover:border-gray-500 transition text-[9px] font-semibold cursor-pointer"
                    >
                      Inactive Account
                    </button>
                    <button 
                      onClick={() => handleFillDemo("suspended@university.edu.ph")}
                      className="px-1.5 py-1 text-center bg-red-50 hover:bg-red-100 border border-red-200 rounded text-red-800 hover:border-red-500 transition text-[9px] font-semibold cursor-pointer"
                    >
                      Suspended Acc.
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1 mt-1 border-t border-slate-100 pt-2 text-[10px] text-slate-500">
                  <div>
                    <span className="font-bold">Missing role test</span>: 
                    <button 
                      onClick={() => handleFillDemo("norole@university.edu.ph")} 
                      className="ml-1 text-blue-600 hover:underline cursor-pointer"
                    >
                      norole@university.edu.ph
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
