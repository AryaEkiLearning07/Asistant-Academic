"use client";

import React from "react";
import { AlertCircle, ShieldCheck } from "lucide-react";

interface AuthScreenProps {
  theme: "dark" | "light";
  authMode: "login" | "register";
  setAuthMode: (mode: "login" | "register") => void;
  emailInput: string;
  setEmailInput: (val: string) => void;
  passwordInput: string;
  setPasswordInput: (val: string) => void;
  fullNameInput: string;
  setFullNameInput: (val: string) => void;
  authError: string | null;
  setAuthError: (err: string | null) => void;
  isAuthLoading: boolean;
  handleAuthSubmit: (e: React.FormEvent) => Promise<void>;
}

export function AuthScreen({
  theme,
  authMode,
  setAuthMode,
  emailInput,
  setEmailInput,
  passwordInput,
  setPasswordInput,
  fullNameInput,
  setFullNameInput,
  authError,
  setAuthError,
  isAuthLoading,
  handleAuthSubmit,
}: AuthScreenProps) {
  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-200 font-claude-sans ${
        theme === "dark" ? "bg-[#12161A] text-[#E6EDF2]" : "bg-[#F7F9FA] text-[#12202B]"
      }`}
    >
      <div
        className={`w-full max-w-md rounded-2xl shadow-2xl p-6 sm:p-8 border transition-all ${
          theme === "dark"
            ? "bg-[#1B2127] border-[#2A333B] text-[#E6EDF2]"
            : "bg-[#FFFFFF] border-[#DCE3E8] text-[#12202B]"
        }`}
      >
        <div className="text-center mb-6">
          <div
            className={`inline-flex w-12 h-12 rounded-xl items-center justify-center font-extrabold text-2xl shadow-md mb-3 ${
              theme === "dark" ? "bg-[#34D3BE] text-[#12161A]" : "bg-[#0F766E] text-white"
            }`}
          >
            E
          </div>
          <h1
            className={`text-2xl font-black tracking-tight font-claude-serif ${
              theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
            }`}
          >
            EPIONA
          </h1>
          <p
            className={`text-xs mt-1 ${
              theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
            }`}
          >
            Academic Literature Assistant & Dual-Pane Workspace
          </p>
        </div>

        {/* DUAL TAB SWITCHER */}
        <div
          className={`flex border-b mb-6 text-sm font-semibold ${
            theme === "dark" ? "border-[#2A333B]" : "border-[#DCE3E8]"
          }`}
        >
          <button
            onClick={() => {
              setAuthMode("login");
              setAuthError(null);
            }}
            className={`flex-1 pb-3 text-center transition border-b-2 cursor-pointer ${
              authMode === "login"
                ? theme === "dark"
                  ? "border-[#34D3BE] text-[#34D3BE] font-bold"
                  : "border-[#0F766E] text-[#0F766E] font-bold"
                : theme === "dark"
                ? "border-transparent text-[#9AA9B5] hover:text-[#E6EDF2]"
                : "border-transparent text-[#5B6B78] hover:text-[#12202B]"
            }`}
          >
            Masuk ke Sesi
          </button>
          <button
            onClick={() => {
              setAuthMode("register");
              setAuthError(null);
            }}
            className={`flex-1 pb-3 text-center transition border-b-2 cursor-pointer ${
              authMode === "register"
                ? theme === "dark"
                  ? "border-[#34D3BE] text-[#34D3BE] font-bold"
                  : "border-[#0F766E] text-[#0F766E] font-bold"
                : theme === "dark"
                ? "border-transparent text-[#9AA9B5] hover:text-[#E6EDF2]"
                : "border-transparent text-[#5B6B78] hover:text-[#12202B]"
            }`}
          >
            Daftar Akun Baru
          </button>
        </div>

        {authError && (
          <div
            className={`mb-4 p-3 border text-xs rounded-xl flex items-center gap-2 ${
              theme === "dark"
                ? "bg-rose-950/70 border-rose-800/80 text-rose-300"
                : "bg-rose-50 border-rose-200 text-rose-700"
            }`}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{authError}</span>
          </div>
        )}

        <form onSubmit={handleAuthSubmit} className="space-y-4">
          {authMode === "register" && (
            <div>
              <label
                className={`block text-xs font-bold mb-1 ${
                  theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
                }`}
              >
                Nama Lengkap
              </label>
              <input
                type="text"
                required
                value={fullNameInput}
                onChange={(e) => setFullNameInput(e.target.value)}
                placeholder="Misal: Alin Pratama, S.Farm"
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-none transition ${
                  theme === "dark"
                    ? "bg-[#12161A] border-[#2A333B] text-[#E6EDF2] placeholder-[#9AA9B5]/60 focus:border-[#34D3BE]"
                    : "bg-[#F7F9FA] border-[#DCE3E8] text-[#12202B] placeholder-[#5B6B78]/60 focus:border-[#0F766E] focus:bg-white"
                }`}
              />
            </div>
          )}

          <div>
            <label
              className={`block text-xs font-bold mb-1 ${
                theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
              }`}
            >
              Email Akademik
            </label>
            <input
              type="email"
              required
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="nama@farmasi.ac.id"
              className={`w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-none transition ${
                theme === "dark"
                  ? "bg-[#12161A] border-[#2A333B] text-[#E6EDF2] placeholder-[#9AA9B5]/60 focus:border-[#34D3BE]"
                  : "bg-[#F7F9FA] border-[#DCE3E8] text-[#12202B] placeholder-[#5B6B78]/60 focus:border-[#0F766E] focus:bg-white"
              }`}
            />
          </div>

          <div>
            <label
              className={`block text-xs font-bold mb-1 ${
                theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
              }`}
            >
              Kata Sandi
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Minimal 6 karakter"
              className={`w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-none transition ${
                theme === "dark"
                  ? "bg-[#12161A] border-[#2A333B] text-[#E6EDF2] placeholder-[#9AA9B5]/60 focus:border-[#34D3BE]"
                  : "bg-[#F7F9FA] border-[#DCE3E8] text-[#12202B] placeholder-[#5B6B78]/60 focus:border-[#0F766E] focus:bg-white"
              }`}
            />
          </div>

          <button
            type="submit"
            disabled={isAuthLoading}
            className={`w-full py-3 font-bold text-sm rounded-xl shadow-md transition disabled:opacity-50 mt-2 cursor-pointer ${
              theme === "dark"
                ? "bg-[#34D3BE] text-[#12161A] hover:bg-[#34D3BE]/90"
                : "bg-[#0F766E] text-white hover:bg-[#0F766E]/90"
            }`}
          >
            {isAuthLoading
              ? "Memproses..."
              : authMode === "login"
              ? "Masuk ke Dashboard"
              : "Daftar Akun Sekarang"}
          </button>
        </form>

        <div
          className={`mt-6 pt-5 border-t flex items-center justify-center text-xs ${
            theme === "dark" ? "border-[#2A333B] text-[#9AA9B5]" : "border-[#DCE3E8] text-[#5B6B78]"
          }`}
        >
          <span className="flex items-center gap-1">
            <ShieldCheck
              className={`w-4 h-4 ${theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"}`}
            />
            Autentikasi Terenkripsi & Isolasi Multi-Tenant
          </span>
        </div>
      </div>
    </div>
  );
}
