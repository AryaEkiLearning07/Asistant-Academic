"use client";

import React from "react";
import { X, BookOpen, Download, ExternalLink } from "lucide-react";
import { DocumentItem, UserProfile } from "@/types";

interface DocumentPreviewModalProps {
  previewDoc: DocumentItem | null;
  setPreviewDoc: (doc: DocumentItem | null) => void;
  currentUser: UserProfile;
  setActiveDoc: (doc: DocumentItem | null) => void;
  setTargetPage: (page: number) => void;
  setHighlightQuote: (quote: string | null) => void;
  setIsPdfPanelOpen: (open: boolean) => void;
  setCurrentNav: (nav: "dashboard" | "workspace" | "library" | "admin") => void;
  apiBase: string;
}

export function DocumentPreviewModal({
  previewDoc,
  setPreviewDoc,
  currentUser,
  setActiveDoc,
  setTargetPage,
  setHighlightQuote,
  setIsPdfPanelOpen,
  setCurrentNav,
  apiBase,
}: DocumentPreviewModalProps) {
  if (!previewDoc) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#121212] flex flex-col select-none animate-in fade-in duration-150"
      tabIndex={-1}
    >
      {/* TOP HEADER RINGKAS & BERSIH */}
      <div className="h-14 bg-[#1f1f1f] border-b border-[#3c4043] px-3 sm:px-4 flex items-center justify-between text-white shrink-0 z-20">
        <div className="flex items-center gap-3 overflow-hidden max-w-xl">
          <button
            onClick={() => setPreviewDoc(null)}
            className="p-1.5 sm:p-2 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition"
            title="Tutup pratinjau"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-7 h-7 rounded bg-[#ea4335] flex items-center justify-center text-white font-bold text-[10px] tracking-tight shrink-0 shadow-sm">
            PDF
          </div>

          <div className="flex flex-col overflow-hidden">
            <h3 className="font-medium text-xs sm:text-sm text-white truncate" title={previewDoc.title}>
              {previewDoc.title.endsWith(".pdf") ? previewDoc.title : `${previewDoc.title}.pdf`}
            </h3>
            <span className="text-[10px] text-slate-400">
              {previewDoc.total_pages} Halaman • {(previewDoc.file_size_bytes / 1024 / 1024).toFixed(2)} MB
            </span>
          </div>
        </div>

        {/* KANAN: TOMBOL BUKA DI WORKSPACE & UNDUH */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <button
            onClick={() => {
              setActiveDoc(previewDoc);
              setTargetPage(1);
              setHighlightQuote(null);
              setIsPdfPanelOpen(true);
              setCurrentNav("workspace");
              setPreviewDoc(null);
            }}
            className="flex items-center gap-1.5 text-xs font-semibold bg-[#1a73e8] hover:bg-[#1557b0] text-white px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full shadow transition"
            title="Buka dokumen ini di Workspace untuk tanya jawab asisten AI"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Buka di Workspace & Tanya AI</span>
          </button>

          <a
            href={`${apiBase}/api/v1/documents/${previewDoc.id}/pdf?download=1&token=${currentUser?.token}`}
            download={previewDoc.filename}
            className="p-2 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition"
            title="Unduh PDF"
          >
            <Download className="w-4 h-4" />
          </a>

          <a
            href={`${apiBase}/api/v1/documents/${previewDoc.id}/pdf?token=${currentUser?.token}`}
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition"
            title="Buka di tab browser baru"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* AREA PDF VIEWER DEFAULT BROWSER */}
      <div className="flex-1 w-full h-full bg-[#525659] overflow-hidden">
        <iframe
          key={previewDoc.id}
          src={`${apiBase}/api/v1/documents/${previewDoc.id}/pdf?token=${currentUser?.token}`}
          className="w-full h-full border-0"
          title={`Pratinjau ${previewDoc.title}`}
        />
      </div>
    </div>
  );
}
