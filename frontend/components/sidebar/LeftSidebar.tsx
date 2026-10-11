"use client";

import React from "react";
import {
  PanelLeftClose,
  SquarePen,
  Search,
  X,
  Folder,
  ShieldCheck,
  MessageSquare,
  MoreVertical,
  Trash2,
  Settings,
} from "lucide-react";
import { ChatSessionItem, DocumentItem, UserProfile } from "@/types";

interface LeftSidebarProps {
  theme: "dark" | "light";
  currentUser: UserProfile;
  currentNav: "dashboard" | "workspace" | "library" | "admin";
  setCurrentNav: (nav: "dashboard" | "workspace" | "library" | "admin") => void;
  isLeftSidebarOpen: boolean;
  setIsLeftSidebarOpen: (open: boolean) => void;
  chatSessions: ChatSessionItem[];
  currentSessionId: string | null;
  documents: DocumentItem[];
  sidebarSearchQuery: string;
  setSidebarSearchQuery: (query: string) => void;
  isSearchingSessions: boolean;
  setIsSearchingSessions: (searching: boolean) => void;
  editingSessionId: string | null;
  setEditingSessionId: (id: string | null) => void;
  editingSessionTitle: string;
  setEditingSessionTitle: (title: string) => void;
  activeSessionMenuId: string | null;
  setActiveSessionMenuId: (id: string | null) => void;
  handleNewChat: () => void;
  handleSelectSession: (id: string) => void;
  handleRenameSession: (id: string, newTitle: string) => void;
  handleDeleteSession: (id: string, e: React.MouseEvent) => void;
  handleLogout: () => void;
}

