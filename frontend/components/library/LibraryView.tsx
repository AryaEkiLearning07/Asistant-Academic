"use client";

import React, { useState } from "react";
import {
  ArrowLeft,
  Sun,
  Moon,
  MessageSquare,
  Upload,
  BookOpen,
  Search,
  X,
  MoreVertical,
  Download,
  Trash2,
  Calendar,
  Layers,
  ChevronRight,
} from "lucide-react";
import { DocumentItem, ChatSessionItem, UserProfile } from "@/types";
import { FileFormatIcon } from "@/components/library/FileFormatIcon";

interface LibraryViewProps {
  theme: "dark" | "light";
  currentUser: UserProfile;
  setCurrentNav: (nav: "dashboard" | "workspace" | "library" | "admin") => void;
  documents: DocumentItem[];
  librarySearch: string;
  setLibrarySearch: (search: string) => void;
  activeMenuDocId: string | null;
  setActiveMenuDocId: (id: string | null) => void;
  isUploading: boolean;
  uploadNotice: string | null;
  toggleTheme: () => void;
  setIsPdfPanelOpen: (open: boolean) => void;
  openDocumentPreview: (doc: DocumentItem) => void;
  handleDeleteDocument: (docId: string, docTitle: string, e: React.MouseEvent) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  apiBase: string;
  chatSessions?: ChatSessionItem[];
  handleSelectSession?: (id: string) => void;
}

