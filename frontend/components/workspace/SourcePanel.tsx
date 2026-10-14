import React, { useState, useEffect } from "react";
import {
  X,
  ExternalLink,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  BookOpen,
  Globe,
  Layers,
  Download,
} from "lucide-react";
import { SourceItem, DocumentItem, UserProfile } from "@/types";
import { EvidenceBadge } from "../chat/EvidenceBadge";

interface SourcePanelProps {
  isOpen: boolean;
  onClose: () => void;
  sources: SourceItem[];
  activeSource: SourceItem | null;
  onSelectSource: (source: SourceItem) => void;
  apiBase: string;
  currentUser?: UserProfile | null;
  activeDoc?: DocumentItem | null;
  targetPage?: number;
  setTargetPage?: (page: number) => void;
}

export const SourcePanel: React.FC<SourcePanelProps> = ({
  isOpen,
  onClose,
  sources,
  activeSource,
  onSelectSource,
  apiBase,
  currentUser,
  activeDoc,
  targetPage = 1,
  setTargetPage,
}) => {
  const [activeTab, setActiveTab] = useState<"detail" | "list">("detail");
  const [doiCopied, setDoiCopied] = useState(false);

  // Esc key listener to close panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // If a source is selected, switch to detail tab
  useEffect(() => {
    if (activeSource) {
      setActiveTab("detail");
    }
  }, [activeSource]);

  if (!isOpen) return null;

  const currentItem = activeSource || sources[0] || null;

  const handleCopyDoi = async (doiStr?: string) => {
    if (!doiStr) return;
    try {
      await navigator.clipboard.writeText(doiStr);
      setDoiCopied(true);
      setTimeout(() => setDoiCopied(false), 2000);
    } catch (err) {
      console.error("Gagal menyalin DOI:", err);
    }
  };

  const getSourceIcon = (type: string) => {
    switch (type) {
      case "pdf":
        return <FileText className="w-4 h-4 text-ev-jurnal shrink-0 stroke-[1.75]" />;
      case "journal":
        return <BookOpen className="w-4 h-4 text-ev-jurnal shrink-0 stroke-[1.75]" />;
      case "label":
        return <BookOpen className="w-4 h-4 text-ev-label shrink-0 stroke-[1.75]" />;
      case "web":
      default:
        return <Globe className="w-4 h-4 text-ev-web shrink-0 stroke-[1.75]" />;
    }
  };

  const extractDomain = (urlStr?: string): string => {
    if (!urlStr) return "Web";
    try {
      return new URL(urlStr).hostname.replace(/^www\./, "");
    } catch {
      return "Web";
    }
  };

  const highlightSnippet = (fullText: string, searchTerms: string[]) => {
    if (!fullText || !searchTerms || searchTerms.length === 0) return fullText;
    const term = searchTerms[0];
    if (!term || !fullText.toLowerCase().includes(term.toLowerCase())) {
      return fullText;
    }
    const idx = fullText.toLowerCase().indexOf(term.toLowerCase());
    const before = fullText.substring(0, idx);
    const match = fullText.substring(idx, idx + term.length);
    const after = fullText.substring(idx + term.length);

    return (
      <>
        {before}
        <mark className="bg-yellow-400/30 text-inherit font-medium px-0.5 rounded">
          {match}
        </mark>
        {after}
      </>
    );
  };

  return (
    <>
      {/* Mobile / Tablet Drawer Backdrop (<1280px) */}
      <div
        onClick={onClose}
        className="xl:hidden fixed inset-0 bg-black/40 z-40 animate-in fade-in duration-150 backdrop-blur-[1px]"
        aria-hidden="true"
      />

      {/* Main Source Panel (400px width) */}
      <aside
        className="fixed xl:static top-0 right-0 bottom-0 w-full sm:w-[400px] h-full flex flex-col bg-surface border-l border-border z-50 xl:z-20 shadow-overlay xl:shadow-none animate-in slide-in-from-right-4 duration-150"
        aria-label="Panel Sumber Referensi"
      >
        {/* Header: [EvidenceBadge + Judul Ringkas] + [Tutup] */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-border shrink-0 select-none">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            {currentItem && <EvidenceBadge type={currentItem.type} />}
            <span className="text-[13px] font-semibold text-text truncate">
              {currentItem ? currentItem.title : "Sumber Referensi"}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-sm text-text-muted hover:text-text hover:bg-surface-2 transition cursor-pointer shrink-0"
            title="Tutup panel (Esc)"
            aria-label="Tutup panel sumber"
          >
            <X className="w-4 h-4 stroke-[1.75]" />
          </button>
        </div>

        {/* Tab Navigation: Daftar Sumber / Detail Sumber */}
        <div className="flex border-b border-border bg-surface-2 px-3 pt-2 gap-1 select-none shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("detail")}
            className={`px-3 py-1.5 text-[12px] font-medium rounded-t-sm transition cursor-pointer border-b-2 -mb-px ${
              activeTab === "detail"
                ? "border-accent text-text bg-surface font-semibold"
                : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            Detail Sumber
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("list")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-t-sm transition cursor-pointer border-b-2 -mb-px ${
              activeTab === "list"
                ? "border-accent text-text bg-surface font-semibold"
                : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            <Layers className="w-3.5 h-3.5 stroke-[1.75]" />
            <span>Daftar Sumber ({sources.length})</span>
          </button>
        </div>

        {/* Panel Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === "list" ? (
            /* TAB DAFTAR SUMBER */
            <div className="space-y-2">
              {sources.map((s, idx) => {
                const isSelected = currentItem?.id === s.id;
                return (
                  <button
                    key={s.id || idx}
                    type="button"
                    onClick={() => {
                      onSelectSource(s);
                      setActiveTab("detail");
                    }}
                    className={`w-full text-left p-3 rounded-md border transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                      isSelected
                        ? "border-accent bg-accent-soft/20 text-text"
                        : "border-border bg-surface hover:bg-surface-2 text-text"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-[11px] font-bold text-text-muted mt-0.5">
                        [{idx + 1}]
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          {getSourceIcon(s.type)}
                          <span className="text-[11px] text-text-muted uppercase font-semibold">
                            {s.meta}
                          </span>
                        </div>
                        <h4 className="text-[13px] font-medium leading-snug line-clamp-2">
                          {s.title}
                        </h4>
                      </div>
                    </div>
                    {s.snippet && (
                      <p className="text-[11px] text-text-muted line-clamp-2 italic pl-5">
                        "{s.snippet}"
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          ) : currentItem ? (
            /* TAB DETAIL SUMBER */
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* DETAIL PER TIPE */}
              {currentItem.type === "pdf" ? (
                /* 1. PDF DETAIL */
                <div className="space-y-4">
                  <div>
                    <h3 className="text-[15px] font-semibold text-text leading-snug">
                      {currentItem.title}
                    </h3>
                    <p className="text-[12px] text-text-muted mt-1">
                      {currentItem.meta}
                    </p>
                  </div>

                  {/* Navigasi Halaman PDF */}
                  <div className="flex items-center justify-between p-2 rounded-md bg-surface-2 border border-border text-[12px]">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setTargetPage && setTargetPage(Math.max(1, targetPage - 1))}
                        disabled={targetPage <= 1}
                        className="p-1 rounded-sm hover:bg-surface text-text disabled:opacity-30 cursor-pointer"
                        title="Halaman sebelumnya"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="font-medium text-text">
                        hal. {currentItem.page || targetPage} dari {currentItem.total_pages || activeDoc?.total_pages || 80}
                      </span>
                      <button
                        type="button"
                        onClick={() => setTargetPage && setTargetPage(targetPage + 1)}
                        className="p-1 rounded-sm hover:bg-surface text-text cursor-pointer"
                        title="Halaman berikutnya"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {activeDoc && currentUser && (
                      <a
                        href={`${apiBase}/api/v1/documents/${activeDoc.id}/pdf?download=1&token=${currentUser.token}`}
                        download={activeDoc.filename}
                        className="flex items-center gap-1 text-[11px] font-medium text-text-muted hover:text-text cursor-pointer"
                        title="Unduh file PDF"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Unduh</span>
                      </a>
                    )}
                  </div>

                  {/* Highlight Teks Terkutip (kuning 30% opacity) */}
                  {currentItem.snippet && (
                    <div className="p-3.5 rounded-md border border-border bg-yellow-400/10 text-text">
                      <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">
                        Kutipan pada Dokumen:
                      </div>
                      <p className="text-[13px] leading-relaxed italic bg-yellow-400/30 p-2 rounded-sm border border-yellow-500/20">
                        "{currentItem.snippet}"
                      </p>
                    </div>
                  )}

                  {/* Iframe View jika dokumen aktif */}
                  {activeDoc && currentUser && (
                    <div className="w-full h-80 rounded-md border border-border overflow-hidden bg-slate-100 dark:bg-slate-900">
                      <iframe
                        src={`${apiBase}/api/v1/documents/${activeDoc.id}/pdf?token=${currentUser.token}#page=${currentItem.page || targetPage}&view=FitH`}
                        className="w-full h-full border-0"
                        title={currentItem.title}
                      />
                    </div>
                  )}
                </div>
              ) : currentItem.type === "journal" || currentItem.type === "label" ? (
                /* 2. JURNAL DETAIL */
                <div className="space-y-4">
                  <div>
                    <h3 className="text-[15px] font-semibold text-text leading-snug">
                      {currentItem.title}
                    </h3>
                    {currentItem.authors && currentItem.authors.length > 0 && (
                      <p className="text-[12px] text-text-muted mt-1.5 font-normal">
                        Penulis: {currentItem.authors.join(", ")}
                      </p>
                    )}
                    <p className="text-[12px] text-text-muted mt-0.5">
                      {currentItem.journal || currentItem.meta}
                      {currentItem.year ? ` · ${currentItem.year}` : ""}
                    </p>
                  </div>

                  {/* DOI Row: link + tombol salin */}
                  {currentItem.doi && (
                    <div className="flex items-center justify-between p-2.5 rounded-md bg-surface-2 border border-border text-[12px]">
                      <div className="flex items-center gap-1.5 truncate pr-2">
                        <span className="font-semibold text-text">DOI:</span>
                        <a
                          href={`https://doi.org/${currentItem.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:underline truncate"
                          title="Buka DOI di tab baru"
                        >
                          {currentItem.doi}
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyDoi(currentItem.doi)}
                        className="flex items-center gap-1 px-2 py-1 rounded-sm bg-surface hover:bg-surface-2 text-text border border-border text-[11px] font-medium transition cursor-pointer shrink-0"
                        title="Salin DOI"
                      >
                        {doiCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-accent stroke-[2]" />
                            <span>Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 stroke-[1.75]" />
                            <span>Salin</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Abstrak dengan kalimat terkutip di-highlight */}
                  <div className="p-3.5 rounded-md border border-border bg-surface-2">
                    <h4 className="text-[12px] font-semibold text-text uppercase tracking-wider mb-2">
                      Abstrak &amp; Temuan Kunci
                    </h4>
                    <p className="text-[13px] leading-relaxed text-text">
                      {highlightSnippet(
                        currentItem.snippet || "Tidak ada ringkasan abstrak tambahan.",
                        currentItem.highlights || (currentItem.snippet ? [currentItem.snippet] : [])
                      )}
                    </p>
                  </div>

                  {/* Tombol Akses URL */}
                  {currentItem.url && (
                    <a
                      href={currentItem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-md bg-accent text-white hover:bg-accent/90 text-[13px] font-medium transition cursor-pointer"
                    >
                      <span>Buka Naskah Jurnal</span>
                      <ExternalLink className="w-3.5 h-3.5 stroke-[1.75]" />
                    </a>
                  )}
                </div>
              ) : (
                /* 3. WEB DETAIL */
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-1.5 text-[12px] text-text-muted mb-1">
                      <Globe className="w-3.5 h-3.5 stroke-[1.75]" />
                      <span className="font-semibold text-text">
                        {extractDomain(currentItem.url)}
                      </span>
                    </div>
                    <h3 className="text-[15px] font-semibold text-text leading-snug">
                      {currentItem.title}
                    </h3>
                  </div>

                  {/* Cuplikan 3-5 baris */}
                  {currentItem.snippet && (
                    <div className="p-3.5 rounded-md border border-border bg-surface-2">
                      <h4 className="text-[12px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                        Cuplikan Konten:
                      </h4>
                      <p className="text-[13px] leading-relaxed text-text line-clamp-5">
                        {currentItem.snippet}
                      </p>
                    </div>
                  )}

                  {/* Tombol Buka */}
                  {currentItem.url && (
                    <a
                      href={currentItem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-md bg-accent text-white hover:bg-accent/90 text-[13px] font-medium transition cursor-pointer"
                    >
                      <span>Buka di Web</span>
                      <ExternalLink className="w-3.5 h-3.5 stroke-[1.75]" />
                    </a>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center text-text-muted text-[13px]">
              Belum ada sumber referensi terpilih.
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