export function LeftSidebar({
  theme,
  currentUser,
  currentNav,
  setCurrentNav,
  isLeftSidebarOpen,
  setIsLeftSidebarOpen,
  chatSessions,
  currentSessionId,
  documents,
  sidebarSearchQuery,
  setSidebarSearchQuery,
  isSearchingSessions,
  setIsSearchingSessions,
  editingSessionId,
  setEditingSessionId,
  editingSessionTitle,
  setEditingSessionTitle,
  activeSessionMenuId,
  setActiveSessionMenuId,
  handleNewChat,
  handleSelectSession,
  handleRenameSession,
  handleDeleteSession,
  handleLogout,
}: LeftSidebarProps) {
  return (
    <aside
      className={`${
        isLeftSidebarOpen ? "w-64" : "w-0"
      } ${
        theme === "dark"
          ? "bg-[#1B2127] border-[#2A333B] text-[#E6EDF2]"
          : "bg-[#FFFFFF] border-[#DCE3E8] text-[#12202B]"
      } border-r flex flex-col justify-between shrink-0 transition-all duration-200 overflow-hidden z-20 select-none`}
    >
      <div className="flex-1 flex flex-col min-h-0 w-64">
        {/* BRAND BAR & TOGGLE CLOSE */}
        <div className="px-3 pt-3 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center font-extrabold text-[11px] shadow-xs ${
                theme === "dark" ? "bg-[#34D3BE] text-[#12161A]" : "bg-[#0F766E] text-white"
              }`}
            >
              E
            </div>
            <span
              className={`font-bold text-xs tracking-tight font-claude-serif ${
                theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
              }`}
            >
              Epiona Assistant
            </span>
          </div>
          <button
            onClick={() => setIsLeftSidebarOpen(false)}
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              theme === "dark"
                ? "text-[#9AA9B5] hover:text-[#E6EDF2] hover:bg-[#2A333B]"
                : "text-[#5B6B78] hover:text-[#12202B] hover:bg-[#F7F9FA]"
            }`}
            title="Tutup sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* NAVIGASI ATAS: PERCAKAPAN BARU, TELUSURI PERCAKAPAN, SEMUA NOTEBOOK */}
        <div className="px-2 py-1 space-y-0.5">
          {/* TOMBOL 1: PERCAKAPAN BARU */}
          <button
            onClick={handleNewChat}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
              theme === "dark"
                ? "text-[#E6EDF2] hover:bg-[#2A333B]"
                : "text-[#12202B] hover:bg-[#F7F9FA]"
            }`}
          >
            <SquarePen className={`w-4 h-4 shrink-0 ${theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"}`} />
            <span>Percakapan baru</span>
          </button>

          {/* TOMBOL 2: TELUSURI PERCAKAPAN */}
          <button
            onClick={() => setIsSearchingSessions(!isSearchingSessions)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
              isSearchingSessions
                ? theme === "dark" ? "bg-[#2A333B] text-[#E6EDF2]" : "bg-[#F7F9FA] text-[#12202B]"
                : theme === "dark" ? "text-[#9AA9B5] hover:bg-[#2A333B] hover:text-[#E6EDF2]" : "text-[#5B6B78] hover:bg-[#F7F9FA] hover:text-[#12202B]"
            }`}
          >
            <Search className={`w-4 h-4 shrink-0 ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`} />
            <span>Telusuri percakapan</span>
          </button>

          {/* INPUT SEARCH EXPANDABLE JIKA TELUSURI DIKLIK */}
          {isSearchingSessions && (
            <div className="px-1 pt-1 pb-1 animate-in fade-in duration-100">
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  value={sidebarSearchQuery}
                  onChange={(e) => setSidebarSearchQuery(e.target.value)}
                  placeholder="Ketik kata kunci percakapan..."
                  className={`w-full text-xs px-2.5 py-1.5 rounded-lg border focus:outline-none transition ${
                    theme === "dark"
                      ? "bg-[#12161A] border-[#2A333B] text-[#E6EDF2] placeholder-[#9AA9B5]/60 focus:border-[#34D3BE]"
                      : "bg-white border-[#DCE3E8] text-[#12202B] placeholder-[#5B6B78]/60 focus:border-[#0F766E]"
                  }`}
                />
                {sidebarSearchQuery && (
                  <button
                    onClick={() => setSidebarSearchQuery("")}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer ${
                      theme === "dark" ? "text-[#9AA9B5] hover:text-[#E6EDF2]" : "text-[#5B6B78] hover:text-[#12202B]"
                    }`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TOMBOL 3: SEMUA NOTEBOOK (MYLIBRARY) */}
          <button
            onClick={() => setCurrentNav("library")}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
              theme === "dark"
                ? "text-[#9AA9B5] hover:bg-[#2A333B] hover:text-[#E6EDF2]"
                : "text-[#5B6B78] hover:bg-[#F7F9FA] hover:text-[#12202B]"
            }`}
          >
            <div className="flex items-center gap-3">
              <Folder className={`w-4 h-4 shrink-0 ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`} />
              <span>Semua notebook</span>
            </div>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                theme === "dark" ? "bg-[#2A333B] text-[#9AA9B5]" : "bg-[#F7F9FA] text-[#5B6B78] border border-[#DCE3E8]"
              }`}
            >
              {documents.length}
            </span>
          </button>

          {/* TOMBOL 4: KHUSUS ADMIN & DEVELOPER CONSOLE */}
          {currentUser?.role === "admin" && (
            <button
              onClick={() => setCurrentNav("admin")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                (currentNav as string) === "admin"
                  ? "bg-rose-500/15 text-rose-500 border border-rose-500/30 font-bold"
                  : theme === "dark"
                  ? "text-rose-400 hover:bg-[#2A333B] hover:text-rose-300"
                  : "text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              }`}
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 shrink-0 text-rose-500" />
                <span>Admin &amp; Dev Center</span>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-bold tracking-wider">
                ADMIN
              </span>
            </button>
          )}
        </div>

        {/* DAFTAR RIWAYAT PERCAKAPAN (KATEGORI: TERBARU) */}
        <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-thin">
          <div
            className={`px-3 pt-3 pb-1.5 text-xs font-medium ${
              theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
            }`}
          >
            Terbaru
          </div>

          {chatSessions.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <MessageSquare
                className={`w-5 h-5 mx-auto mb-2 opacity-30 ${
                  theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                }`}
              />
              <p className={`text-xs ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                Belum ada percakapan
              </p>
              <p
                className={`text-[10px] mt-1 ${
                  theme === "dark" ? "text-[#9AA9B5]/80" : "text-[#5B6B78]/80"
                }`}
              >
                Mulai obrolan baru dengan asisten
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {chatSessions
                .filter((s) => s.title.toLowerCase().includes(sidebarSearchQuery.toLowerCase()))
                .map((sess) => {
                  const isActive = currentSessionId === sess.id;
                  const isEditing = editingSessionId === sess.id;

                  if (isEditing) {
                    return (
                      <div
                        key={sess.id}
                        className={`p-1.5 rounded-xl border ${
                          theme === "dark" ? "bg-[#12161A] border-[#34D3BE]" : "bg-white border-[#0F766E]"
                        }`}
                      >
                        <input
                          type="text"
                          autoFocus
                          value={editingSessionTitle}
                          onChange={(e) => setEditingSessionTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleRenameSession(sess.id, editingSessionTitle);
                            } else if (e.key === "Escape") {
                              setEditingSessionId(null);
                            }
                          }}
                          className={`w-full text-xs px-2 py-1 rounded bg-transparent focus:outline-none ${
                            theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
                          }`}
                        />
                        <div className="flex items-center justify-end gap-1.5 mt-1 px-1">
                          <button
                            onClick={() => setEditingSessionId(null)}
                            className={`text-[10px] px-1.5 py-0.5 cursor-pointer ${
                              theme === "dark" ? "text-[#9AA9B5] hover:text-[#E6EDF2]" : "text-[#5B6B78] hover:text-[#12202B]"
                            }`}
                          >
                            Batal
                          </button>
                          <button
                            onClick={() => handleRenameSession(sess.id, editingSessionTitle)}
                            className={`text-[10px] px-2 py-0.5 rounded font-bold cursor-pointer ${
                              theme === "dark" ? "bg-[#34D3BE] text-[#12161A]" : "bg-[#0F766E] text-white"
                            }`}
                          >
                            Simpan
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={sess.id}
                      onClick={() => handleSelectSession(sess.id)}
                      className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition relative ${
                        isActive
                          ? theme === "dark"
                            ? "bg-[#2A333B] text-[#E6EDF2] font-semibold shadow-xs"
                            : "bg-[#F7F9FA] text-[#12202B] font-semibold border border-[#DCE3E8] shadow-xs"
                          : theme === "dark"
                          ? "text-[#9AA9B5] hover:bg-[#2A333B]/70 hover:text-[#E6EDF2]"
                          : "text-[#5B6B78] hover:bg-[#F7F9FA] hover:text-[#12202B]"
                      }`}
                    >
                      <span className="truncate flex-1 pr-1.5 text-xs tracking-tight" title={sess.title}>
                        {sess.title}
                      </span>

                      {/* TOMBOL TITIK 3 (MORE) */}
                      <div className="relative shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveSessionMenuId(activeSessionMenuId === sess.id ? null : sess.id);
                          }}
                          className={`p-1 rounded-md transition cursor-pointer ${
                            isActive
                              ? theme === "dark" ? "opacity-100 text-[#E6EDF2] hover:bg-[#12161A]/60" : "opacity-100 text-[#12202B] hover:bg-white"
                              : theme === "dark" ? "opacity-0 group-hover:opacity-100 text-[#9AA9B5] hover:text-[#E6EDF2] hover:bg-[#12161A]/60" : "opacity-0 group-hover:opacity-100 text-[#5B6B78] hover:text-[#12202B] hover:bg-white"
                          }`}
                          title="Opsi percakapan"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        {/* POPUP MENU TITIK 3 */}
                        {activeSessionMenuId === sess.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className={`absolute right-0 top-full mt-1 w-36 rounded-xl shadow-xl z-30 py-1 text-xs border animate-in fade-in duration-100 ${
                              theme === "dark"
                                ? "bg-[#1B2127] border-[#2A333B] text-[#E6EDF2]"
                                : "bg-white border-[#DCE3E8] text-[#12202B]"
                            }`}
                          >
                            <button
                              onClick={() => {
                                setActiveSessionMenuId(null);
                                setEditingSessionId(sess.id);
                                setEditingSessionTitle(sess.title);
                              }}
                              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition font-medium cursor-pointer ${
                                theme === "dark" ? "hover:bg-[#2A333B]" : "hover:bg-[#F7F9FA]"
                              }`}
                            >
                              <SquarePen className={`w-3.5 h-3.5 ${theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"}`} />
                              <span>Ubah nama</span>
                            </button>
                            <button
                              onClick={(e) => {
                                setActiveSessionMenuId(null);
                                handleDeleteSession(sess.id, e);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-rose-500 hover:bg-rose-500/10 transition font-medium cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              <span>Hapus</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* FOOTER PENGGUNA */}
      <div
        className={`p-3 border-t ${
          theme === "dark"
            ? "border-[#2A333B] bg-[#12161A]"
            : "border-[#DCE3E8] bg-[#F7F9FA]"
        }`}
      >
        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-2.5 overflow-hidden flex-1 cursor-pointer"
            onClick={() => setCurrentNav("dashboard")}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
              {currentUser.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p
                className={`text-xs font-semibold truncate leading-tight ${
                  theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
                }`}
              >
                {currentUser.full_name}
              </p>
              <span
                className={`text-[10px] font-semibold block ${
                  currentUser.role === "admin"
                    ? "text-rose-500 font-bold"
                    : theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                }`}
              >
                {currentUser.role === "admin" ? "Administrator & Dev" : "Pro"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleLogout}
              title="Keluar / Pengaturan Akun"
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                theme === "dark"
                  ? "text-[#9AA9B5] hover:text-[#E6EDF2] hover:bg-[#2A333B]"
                : "text-[#5B6B78] hover:text-[#12202B] hover:bg-[#FFFFFF]"
              }`}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
