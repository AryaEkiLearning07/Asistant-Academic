import React, { useState, useMemo } from "react";
import {
  PanelLeftOpen,
  ArrowLeft,
  Sun,
  Moon,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  UserProfile,
  DocumentItem,
  CitationItem,
  SourceItem,
  Message,
  AttachedFileItem,
  ModelPreference,
  GroundingMode,
} from "../../types";
import { ChatBubble } from "../chat/ChatBubble";
import { Composer } from "../chat/Composer";
import { EmptyState } from "../chat/EmptyState";
import { SourcePanel } from "./SourcePanel";

interface WorkspaceViewProps {
  theme: "dark" | "light";
  apiBase: string;
  currentUser: UserProfile;
  setCurrentNav: (nav: "dashboard" | "workspace" | "library" | "admin") => void;
  isLeftSidebarOpen: boolean;
  setIsLeftSidebarOpen: (isOpen: boolean) => void;
  isPdfPanelOpen: boolean;
  setIsPdfPanelOpen: (isOpen: boolean) => void;
  groundingMode: GroundingMode;
  setGroundingMode: (m: GroundingMode) => void;
  modelPreference: ModelPreference;
  setModelPreference: (m: ModelPreference) => void;
  onOpenSubscriptionModal?: () => void;
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
  setActiveDoc: (doc: DocumentItem | null) => void;
  targetPage: number;
  setTargetPage: React.Dispatch<React.SetStateAction<number>>;
  highlightQuote: string | null;
  setHighlightQuote: (quote: string | null) => void;
}

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
  modelPreference,
  setModelPreference,
  onOpenSubscriptionModal,
  toggleTheme,
  sessionCitations,
  documents,
  messages,
  inputQuestion,
  setInputQuestion,
  isSending,
  isRecording,
  attachedFiles,
  setAttachedFiles,
  chatEndRef,
  handleSendMessage,
  toggleVoiceInput,
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
  activeDoc,
  setActiveDoc,
  targetPage,
  setTargetPage,
}) => {
  const [activeSource, setActiveSource] = useState<SourceItem | null>(null);

  const visibleMessages = messages.filter((m) => m.id !== "welcome");

  // Kumpulkan seluruh sumber sesi yang unik
  const allSessionSources = useMemo<SourceItem[]>(() => {
    const list: SourceItem[] = [];
    const seen = new Set<string>();

    messages.forEach((m) => {
      if (m.sources && m.sources.length > 0) {
        m.sources.forEach((s) => {
          const key = `${s.type}-${s.id || s.title}`;
          if (!seen.has(key)) {
            seen.add(key);
            list.push(s);
          }
        });
      } else if (m.citations && m.citations.length > 0) {
        m.citations.forEach((c, idx) => {
          const key = `${c.source_type}-${c.document_id || idx}-${c.page_number}`;
          if (!seen.has(key)) {
            seen.add(key);
            const isAcademic = c.source_type === "academic_web" || Boolean(c.journal_name);
            const isLabel = c.source_type === "label";
            const isWeb = c.source_type === "web";
            const type = isLabel ? "label" : isAcademic ? "journal" : isWeb ? "web" : "pdf";
            let meta = `hal. ${c.page_number || 1}`;
            if (isAcademic) {
              meta = `${c.journal_name || "Jurnal"}${c.publication_year ? " · " + c.publication_year : ""}`;
            } else if (isLabel) {
              meta = "Label resmi FDA";
            } else if (isWeb) {
              meta = c.url ? new URL(c.url).hostname.replace(/^www\./, "") : "Web";
            }

            list.push({
              id: c.document_id || idx + 1,
              type,
              title: c.document_title || "Dokumen Rujukan",
              meta,
              page: c.page_number,
              doi: c.doi,
              url: c.url,
              pdf_url: c.pdf_url,
              snippet: c.exact_quote || c.abstract_snippet,
              highlights: c.exact_quote ? [c.exact_quote] : [],
              authors: c.authors,
              journal: c.journal_name,
              year: c.publication_year,
              evidence_level: c.evidence_level,
              document_id: c.document_id,
            });
          }
        });
      }
    });

    return list;
  }, [messages]);

  const handleSelectSource = (source: SourceItem) => {
    setActiveSource(source);
    setIsPdfPanelOpen(true);
    if (source.type === "pdf" && source.document_id) {
      const found = documents.find((d) => d.id === source.document_id);
      if (found) {
        setActiveDoc(found);
      }
      if (source.page) {
        setTargetPage(source.page);
      }
    }
  };

  const handleSwitchModeAndRetry = (mode: GroundingMode) => {
    setGroundingMode(mode);
    const lastUserMsg = [...messages].reverse().find((m) => m.sender === "user");
    if (lastUserMsg) {
      handleRetryUserMessage(lastUserMsg);
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden h-full bg-bg text-text">
      {/* AREA UTAMA CHAT (Kolom konten maks 760px, padding x 24px) */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* TOP HEADER WORKSPACE */}
        <header className="h-14 px-6 flex items-center justify-between border-b border-border bg-surface shrink-0 select-none z-10">
          <div className="flex items-center gap-3 overflow-hidden">
            {!isLeftSidebarOpen && (
              <button
                type="button"
                onClick={() => setIsLeftSidebarOpen(true)}
                className="w-8 h-8 flex items-center justify-center rounded-sm text-text-muted hover:text-text hover:bg-surface-2 transition cursor-pointer"
                title="Buka riwayat percakapan"
                aria-label="Buka sidebar"
              >
                <PanelLeftOpen className="w-4 h-4 stroke-[1.75]" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setCurrentNav("dashboard")}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[12px] font-medium bg-surface-2 hover:bg-surface text-text border border-border transition cursor-pointer"
              title="Kembali ke Beranda"
            >
              <ArrowLeft className="w-3.5 h-3.5 stroke-[1.75]" />
              <span>Beranda</span>
            </button>

            <div className="flex items-center gap-2 pl-1 truncate">
              <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
              <span className="text-[14px] font-semibold text-text tracking-tight truncate">
                EPIONA Assistant
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-pill bg-surface-2 border border-border text-text-muted hidden sm:inline-block">
                {groundingMode === "auto"
                  ? "Auto Research"
                  : groundingMode === "library"
                  ? "MyLibrary"
                  : groundingMode === "academic"
                  ? "Akademik"
                  : "Web"}
              </span>
            </div>
          </div>

          {/* Action Header Kanan: Theme Toggle & Sources Panel Button */}
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
              onClick={() => setIsPdfPanelOpen(!isPdfPanelOpen)}
              className={`flex items-center gap-1.5 h-8 px-2.5 rounded-sm text-[12px] font-medium border transition cursor-pointer select-none ${
                isPdfPanelOpen
                  ? "bg-accent-soft text-accent border-accent font-semibold"
                  : "bg-surface-2 text-text border-border hover:bg-surface"
              }`}
              title="Buka panel sumber referensi (Esc untuk menutup)"
              aria-label="Toggle panel sumber"
            >
              <Layers className="w-3.5 h-3.5 stroke-[1.75]" />
              <span>Sumber</span>
              <span className="text-[11px] px-1.5 rounded-pill bg-surface text-text font-semibold border border-border">
                {allSessionSources.length || sessionCitations.length}
              </span>
            </button>
          </div>
        </header>

        {/* CHAT CONTENT STREAM */}
        <div className="flex-1 overflow-y-auto">
          {visibleMessages.length === 0 ? (
            /* EMPTY STATE: 24px title, composer centered, 4 suggestion chips */
            <EmptyState
              inputQuestion={inputQuestion}
              setInputQuestion={setInputQuestion}
              isSending={isSending}
              onSend={() => handleSendMessage()}
              onStop={() => {}}
              groundingMode={groundingMode}
              setGroundingMode={setGroundingMode}
              modelPreference={modelPreference}
              setModelPreference={setModelPreference}
              currentUser={currentUser}
              onOpenSubscription={onOpenSubscriptionModal}
              attachedFiles={attachedFiles}
              setAttachedFiles={setAttachedFiles}
              isRecording={isRecording}
              toggleVoiceInput={toggleVoiceInput}
              onPreviewImage={setLightboxImage}
            />
          ) : (
            /* CONVERSATION MESSAGE LIST: Kolom konten maks 760px, padding x 24px (px-6) */
            <div className="w-full max-w-[760px] mx-auto px-6 py-6 space-y-6">
              {visibleMessages.map((m, idx) => (
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
                  isLastMessage={idx === visibleMessages.length - 1}
                  onSelectSource={handleSelectSource}
                  onOpenSourcePanel={() => setIsPdfPanelOpen(true)}
                  onSwitchModeAndRetry={handleSwitchModeAndRetry}
                  onUploadDocument={() => setCurrentNav("library")}
                  groundingMode={groundingMode}
                />
              ))}

              {/* Status Menunggu Respon */}
              {isSending && !isTypingStream && (
                <div className="flex items-center gap-2 py-2 text-[14px] text-text-muted animate-in fade-in duration-150">
                  <Sparkles className="w-4 h-4 text-accent animate-spin [animation-duration:2.5s]" />
                  <span>EPIONA sedang menelaah literatur…</span>
                </div>
              )}

              <div ref={chatEndRef as any} />
            </div>
          )}
        </div>

        {/* BOTTOM STICKY COMPOSER (hanya muncul bila sudah ada pesan) */}
        {visibleMessages.length > 0 && (
          <div className="border-t border-border bg-bg/95 backdrop-blur-xs py-3 px-6 shrink-0">
            <div className="w-full max-w-[760px] mx-auto">
              <Composer
                inputQuestion={inputQuestion}
                setInputQuestion={setInputQuestion}
                isSending={isSending}
                onSend={() => handleSendMessage()}
                onStop={() => {}}
                groundingMode={groundingMode}
                setGroundingMode={setGroundingMode}
                modelPreference={modelPreference}
                setModelPreference={setModelPreference}
                currentUser={currentUser}
                onOpenSubscription={onOpenSubscriptionModal}
                attachedFiles={attachedFiles}
                setAttachedFiles={setAttachedFiles}
                isRecording={isRecording}
                toggleVoiceInput={toggleVoiceInput}
                onPreviewImage={setLightboxImage}
              />
            </div>
          </div>
        )}
      </div>

      {/* SIDEBAR SUMBER KANAN 400px (collapsible, ≥1280px docked, <1280px drawer overlay) */}
      <SourcePanel
        isOpen={isPdfPanelOpen}
        onClose={() => setIsPdfPanelOpen(false)}
        sources={allSessionSources}
        activeSource={activeSource}
        onSelectSource={(s) => setActiveSource(s)}
        apiBase={apiBase}
        currentUser={currentUser}
        activeDoc={activeDoc}
        targetPage={targetPage}
        setTargetPage={(p) => setTargetPage(p)}
      />
    </div>
  );
};
