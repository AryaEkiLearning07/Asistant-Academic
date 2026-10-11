"use client";

import React from "react";
import {
  Pill,
  Sun,
  Moon,
  Settings,
  ShieldCheck,
  MessageSquare,
  Library,
  ArrowRight,
  FileText,
} from "lucide-react";
import { DocumentItem, ChatSessionItem, UserProfile } from "@/types";
import { FileFormatIcon } from "@/components/library/FileFormatIcon";

interface DashboardViewProps {
  theme: "dark" | "light";
  currentUser: UserProfile;
  currentNav: "dashboard" | "workspace" | "library" | "admin";
  setCurrentNav: (nav: "dashboard" | "workspace" | "library" | "admin") => void;
  documents: DocumentItem[];
  chatSessions: ChatSessionItem[];
  toggleTheme: () => void;
  setIsProfileModalOpen: (open: boolean) => void;
  setIsPdfPanelOpen: (open: boolean) => void;
  openDocumentPreview: (doc: DocumentItem) => void;
  setActiveDoc: (doc: DocumentItem | null) => void;
  setTargetPage: (page: number) => void;
  setHighlightQuote: (quote: string | null) => void;
  handleNewChat: () => void;
  handleSelectSession: (id: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function DashboardView({
  theme,
  currentUser,
  currentNav,
  setCurrentNav,
  documents,
  chatSessions,
  toggleTheme,
  setIsProfileModalOpen,
  setIsPdfPanelOpen,
  openDocumentPreview,
  setActiveDoc,
  setTargetPage,
  setHighlightQuote,
  handleNewChat,
  handleSelectSession,
  fileInputRef,
}: DashboardViewProps) {
  return (
    <div className="flex-1 overflow-y-auto w-full h-full">
      {/* TOP HEADER NAVBAR (STICKY AT VERY TOP, FULL WIDTH) */}
      <div
        className={`border-b transition-colors ${
          theme === "dark" ? "bg-[#1B2127]/95 border-[#2A333B]" : "bg-white/95 border-[#E2E8F0]"
        } backdrop-blur-md sticky top-0 z-20`}
      >
        <div className="flex h-16 w-full items-center justify-between px-6 sm:px-10 lg:px-12">
          {/* Brand Logo - EPIONA PharmSimulator */}
          <div className="flex items-center gap-3 shrink-0">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-xs ${
                theme === "dark"
                  ? "bg-[#34D3BE] text-[#12161A]"
                  : "bg-gradient-to-tr from-[#0F766E] to-[#14B8A6] text-white"
              }`}
            >
              <Pill className="h-5 w-5 rotate-45" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-base sm:text-lg font-bold tracking-tight font-claude-serif ${
                    theme === "dark" ? "text-[#E6EDF2]" : "text-[#0F766E]"
                  }`}
                >
                  EPIONA
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    theme === "dark"
                      ? "bg-[#34D3BE]/15 text-[#34D3BE] border border-[#34D3BE]/30"
                      : "bg-[#CCFBF1] text-[#0F766E]"
                  }`}
                >
                  PharmSimulator
                </span>
              </div>
              <p
                className={`hidden sm:block text-[10px] font-medium leading-none ${
                  theme === "dark" ? "text-[#9AA9B5]" : "text-[#71717A]"
                }`}
              >
                Laboratorium Farmasi Klinis AI
              </p>
            </div>
          </div>

          {/* Navigasi Menu Tengah (Tab Pintas) */}
          <nav
            className={`hidden md:flex items-center gap-6 text-xs font-semibold ${
              theme === "dark" ? "text-[#9AA9B5]" : "text-[#52525B]"
            }`}
          >
            <button
              onClick={() => setCurrentNav("workspace")}
              className={`transition hover:text-[#0F766E] cursor-pointer ${
                theme === "dark" ? "hover:text-[#34D3BE]" : "hover:text-[#0F766E]"
              }`}
            >
              AI Assistant
            </button>
            <button
              onClick={() => setCurrentNav("library")}
              className={`transition hover:text-[#0F766E] cursor-pointer ${
                theme === "dark" ? "hover:text-[#34D3BE]" : "hover:text-[#0F766E]"
              }`}
            >
              MyLibrary ({documents.length})
            </button>
            {currentUser?.role === "admin" && (
              <button
                onClick={() => setCurrentNav("admin")}
                className={`flex items-center gap-1.5 transition cursor-pointer font-bold ${
                  (currentNav as string) === "admin"
                    ? "text-rose-500"
                    : theme === "dark"
                    ? "text-rose-400 hover:text-rose-300"
                    : "text-rose-600 hover:text-rose-700"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />
                <span>Admin &amp; Dev Center</span>
              </button>
            )}
          </nav>

