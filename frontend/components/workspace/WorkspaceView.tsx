import React from "react";
import {
  PanelLeftOpen,
  ArrowLeft,
  Sun,
  Moon,
  Layers,
  PanelRightClose,
  Sparkles,
} from "lucide-react";
import {
  UserProfile,
  DocumentItem,
  CitationItem,
  Message,
  AttachedFileItem,
} from "../../types";
import { ChatBubble } from "../chat/ChatBubble";
import { ChatInputForm } from "../chat/ChatInputForm";
import { SourcesAccordionPopover } from "./SourcesAccordionPopover";
import { EvidenceViewerPanel } from "./EvidenceViewerPanel";

interface WorkspaceViewProps {
  theme: "dark" | "light";
  apiBase: string;
  currentUser: UserProfile;
  setCurrentNav: (nav: "dashboard" | "workspace" | "library" | "admin") => void;
  isLeftSidebarOpen: boolean;
  setIsLeftSidebarOpen: (isOpen: boolean) => void;
  isPdfPanelOpen: boolean;
  setIsPdfPanelOpen: (isOpen: boolean) => void;
  groundingMode: "library" | "academic";
  setGroundingMode: (m: "library" | "academic") => void;
  toggleTheme: () => void;
  isSourcesOpen: boolean;
  setIsSourcesOpen: (isOpen: boolean) => void;
  sourcesRef: React.RefObject<HTMLDivElement | null>;
  sessionCitations: CitationItem[];
  sourcesAccordionOpen: "web" | "files" | null;
  setSourcesAccordionOpen: (val: "web" | "files" | null) => void;
  totalWebCount: number;
  totalFileCount: number;
  webCitationsGrouped: { question: string; items: CitationItem[] }[];
  fileCitationsGrouped: { docTitle: string; page: number; items: { quote: string; question: string; rawCit: CitationItem }[] }[];
  uniqueDocsCount: number;
  documents: DocumentItem[];
  messages: Message[];
  inputQuestion: string;
  setInputQuestion: (val: string) => void;
  isSending: boolean;
  sendingStatusText: string;
  isRecording: boolean;
  attachedFiles: AttachedFileItem[];
  setAttachedFiles: React.Dispatch<React.SetStateAction<AttachedFileItem[]>>;
  chatTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
  chatAttachmentInputRef: React.RefObject<HTMLInputElement | null>;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  handleSendMessage: (e?: React.FormEvent) => void;
  toggleVoiceInput: () => void;
  adjustTextareaHeight: () => void;
  editingMessageId: string | null;
  editingMessageText: string;
  setEditingMessageId: (id: string | null) => void;
  setEditingMessageText: (text: string) => void;
  handleSaveEditedMessage: (id: string) => void;
  handleRetryUserMessage: (msg: Message) => void;
  handleCopyMessage: (id: string, text: string) => void;
  copiedMessageId: string | null;
  handleCitationClick: (citation: CitationItem) => void;
  setLightboxImage: (img: { src: string; title: string } | null) => void;
  isTypingStream: boolean;
  streamingMsgId: string | null;
  format24HourDisplay: (timeStr?: string) => string;
  activeAcademicCitation: CitationItem | null;
  setActiveAcademicCitation: (c: CitationItem | null) => void;
  activeDoc: DocumentItem | null;
  targetPage: number;
  setTargetPage: React.Dispatch<React.SetStateAction<number>>;
  highlightQuote: string | null;
  setHighlightQuote: (quote: string | null) => void;
}

/**
 * WorkspaceView - Area kerja interaksi tanya-jawab utama EPIONA.
 * Mengintegrasikan Header, Fullscreen message stream, Hero Centered vs Bottom Sticky Chat Input,
 * Sources Accordion Popover (Perplexity style), dan Split-Pane Evidence Viewer.
 */
