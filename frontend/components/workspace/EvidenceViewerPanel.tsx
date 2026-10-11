import React from "react";
import {
  Globe,
  ExternalLink,
  X,
  ShieldCheck,
  BookmarkCheck,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import { CitationItem, DocumentItem, UserProfile } from "../../types";

interface EvidenceViewerPanelProps {
  theme: "dark" | "light";
  apiBase: string;
  currentUser: UserProfile;
  activeAcademicCitation: CitationItem | null;
  activeDoc: DocumentItem | null;
  targetPage: number;
  setTargetPage: React.Dispatch<React.SetStateAction<number>>;
  highlightQuote: string | null;
  setHighlightQuote: (quote: string | null) => void;
  setActiveAcademicCitation: (c: CitationItem | null) => void;
  setIsPdfPanelOpen: (isOpen: boolean) => void;
}

/**
 * EvidenceViewerPanel - Panel kanan dual-pane: Academic Evidence Viewer (Perplexity style) & PDF Browser Iframe Viewer.
 */
export const EvidenceViewerPanel: React.FC<EvidenceViewerPanelProps> = ({
  theme,
  apiBase,
  currentUser,
  activeAcademicCitation,
  activeDoc,
  targetPage,
  setTargetPage,
  highlightQuote,
  setHighlightQuote,
  setActiveAcademicCitation,
  setIsPdfPanelOpen,
}) => {
  return (
    <div
      className={`flex flex-1 flex-col overflow-hidden h-full ${
        theme === "dark" ? "bg-[#12161A] border-l border-[#2A333B]" : "bg-[#F7F9FA] border-l border-[#DCE3E8]"
      }`}
    >
      {activeAcademicCitation ? (
        /* ACADEMIC EVIDENCE VIEWER (ALA PERPLEXITY & CONSENSUS) */
        <div className="flex-1 flex flex-col h-full overflow-hidden animate-in fade-in duration-150">
          {/* HEADER */}
          <div
            className={`h-12 px-4 flex items-center justify-between text-xs shrink-0 border-b shadow-xs z-10 ${
              theme === "dark" ? "bg-[#1B2127] border-[#2A333B] text-[#E6EDF2]" : "bg-white border-[#DCE3E8] text-[#12202B]"
            }`}
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <div
                className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-[10px] shrink-0 ${
                  theme === "dark" ? "bg-[#34D3BE] text-[#12161A]" : "bg-[#0F766E] text-white"
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className={`font-bold text-xs truncate ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
                  {activeAcademicCitation.journal_name || "Jurnal Akademik"}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0 border ${
                    theme === "dark" ? "bg-[#34D3BE]/15 text-[#34D3BE] border-[#34D3BE]/30" : "bg-[#CCFBF1] text-[#0F766E] border-teal-200"
                  }`}
                >
                  {activeAcademicCitation.publication_year || "2024"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {activeAcademicCitation.url && (
                <a
                  href={activeAcademicCitation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                    theme === "dark"
                      ? "border-[#2A333B] bg-[#12161A] text-[#34D3BE] hover:bg-[#2A333B]"
                      : "border-[#DCE3E8] bg-white text-[#0F766E] hover:bg-[#F7F9FA]"
                  }`}
                  title="Buka naskah resmi di situs jurnal / penerbit"
                >
                  <span>Buka Jurnal</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}

              <button
                onClick={() => {
                  setActiveAcademicCitation(null);
                  setIsPdfPanelOpen(false);
                }}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  theme === "dark" ? "text-[#9AA9B5] hover:text-rose-400 hover:bg-rose-950/40" : "text-[#5B6B78] hover:text-rose-600 hover:bg-rose-50"
                }`}
                title="Tutup panel bukti"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* CONTENT */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                  theme === "dark" ? "bg-teal-950/60 text-[#34D3BE] border-teal-800/80" : "bg-teal-50 text-[#0F766E] border-teal-200"
                }`}
              >
                <ShieldCheck className="w-3 h-3" />
                Peer-Reviewed / Indexed Literature
              </span>
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                  theme === "dark" ? "border-[#2A333B] text-[#9AA9B5]" : "border-[#DCE3E8] text-[#5B6B78]"
                }`}
              >
                DOI: {activeAcademicCitation.doi || "Tersedia Online"}
              </span>
            </div>

            <div>
              <h2
                className={`text-base sm:text-lg font-bold leading-snug tracking-tight font-claude-serif ${
                  theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
                }`}
              >
                {activeAcademicCitation.document_title}
              </h2>
              {activeAcademicCitation.authors && activeAcademicCitation.authors.length > 0 && (
                <p className={`text-xs mt-1.5 font-medium ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                  Penulis: {activeAcademicCitation.authors.join(", ")}
                </p>
              )}
            </div>

            <div
              className={`p-4 rounded-2xl border shadow-2xs ${
                theme === "dark"
                  ? "bg-amber-950/30 border-amber-800/60 text-amber-200"
                  : "bg-amber-50/80 border-amber-200 text-amber-950"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5 font-bold text-xs">
                <BookmarkCheck className={`w-4 h-4 ${theme === "dark" ? "text-amber-400" : "text-amber-700"}`} />
                <span>Temuan Bukti Empiris Kunci yang Dirujuk:</span>
              </div>
              <p className="text-xs sm:text-sm italic leading-relaxed font-medium">
                "{activeAcademicCitation.exact_quote}"
              </p>
            </div>

            {activeAcademicCitation.abstract_snippet && (
              <div
                className={`p-4 rounded-2xl border ${
                  theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
                }`}
              >
                <h3
                  className={`text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${
                    theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Abstrak &amp; Metodologi Penelitian</span>
                </h3>
                <p
                  className={`text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
                    theme === "dark" ? "text-[#E6EDF2]/90" : "text-[#12202B]/90"
                  }`}
                >
                  {activeAcademicCitation.abstract_snippet}
                </p>
              </div>
            )}

            {activeAcademicCitation.pdf_url && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
                    Naskah Lengkap Open-Access (PDF)
                  </span>
                  <a
                    href={activeAcademicCitation.pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className={`text-[11px] font-semibold underline ${theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"}`}
                  >
                    Buka di Tab Terpisah &rarr;
                  </a>
                </div>
                <div className="w-full h-96 rounded-xl border overflow-hidden border-inherit bg-slate-900">
                  <iframe src={activeAcademicCitation.pdf_url} className="w-full h-full border-0" title="Pratinjau PDF Jurnal" />
                </div>
              </div>
            )}
          </div>
        </div>
      ) : activeDoc ? (
        /* LOCAL PDF VIEWER */
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <div
            className={`h-12 px-3 sm:px-4 flex items-center justify-between text-xs shrink-0 shadow-xs z-10 border-b ${
              theme === "dark" ? "bg-[#1B2127] border-[#2A333B] text-[#E6EDF2]" : "bg-white border-[#DCE3E8] text-[#12202B]"
            }`}
          >
            <div className="flex items-center gap-2 overflow-hidden max-w-xs md:max-w-sm">
              <div className="w-6 h-6 rounded bg-[#E8684A] flex items-center justify-center text-white font-black text-[9px] shrink-0 shadow-xs">
                PDF
              </div>
              <span className={`font-bold truncate text-xs ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`} title={activeDoc.title}>
                {activeDoc.title}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border ${
                  theme === "dark" ? "bg-[#12161A] border-[#2A333B] text-[#E6EDF2]" : "bg-[#F7F9FA] border-[#DCE3E8] text-[#12202B]"
                }`}
              >
                <button
                  onClick={() => setTargetPage((p) => Math.max(1, p - 1))}
                  disabled={targetPage <= 1}
                  className={`p-0.5 rounded disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer ${
                    theme === "dark" ? "hover:bg-[#2A333B]" : "hover:bg-white"
                  }`}
                  title="Halaman sebelumnya"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span>Hlm:</span>
                <input
                  type="number"
                  min={1}
                  max={activeDoc.total_pages}
                  value={targetPage}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val >= 1 && val <= activeDoc.total_pages) {
                      setTargetPage(val);
                    }
                  }}
                  className={`w-10 text-center rounded py-0.5 font-bold outline-none border ${
                    theme === "dark" ? "bg-[#1B2127] border-[#2A333B] text-[#E6EDF2]" : "bg-white border-[#DCE3E8] text-[#12202B]"
                  }`}
                />
                <span className={`font-medium ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>/ {activeDoc.total_pages}</span>
                <button
                  onClick={() => setTargetPage((p) => Math.min(activeDoc.total_pages, p + 1))}
                  disabled={targetPage >= activeDoc.total_pages}
                  className={`p-0.5 rounded disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer ${
                    theme === "dark" ? "hover:bg-[#2A333B]" : "hover:bg-white"
                  }`}
                  title="Halaman berikutnya"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <a
                href={`${apiBase}/api/v1/documents/${activeDoc.id}/pdf?download=1&token=${currentUser.token}`}
                download={activeDoc.filename}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  theme === "dark" ? "text-[#9AA9B5] hover:text-[#E6EDF2] hover:bg-[#2A333B]" : "text-[#5B6B78] hover:text-[#12202B] hover:bg-[#F7F9FA]"
                }`}
                title="Unduh file PDF"
              >
                <Download className="w-3.5 h-3.5" />
              </a>

              <a
                href={`${apiBase}/api/v1/documents/${activeDoc.id}/pdf?token=${currentUser.token}`}
                target="_blank"
                rel="noreferrer"
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  theme === "dark" ? "text-[#9AA9B5] hover:text-[#E6EDF2] hover:bg-[#2A333B]" : "text-[#5B6B78] hover:text-[#12202B] hover:bg-[#F7F9FA]"
                }`}
                title="Buka di tab browser baru"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                onClick={() => setIsPdfPanelOpen(false)}
                className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg border transition cursor-pointer ${
                  theme === "dark"
                    ? "text-[#9AA9B5] hover:text-rose-400 hover:bg-rose-950/40 border-[#2A333B]"
                    : "text-[#5B6B78] hover:text-rose-600 hover:bg-rose-50 border-[#DCE3E8]"
                }`}
                title="Tutup panel dokumen"
              >
                <X className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tutup</span>
              </button>
            </div>
          </div>

          {highlightQuote && (
            <div
              className={`px-4 py-2 text-xs flex items-center justify-between shadow-xs shrink-0 border-b ${
                theme === "dark"
                  ? "bg-amber-950/70 border-amber-800/80 text-amber-200"
                  : "bg-amber-100 border-amber-300 text-amber-950"
              }`}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <BookmarkCheck className={`w-4 h-4 shrink-0 font-bold ${theme === "dark" ? "text-amber-400" : "text-amber-700"}`} />
                <span className={`font-bold shrink-0 ${theme === "dark" ? "text-amber-300" : "text-amber-900"}`}>
                  Bukti Halaman {targetPage}:
                </span>
                <span className="italic truncate font-medium">"{highlightQuote}"</span>
              </div>
              <button
                onClick={() => setHighlightQuote(null)}
                className={`text-[11px] underline font-bold shrink-0 ml-3 cursor-pointer ${
                  theme === "dark" ? "text-amber-300 hover:text-amber-100" : "text-amber-800 hover:text-amber-950"
                }`}
              >
                Tutup
              </button>
            </div>
          )}

          <div className="flex-1 w-full h-full bg-[#12161A] overflow-hidden relative">
            <iframe
              key={`${activeDoc.id}-p${targetPage}`}
              src={`${apiBase}/api/v1/documents/${activeDoc.id}/pdf?token=${currentUser.token}#page=${targetPage}&view=FitH`}
              className="w-full h-full border-0 bg-white"
              title={activeDoc.title}
            />
          </div>
        </div>
      ) : (
        <div className={`flex-1 flex flex-col items-center justify-center p-8 text-center ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
          <BookOpen className="w-16 h-16 text-[#9AA9B5] mb-4 stroke-1 opacity-50" />
          <h3 className={`font-bold text-base font-claude-serif ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
            Belum Ada Dokumen Terpilih
          </h3>
          <p className={`text-xs max-w-sm mt-1 ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
            Klik sitasi pada jawaban asisten atau pilih dokumen di atas untuk langsung melihat lembaran aslinya di sini.
          </p>
          <button
            onClick={() => setIsPdfPanelOpen(false)}
            className={`mt-4 text-xs underline cursor-pointer ${theme === "dark" ? "text-[#9AA9B5] hover:text-[#E6EDF2]" : "text-[#5B6B78] hover:text-[#12202B]"}`}
          >
            Tutup panel ini
          </button>
        </div>
      )}
    </div>
  );
};
