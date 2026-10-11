"use client";

import React from "react";
import {
  ArrowLeft,
  Clock,
  RefreshCw,
  Sun,
  Moon,
  MessageSquare,
  Activity,
  Users,
  Database,
  Server,
  BookOpen,
  HardDrive,
  UploadCloud,
  User,
  Trash2,
  Eye,
  Search,
  Lock,
  Unlock,
  FileText,
  ExternalLink,
  LogOut,
} from "lucide-react";
import { UserProfile } from "@/types";

interface AdminConsoleViewProps {
  theme: "dark" | "light";
  currentUser: UserProfile;
  setCurrentNav: (nav: "dashboard" | "workspace" | "library" | "admin") => void;
  handleLogout: () => void;
  adminActiveTab: "activity" | "users" | "documents" | "server";
  setAdminActiveTab: (tab: "activity" | "users" | "documents" | "server") => void;
  adminStats: any | null;
  adminActivities: any[];
  adminUsers: any[];
  adminDocuments: any[];
  adminSystemStatus: any | null;
  adminLogs: any[];
  isAdminLoading: boolean;
  adminAutoRefresh: boolean;
  setAdminAutoRefresh: (val: boolean) => void;
  adminSearchFilter: string;
  setAdminSearchFilter: (val: string) => void;
  toggleTheme: () => void;
  fetchAdminStatsAndActivities: () => void;
  fetchAdminTabContent: (tab: "activity" | "users" | "documents" | "server") => void;
  handleInspectUser: (user: any) => void;
  handleToggleUserStatus: (userId: string, currentStatus: boolean) => void;
  apiBase: string;
}