export function LibraryView({
  theme,
  currentUser,
  setCurrentNav,
  documents,
  librarySearch,
  setLibrarySearch,
  activeMenuDocId,
  setActiveMenuDocId,
  isUploading,
  uploadNotice,
  toggleTheme,
  setIsPdfPanelOpen,
  openDocumentPreview,
  handleDeleteDocument,
  fileInputRef,
  apiBase,
  chatSessions = [],
  handleSelectSession,
}: LibraryViewProps) {
  const [filterType, setFilterType] = useState<"all" | "recent" | "pdf">("all");

  const filteredDocs = documents.filter((d) => {
    const matchQuery = d.title.toLowerCase().includes(librarySearch.toLowerCase());
    if (!matchQuery) return false;
    if (filterType === "pdf") return d.filename?.toLowerCase().endsWith(".pdf");
    return true;
  });

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto w-full h-full bg-bg text-text">
      {/* HEADER SECTION */}
      <header className="h-14 px-6 border-b border-border bg-surface flex items-center justify-between shrink-0 select-none sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCurrentNav("dashboard")}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[12px] font-medium bg-surface-2 hover:bg-surface text-text border border-border transition cursor-pointer"
            title="Kembali ke Beranda"
          >
            <ArrowLeft className="w-3.5 h-3.5 stroke-[1.75]" />
            <span>Beranda</span>
          </button>
          <div>
            <h1 className="text-[16px] font-semibold text-text tracking-tight">
              MyLibrary
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="w-8 h-8 flex items-center justify-center rounded-sm text-text-muted hover:text-text hover:bg-surface-2 transition cursor-pointer"
            title={theme === "dark" ? "Mode Terang" : "Mode Gelap"}
            aria-label="Ganti tema"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400 stroke-[1.75]" />
            ) : (
              <Moon className="w-4 h-4 stroke-[1.75]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setCurrentNav("workspace");
              setIsPdfPanelOpen(false);
            }}
            className="flex items-center gap-1.5 h-8 px-3 rounded-sm text-[12px] font-medium bg-surface-2 hover:bg-surface text-text border border-border transition cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5 stroke-[1.75]" />
            <span>Workspace</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 h-8 px-3.5 rounded-sm text-[12px] font-semibold bg-accent text-white hover:bg-accent/90 transition disabled:opacity-50 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 stroke-[2]" />
            <span>{isUploading ? "Mengindeks..." : "Unggah"}</span>
          </button>
        </div>
      </header>

      {/* CONTENT WRAPPER */}
      <main className="max-w-6xl mx-auto px-6 py-6 space-y-8">
        {uploadNotice && (
          <div className="p-3 rounded-md text-[13px] bg-accent-soft text-accent border border-accent/20">
            {uploadNotice}
          </div>
        )}

        {/* SECTION 1: DOKUMEN MYLIBRARY */}
        <section className="space-y-4">
          {/* TOOLBAR CARI + FILTER + TOMBOL UNGGAH */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none stroke-[1.75]" />
              <input
                type="text"
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                placeholder="Cari dokumen MyLibrary…"
                className="w-full h-8 pl-9 pr-8 text-[13px] rounded-sm border border-border bg-surface text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
              {librarySearch && (
                <button
                  type="button"
                  onClick={() => setLibrarySearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 select-none">
              <button
                type="button"
                onClick={() => setFilterType("all")}
                className={`h-7 px-2.5 rounded-sm text-[12px] font-medium transition cursor-pointer border ${
                  filterType === "all"
                    ? "bg-surface-2 text-text border-border font-semibold"
                    : "text-text-muted hover:text-text border-transparent"
                }`}
              >
                Semua ({documents.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType("pdf")}
                className={`h-7 px-2.5 rounded-sm text-[12px] font-medium transition cursor-pointer border ${
                  filterType === "pdf"
                    ? "bg-surface-2 text-text border-border font-semibold"
                    : "text-text-muted hover:text-text border-transparent"
                }`}
              >
                PDF
              </button>
            </div>
          </div>

          {/* GRID KARTU DOKUMEN 3 KOLOM (240 lebar per kartu) */}
          {filteredDocs.length === 0 ? (
            <div className="p-8 text-center rounded-md border border-dashed border-border text-text-muted text-[13px]">
              {documents.length === 0
                ? "Belum ada dokumen di MyLibrary. Klik tombol Unggah di atas untuk menambahkan PDF rujukan."
                : `Tidak ditemukan dokumen dengan judul "${librarySearch}".`}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => openDocumentPreview(doc)}
                  className="group relative flex flex-col justify-between w-full min-w-[240px] p-3.5 rounded-md border border-border bg-surface hover:border-accent-soft hover:bg-surface-2 transition cursor-pointer"
                >
                  <div>
                    {/* Baris 1: Ikon Tipe + Menu Aksi */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileFormatIcon filename={doc.filename || doc.title} size="sm" />
                        <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                          PDF
                        </span>
                      </div>

                      {/* Dropdown Menu Opsi Dokumen */}
                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveMenuDocId(activeMenuDocId === doc.id ? null : doc.id)
                          }
                          className="p-1 rounded-sm text-text-muted hover:text-text hover:bg-surface transition cursor-pointer"
                          title="Opsi dokumen"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        {activeMenuDocId === doc.id && (
                          <div
                            className="absolute right-0 top-full mt-1 w-36 rounded-md bg-surface border border-border shadow-popover p-1 z-30"
                            style={{ boxShadow: "0 8px 24px rgba(0,0,0,.12)" }}
                          >
                            <a
                              href={`${apiBase}/api/v1/documents/${doc.id}/pdf?download=1&token=${currentUser.token}`}
                              download={doc.filename}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-[12px] text-text hover:bg-surface-2 transition"
                            >
                              <Download className="w-3.5 h-3.5 stroke-[1.75]" />
                              <span>Unduh</span>
                            </a>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteDocument(doc.id, doc.title, e)}
                              className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-[12px] text-danger hover:bg-surface-2 transition text-left cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 stroke-[1.75]" />
                              <span>Hapus</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Baris 2: Judul Dokumen (2 baris line-clamp-2) */}
                    <h3
                      className="text-[13px] font-medium text-text leading-snug line-clamp-2 mb-2"
                      title={doc.title}
                    >
                      {doc.title}
                    </h3>
                  </div>

                  {/* Baris 3: Meta Dokumen (Jumlah Halaman & Tanggal) */}
                  <div className="flex items-center justify-between pt-2 border-t border-border text-[11px] text-text-muted mt-2 select-none">
                    <span className="font-medium">
                      {doc.total_pages || 1} halaman
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 stroke-[1.75]" />
                      <span>{formatDate(doc.created_at)}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SECTION 2: RIWAYAT CHAT (LIST 40PX/BARIS SESUAI SPESIFIKASI) */}
        {chatSessions.length > 0 && (
          <section className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-text tracking-tight">
                Riwayat Sesi Percakapan
              </h2>
              <span className="text-[12px] text-text-muted">
                {chatSessions.length} sesi
              </span>
            </div>

            <div className="space-y-1">
              {chatSessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => {
                    if (handleSelectSession) handleSelectSession(session.id);
                    setCurrentNav("workspace");
                  }}
                  className="h-10 px-3 flex items-center justify-between rounded-sm border border-transparent hover:border-border hover:bg-surface-2 transition cursor-pointer text-[13px] select-none group"
                >
                  <div className="flex items-center gap-2.5 truncate pr-3">
                    <MessageSquare className="w-3.5 h-3.5 text-text-muted group-hover:text-text shrink-0 stroke-[1.75]" />
                    <span className="font-medium text-text truncate">
                      {session.title || "Percakapan Tanpa Judul"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-text-muted shrink-0">
                    <span>{formatDate(session.updated_at || session.created_at)}</span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