          {/* Action Buttons Kanan */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={toggleTheme}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
                theme === "dark"
                  ? "border-[#2A333B] bg-[#12161A] text-amber-300 hover:bg-[#2A333B]"
                  : "border-[#CBD5E1] bg-white text-[#12202B] hover:bg-[#F8FAFC]"
              }`}
              title={theme === "dark" ? "Mode Terang" : "Mode Gelap"}
            >
              {theme === "dark" ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[11px] hidden sm:inline text-[#E6EDF2]">Terang</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-[#5B6B78]" />
                  <span className="text-[11px] hidden sm:inline text-[#5B6B78]">Gelap</span>
                </>
              )}
            </button>

            <button
              onClick={() => setIsProfileModalOpen(true)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-1.5 text-xs font-semibold shadow-xs transition hover:shadow-sm cursor-pointer ${
                theme === "dark"
                  ? "border-[#2A333B] bg-[#1B2127] hover:bg-[#2A333B] text-[#E6EDF2]"
                  : "border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-[#12202B]"
              }`}
              title="Buka Pengaturan Akun"
            >
              <div className="w-6 h-6 rounded-lg bg-teal-600 text-white font-bold flex items-center justify-center text-[11px] shadow-xs">
                {currentUser.full_name ? currentUser.full_name.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="text-left hidden sm:block">
                <div className="leading-tight font-bold">{currentUser.full_name.split(" ")[0]}</div>
                <div
                  className={`text-[10px] font-normal leading-tight ${
                    theme === "dark" ? "text-[#9AA9B5]" : "text-[#71717A]"
                  }`}
                >
                  Pengaturan Akun
                </div>
              </div>
              <Settings className={`w-3.5 h-3.5 ml-0.5 ${theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"}`} />
            </button>
          </div>
        </div>
      </div>

      {/* DASHBOARD CONTENT CONTAINER */}
      <div className="px-6 sm:px-10 lg:px-12 space-y-6 pt-6 pb-12">
        {/* DUA / TIGA MODUL FITUR UTAMA */}
        <div
          className={`grid grid-cols-1 ${
            currentUser?.role === "admin" ? "md:grid-cols-3" : "md:grid-cols-2"
          } gap-4 sm:gap-6`}
        >
          {/* MODUL 1: WORKSPACE AI ASSISTANT */}
          <div
            onClick={() => {
              setCurrentNav("workspace");
              setIsPdfPanelOpen(false);
            }}
            className={`group border rounded-3xl p-6 sm:p-7 transition-all duration-200 shadow-2xs hover:shadow-lg cursor-pointer flex flex-col justify-between relative overflow-hidden ${
              theme === "dark"
                ? "bg-[#1B2127] border-[#2A333B] hover:border-[#34D3BE]"
                : "bg-white border-[#DCE3E8] hover:border-[#0F766E]"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform ${
                      theme === "dark"
                        ? "bg-[#34D3BE] text-[#12161A]"
                        : "bg-gradient-to-tr from-[#0F766E] to-[#14B8A6] text-white"
                    }`}
                  >
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <div>
                    <h2
                      className={`text-lg sm:text-xl font-bold tracking-tight font-claude-serif transition ${
                        theme === "dark" ? "text-[#E6EDF2] group-hover:text-[#34D3BE]" : "text-[#12202B] group-hover:text-[#0F766E]"
                      }`}
                    >
                      Workspace AI Assistant
                    </h2>
                    <span
                      className={`text-xs font-medium block ${
                        theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                      }`}
                    >
                      {chatSessions.length} sesi dialog akademik aktif
                    </span>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                    theme === "dark"
                      ? "bg-[#34D3BE]/15 text-[#34D3BE] border-[#34D3BE]/30"
                      : "bg-[#0F766E]/10 text-[#0F766E] border-[#0F766E]/20"
                  }`}
                >
                  Riset & Sitasi
                </span>
              </div>

              <p
                className={`text-xs sm:text-sm leading-relaxed mb-6 ${
                  theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                }`}
              >
                Tanya jawab literatur farmasi, interaksi obat, dan modul kuliah dengan verifikasi kutipan halaman fisik 1:1 serta integrasi pencarian jurnal akademik PubMed &amp; arXiv.
              </p>
            </div>

            <div
              className={`flex items-center justify-between pt-4 border-t text-xs font-semibold ${
                theme === "dark" ? "border-[#2A333B] text-[#34D3BE]" : "border-[#DCE3E8] text-[#0F766E]"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span>Mulai Percakapan Baru</span>
              </span>
              <div className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                <span>Buka Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* MODUL 2: MYLIBRARY */}
          <div
            onClick={() => setCurrentNav("library")}
            className={`group border rounded-3xl p-6 sm:p-7 transition-all duration-200 shadow-2xs hover:shadow-lg cursor-pointer flex flex-col justify-between relative overflow-hidden ${
              theme === "dark"
                ? "bg-[#1B2127] border-[#2A333B] hover:border-[#34D3BE]"
                : "bg-white border-[#DCE3E8] hover:border-[#0F766E]"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform ${
                      theme === "dark"
                        ? "bg-[#2A333B] text-[#34D3BE] border border-[#34D3BE]/30"
                        : "bg-teal-50 text-[#0F766E] border border-teal-200"
                    }`}
                  >
                    <Library className="w-6 h-6" />
                  </div>
                  <div>
                    <h2
                      className={`text-lg sm:text-xl font-bold tracking-tight font-claude-serif transition ${
                        theme === "dark" ? "text-[#E6EDF2] group-hover:text-[#34D3BE]" : "text-[#12202B] group-hover:text-[#0F766E]"
                      }`}
                    >
                      MyLibrary
                    </h2>
                    <span
                      className={`text-xs font-medium block ${
                        theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                      }`}
                    >
                      {documents.length} dokumen tersimpan & terindeks
                    </span>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                    theme === "dark"
                      ? "bg-[#2A333B] text-[#9AA9B5] border-[#2A333B]"
                      : "bg-[#F7F9FA] text-[#5B6B78] border-[#DCE3E8]"
                  }`}
                >
                  Pustaka Digital
                </span>
              </div>

              <p
                className={`text-xs sm:text-sm leading-relaxed mb-6 ${
                  theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                }`}
              >
                Kelola koleksi e-book, diktat kuliah, formularium obat, dan jurnal pribadi Anda dengan pratinjau lembaran instan dan kontrol penghapusan aman.
              </p>
            </div>

            <div
              className={`flex items-center justify-between pt-4 border-t text-xs font-semibold ${
                theme === "dark" ? "border-[#2A333B] text-[#34D3BE]" : "border-[#DCE3E8] text-[#0F766E]"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span>Kelola & Cari Dokumen</span>
              </span>
              <div className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                <span>Buka MyLibrary</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* MODUL 3: KHUSUS ADMIN & DEVELOPER CONSOLE */}
          {currentUser?.role === "admin" && (
            <div
              onClick={() => setCurrentNav("admin")}
              className={`group border rounded-3xl p-6 sm:p-7 transition-all duration-200 shadow-2xs hover:shadow-lg cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                theme === "dark"
                  ? "bg-[#1B2127] border-[#2A333B] hover:border-rose-500"
                  : "bg-white border-[#DCE3E8] hover:border-rose-500"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform bg-gradient-to-tr from-rose-600 to-amber-500 text-white">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <h2
                        className={`text-lg sm:text-xl font-bold tracking-tight font-claude-serif transition ${
                          theme === "dark" ? "text-[#E6EDF2] group-hover:text-rose-400" : "text-[#12202B] group-hover:text-rose-600"
                        }`}
                      >
                        Admin &amp; Dev Center
                      </h2>
                      <span className="text-xs font-medium text-rose-500 block">
                        Live User Monitor &amp; VPS
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border bg-rose-500/10 text-rose-500 border-rose-500/20">
                    Pusat Kendali
                  </span>
                </div>

                <p
                  className={`text-xs sm:text-sm leading-relaxed mb-6 ${
                    theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                  }`}
                >
                  Pantau aktivitas user secara real-time (pertanyaan, upload, login), inspeksi riwayat chat setiap pengguna, kelola status akun, dan audit log VPS server.
                </p>
              </div>

              <div
                className={`flex items-center justify-between pt-4 border-t text-xs font-semibold ${
                  theme === "dark" ? "border-[#2A333B] text-rose-400" : "border-[#DCE3E8] text-rose-600"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span>Buka Panel Pengawasan</span>
                </span>
                <div className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  <span>Admin Console</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* DUA SEKSI UTAMA: DOKUMEN & SESI TERAKHIR */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* KOLOM 1 & 2: DOKUMEN TERBARU DI MYLIBRARY */}
          <div
            className={`lg:col-span-2 rounded-xl border p-5 shadow-2xs ${
              theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
            }`}
          >
            <div
              className={`flex items-center justify-between pb-3 mb-4 border-b ${
                theme === "dark" ? "border-[#2A333B]" : "border-[#DCE3E8]"
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className={`w-4 h-4 ${theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"}`} />
                <h2
                  className={`text-sm font-bold uppercase tracking-wider font-claude-sans ${
                    theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
                  }`}
                >
                  Dokumen Terkini
                </h2>
              </div>
              <button
                onClick={() => setCurrentNav("library")}
                className={`text-xs font-semibold hover:underline cursor-pointer ${
                  theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"
                }`}
              >
                Buka Pustaka ({documents.length})
              </button>
            </div>

            {documents.length === 0 ? (
              <div
                className={`py-12 text-center rounded-lg border border-dashed ${
                  theme === "dark" ? "border-[#2A333B] text-[#9AA9B5]" : "border-[#DCE3E8] text-[#5B6B78]"
                }`}
              >
                <p className="text-xs mb-3">Belum ada modul atau jurnal yang diunggah.</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border cursor-pointer transition ${
                    theme === "dark"
                      ? "border-[#34D3BE] text-[#34D3BE] hover:bg-[#34D3BE]/10"
                      : "border-[#0F766E] text-[#0F766E] hover:bg-teal-50"
                  }`}
                >
                  Unggah Dokumen PDF
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {documents.slice(0, 5).map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => openDocumentPreview(doc)}
                    className={`flex items-center justify-between p-3 rounded-lg border transition cursor-pointer group ${
                      theme === "dark"
                        ? "bg-[#12161A] border-[#2A333B] hover:border-[#34D3BE]"
                        : "bg-[#F7F9FA] border-[#DCE3E8] hover:border-[#0F766E]"
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden flex-1 pr-3">
                      <FileFormatIcon filename={doc.filename || doc.title} size="md" />
                      <div className="overflow-hidden">
                        <p
                          className={`text-xs font-semibold truncate transition ${
                            theme === "dark" ? "text-[#E6EDF2] group-hover:text-[#34D3BE]" : "text-[#12202B] group-hover:text-[#0F766E]"
                          }`}
                          title={doc.title}
                        >
                          {doc.title}
                        </p>
                        <span
                          className={`text-[10px] block ${
                            theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                          }`}
                        >
                          {doc.total_pages} Halaman • {(doc.file_size_bytes / 1024 / 1024).toFixed(1)} MB
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDoc(doc);
                          setTargetPage(1);
                          setHighlightQuote(null);
                          setIsPdfPanelOpen(true);
                          setCurrentNav("workspace");
                        }}
                        className={`p-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                          theme === "dark"
                            ? "bg-[#1B2127] text-[#34D3BE] border border-[#2A333B] hover:border-[#34D3BE]"
                            : "bg-white text-[#0F766E] border border-[#DCE3E8] hover:border-[#0F766E]"
                        }`}
                        title="Bahas dokumen ini di Workspace"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* KOLOM 3: PERCAKAPAN TERBARU & AKSES CEPAT */}
          <div
            className={`rounded-xl border p-5 shadow-2xs flex flex-col justify-between ${
              theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
            }`}
          >
            <div>
              <div
                className={`flex items-center justify-between pb-3 mb-4 border-b ${
                  theme === "dark" ? "border-[#2A333B]" : "border-[#DCE3E8]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className={`w-4 h-4 ${theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"}`} />
                  <h2
                    className={`text-sm font-bold uppercase tracking-wider font-claude-sans ${
                      theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
                    }`}
                  >
                    Sesi Terbaru
                  </h2>
                </div>
                <button
                  onClick={handleNewChat}
                  className={`text-xs font-bold hover:underline cursor-pointer ${
                    theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"
                  }`}
                >
                  + Sesi Baru
                </button>
              </div>

              {chatSessions.length === 0 ? (
                <div
                  className={`py-8 text-center text-xs ${
                    theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                  }`}
                >
                  Belum ada sesi riset tersimpan.
                </div>
              ) : (
                <div className="space-y-2">
                  {chatSessions.slice(0, 4).map((s) => (
                    <div
                      key={s.id}
                      onClick={() => {
                        handleSelectSession(s.id);
                        setCurrentNav("workspace");
                      }}
                      className={`p-2.5 rounded-lg border transition cursor-pointer text-xs group ${
                        theme === "dark"
                          ? "bg-[#12161A] border-[#2A333B] hover:border-[#34D3BE]"
                          : "bg-[#F7F9FA] border-[#DCE3E8] hover:border-[#0F766E]"
                      }`}
                    >
                      <p
                        className={`font-semibold truncate transition ${
                          theme === "dark" ? "text-[#E6EDF2] group-hover:text-[#34D3BE]" : "text-[#12202B] group-hover:text-[#0F766E]"
                        }`}
                      >
                        {s.title}
                      </p>
                      <span
                        className={`text-[10px] block mt-0.5 ${
                          theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                        }`}
                      >
                        {new Date(s.updated_at || s.created_at).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              className={`pt-4 mt-6 border-t text-[11px] text-center ${
                theme === "dark" ? "border-[#2A333B] text-[#9AA9B5]/80" : "border-[#DCE3E8] text-[#5B6B78]"
              }`}
            >
              EPIONA Pharmacy Research Platform
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