export function AdminConsoleView({
  theme,
  currentUser,
  setCurrentNav,
  handleLogout,
  adminActiveTab,
  setAdminActiveTab,
  adminStats,
  adminActivities,
  adminUsers,
  adminDocuments,
  adminSystemStatus,
  adminLogs,
  isAdminLoading,
  adminAutoRefresh,
  setAdminAutoRefresh,
  adminSearchFilter,
  setAdminSearchFilter,
  toggleTheme,
  fetchAdminStatsAndActivities,
  fetchAdminTabContent,
  handleInspectUser,
  handleToggleUserStatus,
  apiBase,
}: AdminConsoleViewProps) {
  return (
    <div className="flex-1 overflow-y-auto w-full h-full px-4 sm:px-8 lg:px-12 py-6 sm:py-8">
      {/* HEADER ADMIN CONSOLE */}
      <div
        className={`flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-5 border-b ${
          theme === "dark" ? "border-[#2A333B]" : "border-[#DCE3E8]"
        }`}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer bg-rose-600 hover:bg-rose-700 text-white"
            title="Keluar dari sesi Admin & Logout"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
          <button
            onClick={() => setCurrentNav("dashboard")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition shadow-xs cursor-pointer ${
              theme === "dark"
                ? "border-[#2A333B] bg-[#1B2127] hover:bg-[#2A333B] text-[#E6EDF2]"
                : "border-[#DCE3E8] bg-white hover:bg-[#F7F9FA] text-[#12202B]"
            }`}
            title="Beralih ke Tampilan Dashboard"
          >
            <ArrowLeft className="w-4 h-4 text-rose-500" />
            <span>Dashboard</span>
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h2
                className={`text-xl sm:text-2xl font-bold font-claude-serif tracking-tight ${
                  theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
                }`}
              >
                Admin &amp; Developer Console
              </h2>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-500 border border-rose-500/30">
                SUPER ADMIN
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
              Pengawasan real-time aktivitas pengguna, audit dialog chat, manajemen pengguna, dan kesehatan server VPS.
            </p>
          </div>
        </div>

        {/* ACTION TOOLBAR KANAN */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Status Server Badge */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
              theme === "dark" ? "bg-[#12161A] border-[#2A333B] text-emerald-400" : "bg-white border-[#DCE3E8] text-emerald-600"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[11px]">Server VPS Aktif</span>
          </div>

          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAdminAutoRefresh(!adminAutoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer ${
              adminAutoRefresh
                ? "border-teal-500/40 bg-teal-500/10 text-teal-400 font-semibold"
                : theme === "dark" ? "border-[#2A333B] bg-[#1B2127] text-[#9AA9B5]" : "border-[#DCE3E8] bg-white text-[#5B6B78]"
            }`}
            title="Toggle pembaruan data live otomatis setiap 7 detik"
          >
            <Clock className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">Auto-refresh ({adminAutoRefresh ? "ON" : "OFF"})</span>
          </button>

          {/* Tombol Manual Refresh */}
          <button
            onClick={() => {
              fetchAdminStatsAndActivities();
              fetchAdminTabContent(adminActiveTab);
            }}
            disabled={isAdminLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer disabled:opacity-50 ${
              theme === "dark"
                ? "border-[#2A333B] bg-[#1B2127] hover:bg-[#2A333B] text-[#E6EDF2]"
                : "border-[#DCE3E8] bg-white hover:bg-[#F7F9FA] text-[#12202B]"
            }`}
            title="Segarkan data saat ini"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAdminLoading ? "animate-spin text-rose-500" : ""}`} />
            <span className="text-[11px] hidden sm:inline">{isAdminLoading ? "Memuat..." : "Refresh"}</span>
          </button>

          {/* Theme Switcher Button */}
          <button
            onClick={toggleTheme}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
              theme === "dark"
                ? "border-[#2A333B] bg-[#1B2127] text-amber-300 hover:bg-[#2A333B]"
                : "border-[#DCE3E8] bg-white text-[#12202B] hover:bg-[#F7F9FA]"
            }`}
            title={theme === "dark" ? "Mode Terang" : "Mode Gelap"}
          >
            {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5 text-[#5B6B78]" />}
          </button>

          {/* Buka Workspace AI */}
          <button
            onClick={() => setCurrentNav("workspace")}
            className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-xs transition cursor-pointer ${
              theme === "dark"
                ? "bg-[#2A333B] hover:bg-[#2A333B]/80 text-[#E6EDF2] border border-[#2A333B]"
                : "bg-[#12202B] hover:bg-[#12202B]/90 text-white"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-rose-400" />
            <span>Workspace AI</span>
          </button>
        </div>
      </div>

      {/* TAB NAVIGASI INTERNAL ADMIN CONSOLE */}
      <div
        className={`flex items-center gap-2 border-b mb-6 overflow-x-auto scrollbar-none pb-1 ${
          theme === "dark" ? "border-[#2A333B]" : "border-[#DCE3E8]"
        }`}
      >
        <button
          onClick={() => setAdminActiveTab("activity")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition cursor-pointer border-b-2 whitespace-nowrap ${
            adminActiveTab === "activity"
              ? "border-rose-500 text-rose-500 bg-rose-500/5 font-extrabold"
              : theme === "dark"
              ? "border-transparent text-[#9AA9B5] hover:text-[#E6EDF2]"
              : "border-transparent text-[#5B6B78] hover:text-[#12202B]"
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Live Activity &amp; User Monitor</span>
          {adminActivities.length > 0 && (
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                adminActiveTab === "activity" ? "bg-rose-500 text-white" : "bg-[#2A333B] text-[#9AA9B5]"
              }`}
            >
              {adminActivities.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setAdminActiveTab("users")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition cursor-pointer border-b-2 whitespace-nowrap ${
            adminActiveTab === "users"
              ? "border-rose-500 text-rose-500 bg-rose-500/5 font-extrabold"
              : theme === "dark"
              ? "border-transparent text-[#9AA9B5] hover:text-[#E6EDF2]"
              : "border-transparent text-[#5B6B78] hover:text-[#12202B]"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Direktori Pengguna &amp; Chat Inspector</span>
          {adminStats?.total_users ? (
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                adminActiveTab === "users" ? "bg-rose-500 text-white" : "bg-[#2A333B] text-[#9AA9B5]"
              }`}
            >
              {adminStats.total_users}
            </span>
          ) : null}
        </button>

        <button
          onClick={() => setAdminActiveTab("documents")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition cursor-pointer border-b-2 whitespace-nowrap ${
            adminActiveTab === "documents"
              ? "border-rose-500 text-rose-500 bg-rose-500/5 font-extrabold"
              : theme === "dark"
              ? "border-transparent text-[#9AA9B5] hover:text-[#E6EDF2]"
              : "border-transparent text-[#5B6B78] hover:text-[#12202B]"
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Master Dokumen &amp; Kapasitas VPS</span>
          {adminStats?.total_documents ? (
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                adminActiveTab === "documents" ? "bg-rose-500 text-white" : "bg-[#2A333B] text-[#9AA9B5]"
              }`}
            >
              {adminStats.total_documents}
            </span>
          ) : null}
        </button>

        <button
          onClick={() => setAdminActiveTab("server")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition cursor-pointer border-b-2 whitespace-nowrap ${
            adminActiveTab === "server"
              ? "border-rose-500 text-rose-500 bg-rose-500/5 font-extrabold"
              : theme === "dark"
              ? "border-transparent text-[#9AA9B5] hover:text-[#E6EDF2]"
              : "border-transparent text-[#5B6B78] hover:text-[#12202B]"
          }`}
        >
          <Server className="w-4 h-4" />
          <span>Server VPS &amp; Developer Logs</span>
        </button>
      </div>

      {/* TAB 1: LIVE ACTIVITY & USER MONITOR */}
      {adminActiveTab === "activity" && (
        <div className="space-y-6">
          {/* 4 KARTU METRIK STATISTIK UTAMA */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              className={`p-4 rounded-2xl border shadow-xs ${
                theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                  Total Pengguna
                </span>
                <Users className="w-4 h-4 text-rose-500" />
              </div>
              <div className={`text-2xl font-bold mt-2 ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
                {adminStats?.total_users ?? 0}
              </div>
              <span className="text-[11px] text-emerald-500 font-semibold mt-1 block">
                Akun mahasiswa &amp; peneliti
              </span>
            </div>

            <div
              className={`p-4 rounded-2xl border shadow-xs ${
                theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                  Aktivitas Dialog Chat
                </span>
                <MessageSquare className="w-4 h-4 text-teal-500" />
              </div>
              <div className={`text-2xl font-bold mt-2 ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
                {adminStats?.total_messages ?? 0}
              </div>
              <span className={`text-[11px] font-medium mt-1 block ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                Dari {adminStats?.total_sessions ?? 0} sesi riset akademik
              </span>
            </div>

            <div
              className={`p-4 rounded-2xl border shadow-xs ${
                theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                  Dokumen &amp; Modul
                </span>
                <BookOpen className="w-4 h-4 text-indigo-500" />
              </div>
              <div className={`text-2xl font-bold mt-2 ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
                {adminStats?.total_documents ?? 0}
              </div>
              <span className={`text-[11px] font-medium mt-1 block ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                Total {adminStats?.total_pages ?? 0} halaman diekstraksi
              </span>
            </div>

            <div
              className={`p-4 rounded-2xl border shadow-xs ${
                theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                  Penyimpanan VPS
                </span>
                <HardDrive className="w-4 h-4 text-amber-500" />
              </div>
              <div className={`text-2xl font-bold mt-2 ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
                {adminStats?.storage_mb ?? 0} MB
              </div>
              <span className="text-[11px] text-teal-500 font-semibold mt-1 block">
                Deduplikasi SHA-256 aktif
              </span>
            </div>
          </div>

          {/* TIMELINE FEED AKTIVITAS PENGGUNA */}
          <div
            className={`rounded-2xl border shadow-xs overflow-hidden ${
              theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
            }`}
          >
            <div
              className={`p-4 border-b flex items-center justify-between ${
                theme === "dark" ? "border-[#2A333B] bg-[#12161A]/50" : "border-[#DCE3E8] bg-[#F7F9FA]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Activity className="w-4 h-4 text-rose-500" />
                <h3 className={`text-sm font-bold ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
                  Linimasa Aktivitas Terkini (Apa yang Sedang Dikerjakan User)
                </h3>
              </div>
              <span className={`text-[11px] ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                {adminActivities.length} peristiwa terekam
              </span>
            </div>

            {adminActivities.length === 0 ? (
              <div className="p-12 text-center">
                <Activity className={`w-8 h-8 mx-auto mb-2 opacity-30 ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`} />
                <p className={`text-xs ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                  Belum ada aktivitas user yang dicatat hari ini.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#2A333B]/40 max-h-[600px] overflow-y-auto">
                {adminActivities.map((act) => {
                  const isChat = act.action_type === "chat_prompt";
                  const isUpload = act.action_type === "upload_document";
                  const isLogin = act.action_type === "login";
                  const isDelete = act.action_type === "delete_document";

                  return (
                    <div
                      key={act.id}
                      className={`p-4 transition flex items-start gap-3.5 hover:bg-black/5 dark:hover:bg-white/5 ${
                        isChat ? "bg-blue-500/5" : ""
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-xs ${
                          isChat
                            ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                            : isUpload
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : isLogin
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            : isDelete
                            ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                            : "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                        }`}
                      >
                        {isChat && <MessageSquare className="w-4 h-4" />}
                        {isUpload && <UploadCloud className="w-4 h-4" />}
                        {isLogin && <User className="w-4 h-4" />}
                        {isDelete && <Trash2 className="w-4 h-4" />}
                        {!isChat && !isUpload && !isLogin && !isDelete && <Activity className="w-4 h-4" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-bold ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
                              {act.user_name}
                            </span>
                            <span className={`text-[11px] font-mono ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                              &lt;{act.user_email}&gt;
                            </span>
                            <span
                              className={`text-[9.5px] font-bold px-2 py-0.2 rounded-full uppercase tracking-wider ${
                                isChat
                                  ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                                  : isUpload
                                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                  : isLogin
                                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                                  : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                              }`}
                            >
                              {act.action_type.replace("_", " ")}
                            </span>
                          </div>
                          <span className={`text-[10px] shrink-0 font-mono ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                            {new Date(act.created_at).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </span>
                        </div>

                        <p
                          className={`text-xs mt-1.5 leading-relaxed font-claude-sans ${
                            isChat
                              ? theme === "dark" ? "text-cyan-200" : "text-cyan-900 font-semibold"
                              : theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
                          }`}
                        >
                          {act.description}
                        </p>

                        <div className="flex items-center justify-between mt-2 pt-1">
                          <span className={`text-[10px] font-mono ${theme === "dark" ? "text-[#9AA9B5]/70" : "text-[#5B6B78]/70"}`}>
                            IP: {act.ip_address} • {new Date(act.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                          </span>

                          <button
                            onClick={() => handleInspectUser({ id: act.user_id, email: act.user_email, full_name: act.user_name })}
                            className={`text-[11px] font-bold flex items-center gap-1 cursor-pointer transition ${
                              theme === "dark" ? "text-rose-400 hover:text-rose-300" : "text-rose-600 hover:text-rose-700"
                            }`}
                            title="Inspeksi seluruh riwayat percakapan user ini"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Inspeksi Dialog User</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DIREKTORI PENGGUNA */}
      {adminActiveTab === "users" && (
        <div className="space-y-6">
          <div
            className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs ${
              theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
            }`}
          >
            <div className="relative w-full sm:max-w-md">
              <Search
                className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${
                  theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                }`}
              />
              <input
                type="text"
                value={adminSearchFilter}
                onChange={(e) => setAdminSearchFilter(e.target.value)}
                placeholder="Cari pengguna berdasarkan nama atau email..."
                className={`w-full text-xs pl-9 pr-3 py-2 rounded-xl border focus:outline-none transition ${
                  theme === "dark"
                    ? "bg-[#12161A] border-[#2A333B] text-[#E6EDF2] focus:border-rose-500 placeholder-[#9AA9B5]/60"
                    : "bg-white border-[#DCE3E8] text-[#12202B] focus:border-rose-500 placeholder-[#5B6B78]/60"
                }`}
              />
            </div>
            <div className={`text-xs font-medium ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
              Total {adminUsers.length} pengguna terdaftar
            </div>
          </div>

          <div
            className={`rounded-2xl border shadow-xs overflow-hidden ${
              theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
            }`}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead
                  className={`border-b text-[11px] font-bold uppercase tracking-wider ${
                    theme === "dark" ? "bg-[#12161A] border-[#2A333B] text-[#9AA9B5]" : "bg-[#F7F9FA] border-[#DCE3E8] text-[#5B6B78]"
                  }`}
                >
                  <tr>
                    <th className="px-4 py-3.5">Pengguna</th>
                    <th className="px-4 py-3.5">Peran (Role)</th>
                    <th className="px-4 py-3.5">Status Akun</th>
                    <th className="px-4 py-3.5">Terakhir Aktif</th>
                    <th className="px-4 py-3.5">Penggunaan (Doc / Chat)</th>
                    <th className="px-4 py-3.5 text-right">Aksi &amp; Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A333B]/40">
                  {adminUsers
                    .filter(
                      (u) =>
                        !adminSearchFilter ||
                        u.full_name.toLowerCase().includes(adminSearchFilter.toLowerCase()) ||
                        u.email.toLowerCase().includes(adminSearchFilter.toLowerCase())
                    )
                    .map((u) => {
                      const isSuperAdmin = u.email === "admin@epiona.my.id";
                      return (
                        <tr key={u.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition">
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
                                {u.full_name ? u.full_name.charAt(0).toUpperCase() : "U"}
                              </div>
                              <div>
                                <p className={`font-bold ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
                                  {u.full_name}
                                </p>
                                <span className={`text-[11px] font-mono ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                                  {u.email}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                u.role === "admin"
                                  ? "bg-rose-500/15 text-rose-500 border border-rose-500/30"
                                  : "bg-teal-500/15 text-teal-400 border border-teal-500/30"
                              }`}
                            >
                              {u.role || "user"}
                            </span>
                          </td>

                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                u.is_active
                                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                  : "bg-rose-500/15 text-rose-500 border border-rose-500/30"
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? "bg-emerald-500" : "bg-rose-500"}`}></span>
                              <span>{u.is_active ? "Aktif" : "Diblokir"}</span>
                            </span>
                          </td>

                          <td className="px-4 py-3.5">
                            <span className={`text-[11px] font-mono ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                              {u.last_active_at
                                ? new Date(u.last_active_at).toLocaleString("id-ID", {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  })
                                : "-"}
                            </span>
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1 text-[11px]" title="Total Dokumen di Library">
                                <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                                <span>{u.total_documents ?? 0} dok</span>
                              </span>
                              <span className="flex items-center gap-1 text-[11px]" title="Total Pesan Chat">
                                <MessageSquare className="w-3.5 h-3.5 text-teal-400" />
                                <span>{u.total_messages ?? 0} prompt</span>
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleInspectUser(u)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500 hover:text-white transition text-[11px] font-bold cursor-pointer"
                                title="Buka seluruh transkrip percakapan pengguna ini"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Inspeksi Chat</span>
                              </button>

                              {!isSuperAdmin && (
                                <button
                                  onClick={() => handleToggleUserStatus(u.id, u.is_active)}
                                  className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                    u.is_active
                                      ? "border-rose-500/30 text-rose-400 hover:bg-rose-500 hover:text-white"
                                      : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-white"
                                  }`}
                                  title={u.is_active ? "Blokir akun pengguna ini" : "Aktifkan kembali akun ini"}
                                >
                                  {u.is_active ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MASTER DOKUMEN VPS */}
      {adminActiveTab === "documents" && (
        <div className="space-y-6">
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between shadow-xs ${
              theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
            }`}
          >
            <div>
              <h3 className={`text-sm font-bold ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
                Master Berkas PDF di Server VPS
              </h3>
              <p className={`text-xs mt-0.5 ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                Seluruh dokumen yang tersimpan fisik di direktori server dengan dukungan deduplikasi reference-counting.
              </p>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-rose-500">{adminDocuments.length} Dokumen</span>
              <span className={`block text-[11px] ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                Kapasitas Total: {adminStats?.storage_mb ?? 0} MB
              </span>
            </div>
          </div>

          <div
            className={`rounded-2xl border shadow-xs overflow-hidden ${
              theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
            }`}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead
                  className={`border-b text-[11px] font-bold uppercase tracking-wider ${
                    theme === "dark" ? "bg-[#12161A] border-[#2A333B] text-[#9AA9B5]" : "bg-[#F7F9FA] border-[#DCE3E8] text-[#5B6B78]"
                  }`}
                >
                  <tr>
                    <th className="px-4 py-3.5">Dokumen</th>
                    <th className="px-4 py-3.5">Pemilik (Akses User)</th>
                    <th className="px-4 py-3.5">Halaman</th>
                    <th className="px-4 py-3.5">Ukuran</th>
                    <th className="px-4 py-3.5">Checksum Hash</th>
                    <th className="px-4 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A333B]/40">
                  {adminDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <FileText className="w-5 h-5 text-rose-500 shrink-0" />
                          <div>
                            <p className={`font-bold ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
                              {doc.title}
                            </p>
                            <span className={`text-[10px] font-mono ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                              {doc.filename}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-1">
                          {doc.owners && doc.owners.length > 0 ? (
                            doc.owners.map((ow: any) => (
                              <span
                                key={ow.id}
                                className={`text-[11px] font-mono ${
                                  theme === "dark" ? "text-cyan-300" : "text-cyan-800 font-semibold"
                                }`}
                              >
                                • {ow.full_name} ({ow.email})
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-amber-500">Global System File</span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 font-bold">{doc.total_pages} Hlm</td>
                      <td className="px-4 py-3.5 font-mono">{doc.file_size_mb} MB</td>
                      <td className="px-4 py-3.5 font-mono text-[10px] text-slate-400 truncate max-w-xs" title={doc.file_hash}>
                        {doc.file_hash ? `${doc.file_hash.substring(0, 16)}...` : "-"}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <a
                          href={`${apiBase}/api/v1/documents/${doc.id}/pdf?token=${currentUser?.token}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/30 hover:bg-teal-500 hover:text-white transition text-[11px] font-bold"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Buka PDF</span>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SERVER VPS & DEVELOPER LOGS */}
      {adminActiveTab === "server" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              className={`p-4 rounded-2xl border shadow-xs ${
                theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
              }`}
            >
              <span className={`text-[11px] font-medium ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                Sistem Operasi Host
              </span>
              <p className={`text-sm font-bold mt-1.5 truncate ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
                {adminSystemStatus?.platform || "Windows / Linux VPS"}
              </p>
            </div>

            <div
              className={`p-4 rounded-2xl border shadow-xs ${
                theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
              }`}
            >
              <span className={`text-[11px] font-medium ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                Database Engine
              </span>
              <p className="text-sm font-bold mt-1.5 text-emerald-500">
                {adminSystemStatus?.database_type || "MYSQL"} (Terhubung)
              </p>
            </div>

            <div
              className={`p-4 rounded-2xl border shadow-xs ${
                theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
              }`}
            >
              <span className={`text-[11px] font-medium ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                AI Engine Provider
              </span>
              <p className="text-sm font-bold mt-1.5 text-cyan-400">
                {adminSystemStatus?.ai_service?.active_provider || "Gemini / Groq Hybrid"}
              </p>
            </div>

            <div
              className={`p-4 rounded-2xl border shadow-xs ${
                theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
              }`}
            >
              <span className={`text-[11px] font-medium ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                Process ID (PID)
              </span>
              <p className="text-sm font-bold mt-1.5 font-mono text-amber-400">
                PID: {adminSystemStatus?.process_id || "Active"}
              </p>
            </div>
          </div>

          {/* TERMINAL AUDIT LOGS VIEWER */}
          <div className="rounded-2xl border border-slate-800 bg-[#0d1117] text-slate-200 shadow-xl overflow-hidden font-mono text-xs">
            <div className="bg-[#161b22] px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                  <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                  <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                </div>
                <span className="text-[11px] font-bold text-slate-400 ml-2">
                  bash - epiona-vps-audit.log (Live Developer Console)
                </span>
              </div>
              <span className="text-[10px] text-emerald-400 font-bold">STREAM LIVE</span>
            </div>

            <div className="p-4 space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin">
              {adminLogs.length === 0 ? (
                <div className="text-slate-500 py-6 text-center">Memuat baris log backend...</div>
              ) : (
                adminLogs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2 leading-relaxed hover:bg-white/5 p-1 rounded">
                    <span className="text-slate-500 shrink-0 select-none">
                      [{new Date(log.timestamp).toLocaleTimeString()}]
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${
                        log.source.includes("CHAT")
                          ? "bg-blue-900/60 text-blue-300"
                          : log.source.includes("UPLOAD")
                          ? "bg-emerald-900/60 text-emerald-300"
                          : log.source.includes("LOGIN")
                          ? "bg-amber-900/60 text-amber-300"
                          : "bg-purple-900/60 text-purple-300"
                      }`}
                    >
                      {log.source}
                    </span>
                    <span className="text-cyan-400 shrink-0">{log.user}:</span>
                    <span className="text-slate-200 break-words">{log.message}</span>
                    <span className="text-slate-600 ml-auto shrink-0 text-[10px]">({log.ip})</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
