import React from "react";
import {
  Globe,
  FileText,
  ChevronDown,
  ChevronRight,
  BookOpen,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { CitationItem } from "../../types";

interface SourcesAccordionPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  sourcesRef: React.RefObject<HTMLDivElement | null>;
  theme: "dark" | "light";
  sessionCitations: CitationItem[];
  sourcesAccordionOpen: "web" | "files" | null;
  setSourcesAccordionOpen: (val: "web" | "files" | null) => void;
  totalWebCount: number;
  totalFileCount: number;
  webCitationsGrouped: { question: string; items: CitationItem[] }[];
  fileCitationsGrouped: { docTitle: string; page: number; items: { quote: string; question: string; rawCit: CitationItem }[] }[];
  uniqueDocsCount: number;
  handleCitationClick: (citation: CitationItem) => void;
}

/**
 * SourcesAccordionPopover - Menu popover rujukan bukti ilmiah Perplexity-style (Web & Files).
 */
export const SourcesAccordionPopover: React.FC<SourcesAccordionPopoverProps> = ({
  isOpen,
  onClose,
  sourcesRef,
  theme,
  sessionCitations,
  sourcesAccordionOpen,
  setSourcesAccordionOpen,
  totalWebCount,
  totalFileCount,
  webCitationsGrouped,
  fileCitationsGrouped,
  uniqueDocsCount,
  handleCitationClick,
}) => {
  if (!isOpen) return null;

  return (
    <div
      ref={sourcesRef as any}
      className={`absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl shadow-2xl z-40 p-3 border animate-in fade-in zoom-in-95 duration-150 ${
        theme === "dark"
          ? "bg-[#1B2127] border-[#2A333B] text-[#E6EDF2]"
          : "bg-white border-[#DCE3E8] text-[#12202B]"
      }`}
    >
      {/* HEADER POPOVER */}
      <div
        className={`flex items-center justify-between pb-2.5 mb-2.5 border-b ${
          theme === "dark" ? "border-[#2A333B]" : "border-[#DCE3E8]"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold font-claude-serif">Sources</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
              theme === "dark" ? "bg-[#34D3BE]/15 text-[#34D3BE]" : "bg-[#0F766E]/10 text-[#0F766E]"
            }`}
          >
            {sessionCitations.length} total
          </span>
        </div>
        <button
          onClick={onClose}
          className={`p-1 rounded-lg transition cursor-pointer ${
            theme === "dark" ? "text-[#9AA9B5] hover:text-[#E6EDF2]" : "text-[#5B6B78] hover:text-[#12202B]"
          }`}
          title="Tutup menu sources"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* LIST ACCORDION */}
      <div className="space-y-2">
        {/* 1. SECTION ACCORDION WEB */}
        <div
          className={`rounded-xl border transition-all ${
            theme === "dark" ? "border-[#2A333B] bg-[#12161A]/60" : "border-[#DCE3E8] bg-[#F7F9FA]"
          }`}
        >
          <button
            type="button"
            onClick={() => setSourcesAccordionOpen(sourcesAccordionOpen === "web" ? null : "web")}
            className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold transition cursor-pointer ${
              theme === "dark" ? "hover:text-[#34D3BE]" : "hover:text-[#0F766E]"
            }`}
          >
            <div className="flex items-center gap-2">
              <Globe className={`w-4 h-4 ${theme === "dark" ? "text-cyan-400" : "text-cyan-600"}`} />
              <span>Web (Jurnal Akademik)</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${
                  theme === "dark" ? "bg-[#2A333B] text-[#9AA9B5]" : "bg-[#E6EDF2] text-[#5B6B78]"
                }`}
              >
                {totalWebCount}
              </span>
              {sourcesAccordionOpen === "web" ? (
                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 opacity-70" />
              )}
            </div>
          </button>

          {sourcesAccordionOpen === "web" && (
            <div
              className={`px-2.5 pb-2.5 pt-1 border-t max-h-72 overflow-y-auto space-y-3 scrollbar-thin ${
                theme === "dark" ? "border-[#2A333B]" : "border-[#DCE3E8]"
              }`}
            >
              {webCitationsGrouped.length === 0 ? (
                <div className={`py-4 text-center text-xs ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                  Belum ada rujukan Web Akademik pada percakapan ini.
                </div>
              ) : (
                webCitationsGrouped.map((group, gIdx) => (
                  <div key={gIdx} className="space-y-1.5">
                    <div
                      className={`text-[11px] font-semibold italic flex items-center gap-1 ${
                        theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"
                      }`}
                    >
                      <span className="truncate">
                        Results for "{group.question.slice(0, 42)}{group.question.length > 42 ? '...' : ''}"
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {group.items.map((cit, cIdx) => (
                        <div
                          key={cIdx}
                          onClick={() => {
                            handleCitationClick(cit);
                            onClose();
                          }}
                          className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                            theme === "dark"
                              ? "bg-[#1B2127] hover:bg-[#2A333B] border-[#2A333B] hover:border-cyan-500/50"
                              : "bg-white hover:bg-cyan-50/50 border-[#DCE3E8] hover:border-cyan-500/40"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-1 text-[10px]">
                            <Globe className="w-3 h-3 text-cyan-500 shrink-0" />
                            <span className="font-bold text-cyan-600 dark:text-cyan-400 truncate">
                              {cit.journal_name || "PubMed / NCBI"}
                            </span>
                            <span className="opacity-50">({cit.publication_year || "2025"})</span>
                          </div>
                          <h5
                            className={`text-xs font-bold line-clamp-2 leading-tight ${
                              theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
                            }`}
                          >
                            {cit.document_title}
                          </h5>
                          {cit.abstract_snippet && (
                            <p
                              className={`text-[10px] line-clamp-2 mt-1 leading-snug ${
                                theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                              }`}
                            >
                              {cit.abstract_snippet}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* 2. SECTION ACCORDION FILES */}
        <div
          className={`rounded-xl border transition-all ${
            theme === "dark" ? "border-[#2A333B] bg-[#12161A]/60" : "border-[#DCE3E8] bg-[#F7F9FA]"
          }`}
        >
          <button
            type="button"
            onClick={() => setSourcesAccordionOpen(sourcesAccordionOpen === "files" ? null : "files")}
            className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold transition cursor-pointer ${
              theme === "dark" ? "hover:text-[#34D3BE]" : "hover:text-[#0F766E]"
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className={`w-4 h-4 ${theme === "dark" ? "text-amber-400" : "text-amber-600"}`} />
              <span>Files (MyLibrary)</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${
                  theme === "dark" ? "bg-[#2A333B] text-[#9AA9B5]" : "bg-[#E6EDF2] text-[#5B6B78]"
                }`}
              >
                {totalFileCount}
              </span>
              {sourcesAccordionOpen === "files" ? (
                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 opacity-70" />
              )}
            </div>
          </button>

          {sourcesAccordionOpen === "files" && (
            <div
              className={`px-2.5 pb-2.5 pt-1 border-t max-h-72 overflow-y-auto space-y-3 scrollbar-thin ${
                theme === "dark" ? "border-[#2A333B]" : "border-[#DCE3E8]"
              }`}
            >
              {fileCitationsGrouped.length === 0 ? (
                <div className={`py-4 text-center text-xs ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                  Belum ada rujukan modul file MyLibrary pada percakapan ini.
                </div>
              ) : (
                fileCitationsGrouped.map((group, fIdx) => (
                  <div key={fIdx} className="space-y-1.5">
                    <div
                      className={`text-[11px] font-bold flex items-center justify-between ${
                        theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <BookOpen className="w-3 h-3 text-amber-500 shrink-0" />
                        <span className="truncate">{group.docTitle}</span>
                      </div>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded border shrink-0 ${
                          theme === "dark"
                            ? "bg-[#34D3BE]/15 text-[#34D3BE] border-[#34D3BE]/30"
                            : "bg-[#0F766E]/10 text-[#0F766E] border-[#0F766E]/20"
                        }`}
                      >
                        Hlm {group.page}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {group.items.map((item, iIdx) => (
                        <div
                          key={iIdx}
                          onClick={() => {
                            handleCitationClick(item.rawCit);
                            onClose();
                          }}
                          className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                            theme === "dark"
                              ? "bg-[#1B2127] hover:bg-[#2A333B] border-[#2A333B] hover:border-amber-500/50"
                              : "bg-white hover:bg-amber-50/50 border-[#DCE3E8] hover:border-amber-500/40"
                          }`}
                        >
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mb-1 truncate">
                            Menjawab: "{item.question.slice(0, 38)}{item.question.length > 38 ? '...' : ''}"
                          </div>
                          <p
                            className={`text-[10.5px] italic line-clamp-2 leading-snug ${
                              theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                            }`}
                          >
                            "{item.quote}"
                          </p>
                          <div
                            className={`mt-1.5 flex items-center gap-1 text-[9.5px] font-semibold ${
                              theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"
                            }`}
                          >
                            <span>Buka halaman fisik {group.page}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* FOOTER POPOVER */}
      <div
        className={`pt-2 mt-2 border-t flex items-center justify-between text-[10px] ${
          theme === "dark" ? "border-[#2A333B] text-[#9AA9B5]" : "border-[#DCE3E8] text-[#5B6B78]"
        }`}
      >
        <span className="flex items-center gap-1">
          <ShieldCheck className={`w-3 h-3 ${theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"}`} />
          Evidence-Based Medicine
        </span>
        <span>{uniqueDocsCount} Dokumen Aktif</span>
      </div>
    </div>
  );
};