export const WorkspaceView: React.FC<WorkspaceViewProps> = ({
  theme,
  apiBase,
  currentUser,
  setCurrentNav,
  isLeftSidebarOpen,
  setIsLeftSidebarOpen,
  isPdfPanelOpen,
  setIsPdfPanelOpen,
  groundingMode,
  setGroundingMode,
  toggleTheme,
  isSourcesOpen,
  setIsSourcesOpen,
  sourcesRef,
  sessionCitations,
  sourcesAccordionOpen,
  setSourcesAccordionOpen,
  totalWebCount,
  totalFileCount,
  webCitationsGrouped,
  fileCitationsGrouped,
  uniqueDocsCount,
  documents,
  messages,
  inputQuestion,
  setInputQuestion,
  isSending,
  sendingStatusText,
  isRecording,
  attachedFiles,
  setAttachedFiles,
  chatTextareaRef,
  chatAttachmentInputRef,
  chatEndRef,
  handleSendMessage,
  toggleVoiceInput,
  adjustTextareaHeight,
  editingMessageId,
  editingMessageText,
  setEditingMessageId,
  setEditingMessageText,
  handleSaveEditedMessage,
  handleRetryUserMessage,
  handleCopyMessage,
  copiedMessageId,
  handleCitationClick,
  setLightboxImage,
  isTypingStream,
  streamingMsgId,
  format24HourDisplay,
  activeAcademicCitation,
  setActiveAcademicCitation,
  activeDoc,
  targetPage,
  setTargetPage,
  highlightQuote,
  setHighlightQuote,
}) => {
  const visibleMessages = messages.filter((m) => m.id !== "welcome");

  return (
    <div className={`flex-1 flex overflow-hidden ${theme === "dark" ? "bg-[#12161A]" : "bg-[#F7F9FA]"}`}>
      {/* PANEL UTAMA CHAT */}
      <div
        className={`${
          isPdfPanelOpen
            ? theme === "dark"
              ? "w-full md:w-[48%] border-r border-[#2A333B]"
              : "w-full md:w-[48%] border-r border-[#DCE3E8]"
            : "w-full"
        } flex flex-col h-full transition-all duration-200 font-claude-sans ${
          theme === "dark" ? "bg-[#12161A]" : "bg-[#F7F9FA]"
        }`}
      >
        {/* TOP HEADER WORKSPACE */}
        <div
          className={`h-12 border-b px-4 flex items-center justify-between shrink-0 transition-colors ${
            theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
          }`}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            {!isLeftSidebarOpen && (
              <button
                onClick={() => setIsLeftSidebarOpen(true)}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  theme === "dark"
                    ? "hover:bg-[#2A333B] text-[#9AA9B5] hover:text-[#E6EDF2]"
                    : "hover:bg-[#F7F9FA] text-[#5B6B78] hover:text-[#12202B]"
                }`}
                title="Buka riwayat percakapan"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => setCurrentNav("dashboard")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                theme === "dark"
                  ? "border-[#2A333B] bg-[#12161A] text-[#9AA9B5] hover:text-[#E6EDF2] hover:bg-[#2A333B]"
                  : "border-[#DCE3E8] bg-white text-[#5B6B78] hover:text-[#0F766E] hover:bg-[#F7F9FA]"
              }`}
              title="Kembali ke Beranda Dashboard"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Beranda</span>
            </button>

            <div className="flex items-center gap-2 pl-1">
              <span className={`w-2 h-2 rounded-full ${theme === "dark" ? "bg-[#34D3BE]" : "bg-[#0F766E]"}`} />
              <span
                className={`text-xs font-bold tracking-tight truncate max-w-[160px] sm:max-w-xs font-claude-serif ${
                  theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
                }`}
              >
                EPIONA Assistant
              </span>
              {groundingMode === "academic" ? (
                <span
                  className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    theme === "dark"
                      ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                      : "bg-cyan-50 text-cyan-700 border-cyan-200"
                  }`}
                >
                  Web Akademik Terakreditasi (NCBI PubMed)
                </span>
              ) : (
                <span
                  className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    theme === "dark"
                      ? "bg-[#34D3BE]/15 text-[#34D3BE] border-[#34D3BE]/30"
                      : "bg-[#0F766E]/10 text-[#0F766E] border-[#0F766E]/20"
                  }`}
                >
                  Grounding MyLibrary Aktif
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
                theme === "dark"
                  ? "border-[#2A333B] bg-[#12161A] text-amber-300 hover:bg-[#2A333B]"
                  : "border-[#DCE3E8] bg-white text-[#5B6B78] hover:bg-[#F7F9FA]"
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

            <div className="relative">
              <button
                onClick={() => setIsSourcesOpen(!isSourcesOpen)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  theme === "dark"
                    ? "border-[#2A333B] bg-[#12161A] text-[#9AA9B5] hover:text-[#34D3BE] hover:bg-[#2A333B]"
                    : "border-[#DCE3E8] bg-white text-[#5B6B78] hover:text-[#0F766E] hover:bg-[#F7F9FA]"
                }`}
                title="Lihat sumber referensi MyLibrary"
              >
                <Layers className={`w-3.5 h-3.5 ${theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"}`} />
                <span>Sources</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    theme === "dark" ? "bg-[#34D3BE] text-[#12161A]" : "bg-[#0F766E] text-white"
                  }`}
                >
                  {sessionCitations.length}
                </span>
              </button>

              <SourcesAccordionPopover
                isOpen={isSourcesOpen}
                onClose={() => setIsSourcesOpen(false)}
                sourcesRef={sourcesRef}
                theme={theme}
                sessionCitations={sessionCitations}
                sourcesAccordionOpen={sourcesAccordionOpen}
                setSourcesAccordionOpen={setSourcesAccordionOpen}
                totalWebCount={totalWebCount}
                totalFileCount={totalFileCount}
                webCitationsGrouped={webCitationsGrouped}
                fileCitationsGrouped={fileCitationsGrouped}
                uniqueDocsCount={uniqueDocsCount}
                handleCitationClick={handleCitationClick}
              />
            </div>

            {isPdfPanelOpen && (
              <button
                onClick={() => setIsPdfPanelOpen(false)}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  theme === "dark"
                    ? "hover:bg-[#2A333B] text-[#9AA9B5] hover:text-[#E6EDF2]"
                    : "hover:bg-[#F7F9FA] text-[#5B6B78] hover:text-[#12202B]"
                }`}
                title="Tutup lembaran dokumen fisik"
              >
                <PanelRightClose className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* FADE MASK ATAS */}
        <div
          className={`pointer-events-none absolute top-12 left-0 right-0 h-8 sm:h-10 z-10 bg-gradient-to-b ${
            theme === "dark" ? "from-[#12161A] to-transparent" : "from-[#F7F9FA] to-transparent"
          }`}
        />

        {/* MESSAGE STREAM AREA */}
        <div
          className={`flex-1 overflow-y-auto px-4 sm:px-6 md:px-12 py-8 space-y-7 transition-colors ${
            theme === "dark" ? "bg-[#12161A]" : "bg-[#F7F9FA]"
          }`}
        >
          {documents.length === 0 && (
            <div
              className={`max-w-2xl mx-auto p-3.5 rounded-2xl text-xs border flex items-center justify-between gap-3 ${
                theme === "dark" ? "bg-[#1B2127] border-[#2A333B] text-[#E6EDF2]" : "bg-white border-[#DCE3E8] text-[#12202B]"
              }`}
            >
              <div className="flex items-center gap-2">
                <Sparkles className={`w-4 h-4 shrink-0 ${theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"}`} />
                <span>
                  <b>Mode Pengetahuan Umum Aktif:</b> Anda dapat mengobrol & berdiskusi langsung. Unggah modul di <b>MyLibrary</b> jika ingin grounding sitasi fisik 1:1.
                </span>
              </div>
              <button
                onClick={() => setCurrentNav("library")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition cursor-pointer ${
                  theme === "dark" ? "bg-[#34D3BE] text-[#12161A] hover:bg-[#34D3BE]/90" : "bg-[#0F766E] text-white hover:bg-[#0F766E]/90"
                }`}
              >
                Unggah PDF
              </button>
            </div>
          )}

          {visibleMessages.length === 0 ? (
            /* HERO CENTERED VIEW ALA CLAUDE (KOTAK INPUT BESAR DI TENGAH) */
            <div className="py-8 sm:py-14 px-4 flex flex-col items-center text-center max-w-3xl mx-auto w-full animate-in fade-in duration-300">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-xs mb-4 border ${
                  theme === "dark" ? "bg-[#1B2127] border-[#2A333B] text-[#34D3BE]" : "bg-white border-[#DCE3E8] text-[#0F766E]"
                }`}
              >
                <Sparkles className="w-6 h-6" />
              </div>
              <h2
                className={`text-3xl sm:text-4xl font-bold tracking-tight mb-2.5 font-claude-serif ${
                  theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
                }`}
              >
                EPIONA Research Assistant
              </h2>
              <p
                className={`text-sm sm:text-[15px] max-w-lg mb-8 leading-relaxed ${
                  theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                }`}
              >
                Asisten riset literatur akademik. Tanyakan mekanisme obat, analisis dokumen MyLibrary, atau telusuri jurnal PubMed.
              </p>

              {/* HERO CHAT INPUT */}
              <ChatInputForm
                mode="hero"
                theme={theme}
                inputQuestion={inputQuestion}
                setInputQuestion={setInputQuestion}
                isSending={isSending}
                isRecording={isRecording}
                groundingMode={groundingMode}
                setGroundingMode={setGroundingMode}
                attachedFiles={attachedFiles}
                setAttachedFiles={setAttachedFiles}
                chatTextareaRef={chatTextareaRef}
                chatAttachmentInputRef={chatAttachmentInputRef}
                handleSendMessage={handleSendMessage}
                toggleVoiceInput={toggleVoiceInput}
                adjustTextareaHeight={adjustTextareaHeight}
                setLightboxImage={setLightboxImage}
              />

              {/* QUICK PROMPT CHIPS */}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-6 select-none">
                {[
                  { text: "Analisis mekanisme obat...", prompt: "Jelaskan mekanisme kerja dan farmakokinetik obat parasetamol dan ibuprofen." },
                  { text: "Rangkum modul MyLibrary...", prompt: "Berikan rangkuman komprehensif dari dokumen literatur yang telah saya unggah di MyLibrary." },
                  { text: "Cari jurnal akademik...", prompt: "Telusuri literatur jurnal terbaru mengenai interaksi obat dan stabilitas formulasi farmasi." },
                ].map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setInputQuestion(chip.prompt);
                      if (chatTextareaRef.current) {
                        chatTextareaRef.current.focus();
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer shadow-2xs ${
                      theme === "dark"
                        ? "bg-[#1B2127] border-[#2A333B] text-[#9AA9B5] hover:text-[#E6EDF2] hover:border-[#34D3BE]/60 hover:bg-[#2A333B]"
                        : "bg-white border-[#DCE3E8] text-[#5B6B78] hover:text-[#12202B] hover:border-[#0F766E]/50 hover:bg-teal-50/40"
                    }`}
                  >
                    {chip.text}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* CONVERSATION MESSAGE LIST */
            <div className="max-w-3xl mx-auto space-y-7 w-full">
              {visibleMessages.map((m) => (
                <ChatBubble
                  key={m.id}
                  message={m}
                  theme={theme}
                  apiBase={apiBase}
                  documents={documents}
                  editingMessageId={editingMessageId}
                  editingMessageText={editingMessageText}
                  setEditingMessageId={setEditingMessageId}
                  setEditingMessageText={setEditingMessageText}
                  handleSaveEditedMessage={handleSaveEditedMessage}
                  handleRetryUserMessage={handleRetryUserMessage}
                  handleCopyMessage={handleCopyMessage}
                  copiedMessageId={copiedMessageId}
                  handleCitationClick={handleCitationClick}
                  setLightboxImage={setLightboxImage}
                  isTypingStream={isTypingStream}
                  streamingMsgId={streamingMsgId}
                  format24HourDisplay={format24HourDisplay}
                />
              ))}

              {/* CLAUDE-STYLE "Thinking..." STATUS INDICATOR */}
              {isSending && (
                <div className="flex items-center py-2.5 animate-in fade-in duration-200">
                  <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs shadow-xs transition-all ${
                      theme === "dark" ? "bg-[#181D22] border-[#2A333B] text-[#DCE3E8]" : "bg-white border-[#E2E8F0] text-[#1E293B]"
                    }`}
                  >
                    <Sparkles
                      className={`w-3.5 h-3.5 animate-spin [animation-duration:3s] ${
                        theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"
                      }`}
                    />
                    <div className="flex items-center font-medium text-xs">
                      <span className={theme === "dark" ? "text-white font-semibold" : "text-[#0F172A] font-semibold"}>
                        Thinking
                      </span>
                      <span className="tracking-widest text-[#9AA9B5] animate-pulse ml-0.5">
                        ...
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <div ref={chatEndRef as any} />
        </div>

        {/* BOTTOM STICKY INPUT BAR (HANYA MUNCUL KETIKA SUDAH ADA PESAN) */}
        {visibleMessages.length > 0 && (
          <div className={`p-4 sm:p-5 pt-1 transition-colors relative ${theme === "dark" ? "bg-[#12161A]" : "bg-[#F7F9FA]"}`}>
            {/* FADE MASK BAWAH */}
            <div
              className={`pointer-events-none absolute -top-8 sm:-top-10 left-0 right-0 h-8 sm:h-10 z-10 bg-gradient-to-t ${
                theme === "dark" ? "from-[#12161A] to-transparent" : "from-[#F7F9FA] to-transparent"
              }`}
            />
            <div className="max-w-3xl mx-auto">
              <ChatInputForm
                mode="bottom"
                theme={theme}
                inputQuestion={inputQuestion}
                setInputQuestion={setInputQuestion}
                isSending={isSending}
                isRecording={isRecording}
                groundingMode={groundingMode}
                setGroundingMode={setGroundingMode}
                attachedFiles={attachedFiles}
                setAttachedFiles={setAttachedFiles}
                chatTextareaRef={chatTextareaRef}
                chatAttachmentInputRef={chatAttachmentInputRef}
                handleSendMessage={handleSendMessage}
                toggleVoiceInput={toggleVoiceInput}
                adjustTextareaHeight={adjustTextareaHeight}
                setLightboxImage={setLightboxImage}
              />
            </div>
          </div>
        )}
      </div>

      {/* PANEL KANAN: DUAL-PANE VIEWER */}
      {isPdfPanelOpen && (
        <EvidenceViewerPanel
          theme={theme}
          apiBase={apiBase}
          currentUser={currentUser}
          activeAcademicCitation={activeAcademicCitation}
          activeDoc={activeDoc}
          targetPage={targetPage}
          setTargetPage={setTargetPage}
          highlightQuote={highlightQuote}
          setHighlightQuote={setHighlightQuote}
          setActiveAcademicCitation={setActiveAcademicCitation}
          setIsPdfPanelOpen={setIsPdfPanelOpen}
        />
      )}
    </div>
  );
};
