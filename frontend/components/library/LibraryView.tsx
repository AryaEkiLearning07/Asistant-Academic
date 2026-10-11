"use client";

import React from "react";
import {
  ArrowLeft,
  Sun,
  Moon,
  MessageSquare,
  PlusCircle,
  CheckCircle2,
  BookOpen,
  UploadCloud,
  Search,
  X,
  MoreVertical,
  Download,
  Trash2,
} from "lucide-react";
import { DocumentItem, UserProfile } from "@/types";
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
}: LibraryViewProps) {
  const filteredDocs = documents.filter((d) =>
    d.title.toLowerCase().includes(librarySearch.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto w-full h-full px-6 sm:px-10 lg:px-16 py-8">
      {/* HEADER SECTION */}
      <div
        className={`flex items-center justify-between mb-6 pb-4 border-b ${
          theme === "dark" ? "border-[#2A333B]" : "border-[#DCE3E8]"
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentNav("dashboard")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition shadow-xs cursor-pointer ${
              theme === "dark"
                ? "border-[#2A333B] bg-[#1B2127] hover:bg-[#2A333B] text-[#E6EDF2]"
                : "border-[#DCE3E8] bg-white hover:bg-[#F7F9FA] text-[#12202B]"
            }`}
            title="Kembali ke Beranda Dashboard"
          >
            <ArrowLeft className={`w-4 h-4 ${theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"}`} />
            <span>Kembali ke Beranda</span>
          </button>
          <div>
            <h2
              className={`text-xl font-bold font-claude-serif ${
                theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
              }`}
            >
              Perpustakaan Saya (MyLibrary)
            </h2>
            <p className={`text-xs mt-0.5 ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
              Materi e-book, diktat, dan slide yang terisolasi khusus untuk akun Anda.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Theme Switcher Button */}
          <button
            onClick={toggleTheme}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition cursor-pointer ${
              theme === "dark"
                ? "border-[#2A333B] bg-[#1B2127] text-amber-300 hover:bg-[#2A333B]"
                : "border-[#DCE3E8] bg-white text-[#12202B] hover:bg-[#F7F9FA]"
            }`}
            title={theme === "dark" ? "Ganti ke Mode Terang (Light)" : "Ganti ke Mode Gelap (Dark)"}
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
            onClick={() => {
              setCurrentNav("workspace");
              setIsPdfPanelOpen(false);
            }}
            className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition cursor-pointer ${
              theme === "dark"
                ? "bg-[#2A333B] hover:bg-[#2A333B]/80 text-[#E6EDF2] border border-[#2A333B]"
                : "bg-[#12202B] hover:bg-[#12202B]/90 text-white"
            }`}
          >
            <MessageSquare className={`w-3.5 h-3.5 ${theme === "dark" ? "text-[#34D3BE]" : "text-teal-400"}`} />
            <span>Masuk Workspace AI</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={`flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer ${
              theme === "dark"
                ? "bg-[#34D3BE] text-[#12161A] hover:bg-[#34D3BE]/90"
                : "bg-[#0F766E] text-white hover:bg-[#0F766E]/90"
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>{isUploading ? "Mengindeks..." : "Unggah Buku / Modul"}</span>
          </button>
        </div>
      </div>

      {uploadNotice && (
        <div
          className={`mb-6 p-4 rounded-xl text-xs flex items-center gap-3 shadow-sm border ${
            theme === "dark"
              ? "bg-[#34D3BE]/10 border-[#34D3BE]/30 text-[#34D3BE]"
              : "bg-teal-50 border-teal-200 text-[#0F766E]"
          }`}
        >
          <CheckCircle2 className={`w-5 h-5 shrink-0 ${theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"}`} />
          <span className="font-medium">{uploadNotice}</span>
        </div>
      )}

      {/* JIKA MYLIBRARY KOSONG */}
      {documents.length === 0 ? (
        <div
          className={`border-2 border-dashed rounded-2xl p-12 text-center shadow-sm flex flex-col items-center justify-center my-8 ${
            theme === "dark"
              ? "bg-[#1B2127] border-[#2A333B] text-[#E6EDF2]"
              : "bg-white border-[#DCE3E8] text-[#12202B]"
          }`}
        >
          <div
            className={`w-16 h-16 rounded-2xl border flex items-center justify-center mb-4 ${
              theme === "dark"
                ? "bg-[#34D3BE]/10 border-[#34D3BE]/30 text-[#34D3BE]"
                : "bg-teal-50 border-teal-200 text-[#0F766E]"
            }`}
          >
            <BookOpen className="w-8 h-8" />
          </div>
          <h3
            className={`font-bold text-base font-claude-serif ${
              theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
            }`}
          >
            MyLibrary Anda Masih Kosong
          </h3>
          <p
            className={`text-xs max-w-md mt-1 mb-6 ${
              theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
            }`}
          >
            Anda belum mengunggah e-book atau modul farmasi apa pun. Unggah dokumen PDF pertama Anda untuk mulai belajar dan bertanya ke asisten.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={`flex items-center gap-2 text-xs font-bold px-5 py-3 rounded-xl shadow-md transition cursor-pointer ${
              theme === "dark"
                ? "bg-[#34D3BE] text-[#12161A] hover:bg-[#34D3BE]/90"
                : "bg-[#0F766E] text-white hover:bg-[#0F766E]/90"
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Unggah PDF Pertama Sekarang</span>
          </button>
        </div>
      ) : (
        <div>
          {/* SEARCH FILTER DOKUMEN MYLIBRARY */}
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search
                className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${
                  theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                }`}
              />
              <input
                type="text"
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                placeholder="Cari buku atau modul farmasi..."
                className={`w-full border rounded-xl pl-9 pr-8 py-2 text-xs font-medium focus:outline-none transition shadow-xs ${
                  theme === "dark"
                    ? "bg-[#1B2127] border-[#2A333B] text-[#E6EDF2] placeholder-[#9AA9B5]/60 focus:border-[#34D3BE]"
                    : "bg-white border-[#DCE3E8] text-[#12202B] placeholder-[#5B6B78]/60 focus:border-[#0F766E]"
                }`}
              />
              {librarySearch && (
                <button
                  onClick={() => setLibrarySearch("")}
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer ${
                    theme === "dark" ? "text-[#9AA9B5] hover:text-[#E6EDF2]" : "text-[#5B6B78] hover:text-[#12202B]"
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div
              className={`text-xs font-medium hidden sm:block ${
                theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
              }`}
            >
              Menampilkan {filteredDocs.length} dari {documents.length} dokumen
            </div>
          </div>

          {filteredDocs.length === 0 ? (
            <div
              className={`p-8 text-center rounded-2xl border text-xs my-4 ${
                theme === "dark" ? "bg-[#1B2127] border-[#2A333B] text-[#9AA9B5]" : "bg-white border-[#DCE3E8] text-[#5B6B78]"
              }`}
            >
              Tidak ditemukan dokumen dengan judul "{librarySearch}".
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
              {filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => openDocumentPreview(doc)}
                  className={`group border rounded-xl p-2.5 transition flex flex-col justify-between shadow-2xs hover:shadow-md cursor-pointer relative ${
                    theme === "dark"
                      ? "bg-[#1B2127] hover:bg-[#2A333B]/60 border-[#2A333B] hover:border-[#34D3BE]"
                      : "bg-white hover:bg-[#F7F9FA] border-[#DCE3E8] hover:border-[#0F766E]"
                  }`}
                >
                  <div>
                    {/* HEADER KARTU */}
                    <div className="flex items-center justify-between gap-1.5 mb-2 px-0.5">
                      <div className="flex items-center gap-2 overflow-hidden flex-1">
                        <FileFormatIcon filename={doc.filename || doc.title} size="sm" />
                        <h4
                          className={`font-semibold text-xs transition truncate ${
                            theme === "dark"
                              ? "text-[#E6EDF2] group-hover:text-[#34D3BE]"
                              : "text-[#12202B] group-hover:text-[#0F766E]"
                          }`}
                          title={doc.title}
                        >
                          {doc.title}
                        </h4>
                      </div>

                      {/* MENU TITIK 3 */}
                      <div className="relative shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuDocId(activeMenuDocId === doc.id ? null : doc.id);
                          }}
                          className={`p-1 rounded-md transition cursor-pointer ${
                            theme === "dark"
                              ? "text-[#9AA9B5] hover:text-[#E6EDF2] hover:bg-[#2A333B]"
                              : "text-[#5B6B78] hover:text-[#12202B] hover:bg-[#F7F9FA]"
                          }`}
                          title="Menu opsi dokumen"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        {activeMenuDocId === doc.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className={`absolute right-0 top-full mt-1 w-44 rounded-xl shadow-xl z-30 py-1 text-xs border ${
                              theme === "dark"
                                ? "bg-[#1B2127] border-[#2A333B] text-[#E6EDF2]"
                                : "bg-white border-[#DCE3E8] text-[#12202B]"
                            }`}
                          >
                            <a
                              href={`${apiBase}/api/v1/documents/${doc.id}/pdf?download=1&token=${currentUser.token}`}
                              download={doc.filename}
                              onClick={() => setActiveMenuDocId(null)}
                              className={`flex items-center gap-2.5 px-3 py-2 transition font-medium ${
                                theme === "dark"
                                  ? "text-[#E6EDF2] hover:bg-[#2A333B] hover:text-[#34D3BE]"
                                  : "text-[#12202B] hover:bg-[#F7F9FA] hover:text-[#0F766E]"
                              }`}
                            >
                              <Download className="w-3.5 h-3.5 text-[#9AA9B5]" />
                              <span>Unduh Dokumen</span>
                            </a>
                            <button
                              onClick={(e) => {
                                setActiveMenuDocId(null);
                                handleDeleteDocument(doc.id, doc.title, e);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-500 hover:bg-rose-500/10 transition font-medium text-left cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              <span>Hapus Referensi</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* BADAN KARTU */}
                    <div
                      className={`rounded-lg border overflow-hidden shadow-inner aspect-[4/3] max-h-36 sm:max-h-40 flex flex-col items-center justify-center relative p-1 transition ${
                        theme === "dark"
                          ? "bg-[#12161A] border-[#2A333B] group-hover:border-[#34D3BE]"
                          : "bg-white border-[#DCE3E8] group-hover:border-[#0F766E]"
                      }`}
                    >
                      {doc.thumbnail_url ? (
                        <img
                          src={`${apiBase}${doc.thumbnail_url}`}
                          alt={`Sampul ${doc.title}`}
                          className={`w-full h-full object-contain object-top rounded-md ${
                            theme === "dark" ? "bg-[#12161A]" : "bg-white"
                          }`}
                          loading="lazy"
                        />
                      ) : (
                        <div
                          className={`w-full h-full p-2.5 text-[9.5px] overflow-hidden flex flex-col justify-between leading-snug ${
                            theme === "dark" ? "bg-[#12161A] text-[#9AA9B5]" : "bg-white text-[#5B6B78]"
                          }`}
                        >
                          <div
                            className={`border-b pb-1 font-bold truncate ${
                              theme === "dark" ? "border-[#2A333B] text-[#E6EDF2]" : "border-[#DCE3E8] text-[#12202B]"
                            }`}
                          >
                            {doc.title}
                          </div>
                          <p
                            className={`line-clamp-4 italic text-[9px] ${
                              theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                            }`}
                          >
                            "{doc.preview_snippet || "Pratinjau konten dokumen akademik farmasi."}"
                          </p>
                          <div
                            className={`text-[8.5px] font-semibold text-right ${
                              theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"
                            }`}
                          >
                            {doc.total_pages} Hlm
                          </div>
                        </div>
                      )}

                      {/* OVERLAY TOMBOL PREVIEW SAAT HOVER */}
                      <div className="absolute inset-0 bg-[#12161A]/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px] rounded-lg">
                        <span
                          className={`font-bold text-[11px] px-2.5 py-1 rounded-md shadow-lg flex items-center gap-1.5 transform translate-y-1 group-hover:translate-y-0 transition-transform ${
                            theme === "dark" ? "bg-[#34D3BE] text-[#12161A]" : "bg-white text-[#0F766E]"
                          }`}
                        >
                          <BookOpen className="w-3 h-3" />
                          <span>Buka</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* FOOTER KARTU */}
                  <div
                    className={`mt-2 pt-1.5 border-t flex items-center justify-between text-[10px] px-0.5 ${
                      theme === "dark" ? "border-[#2A333B] text-[#9AA9B5]" : "border-[#DCE3E8] text-[#5B6B78]"
                    }`}
                  >
                    <span className="font-semibold">{doc.total_pages} Halaman</span>
                    <span>{(doc.file_size_bytes / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
