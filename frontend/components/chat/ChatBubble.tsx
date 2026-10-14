import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import {
  RotateCcw,
  Edit2,
  Copy,
  Check,
  ZoomIn,
  ExternalLink,
} from "lucide-react";
import {
  Message,
  DocumentItem,
  CitationItem,
  SourceItem,
  FigureSnippet,
  GroundingMode,
} from "../../types";
import { FileFormatIcon } from "../library/FileFormatIcon";
import { SourceCards } from "./SourceCards";
import { CitationChip } from "./CitationChip";
import { MessageActions } from "./MessageActions";
import { SearchProgress } from "./SearchProgress";
import { NoResult } from "./NoResult";

interface ChatBubbleProps {
  message: Message;
  theme: "dark" | "light";
  apiBase: string;
  documents: DocumentItem[];
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
  isLastMessage?: boolean;
  onSelectSource?: (source: SourceItem) => void;
  onOpenSourcePanel?: () => void;
  onSwitchModeAndRetry?: (mode: GroundingMode) => void;
  onUploadDocument?: () => void;
  onFeedback?: (msgId: string, type: "like" | "dislike") => void;
  groundingMode?: GroundingMode;
}

/**
 * Sisipkan diagram / gambar figure secara proporsional ke dalam konten teks.
 */
function injectFiguresIntoContent(text: string, figures?: FigureSnippet[]): string {
  if (!text || !figures || figures.length === 0) return text || "";
  const paragraphs = text.split(/\n\n+/);
  if (paragraphs.length <= 1) {
    const figBlocks = figures.map((_, i) => `\n\n![FIG-${i}](#fig-${i})\n\n`).join("");
    return text + figBlocks;
  }
  const result: string[] = [];
  const step = Math.max(1, Math.floor(paragraphs.length / (figures.length + 1)));
  let figIdx = 0;
  for (let i = 0; i < paragraphs.length; i++) {
    result.push(paragraphs[i]);
    if ((i + 1) % step === 0 && figIdx < figures.length) {
      result.push(`![FIG-${figIdx}](#fig-${figIdx})`);
      figIdx++;
    }
  }
  while (figIdx < figures.length) {
    result.push(`![FIG-${figIdx}](#fig-${figIdx})`);
    figIdx++;
  }
  return result.join("\n\n");
}

/**
 * Normalisasi notasi LaTeX display \[ ... \] dan inline \( ... \)
 * menjadi format standar $ ... $ dan $$ ... $$ untuk KaTeX.
 */
function preprocessLatex(text: string): string {
  if (!text) return "";
  let processed = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `\n$$\n${math.trim()}\n$$\n`);
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math.trim()}$`);
  return processed;
}

/**
 * Mengubah token sitasi [1], [1, 2] menjadi format link internal markdown [#cite-1](#cite-1)
 * tanpa merusak formula matematika atau blok kode.
 */
function formatInlineCitations(text: string): string {
  if (!text) return "";
  const tokens = text.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$|```[\s\S]*?```|`[^`\n]+?`)/g);
  return tokens
    .map((token, idx) => {
      if (idx % 2 === 1) return token;
      return token.replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (_, nums) => {
        const list = nums.split(",").map((n: string) => n.trim());
        return list.map((n: string) => `[${n}](#cite-${n})`).join(" ");
      });
    })
    .join("");
}

/**
 * Normalisasi CitationItem[] & SourceItem[] ke SourceItem[]
 */
function normalizeToSourceItems(citations?: CitationItem[], sources?: SourceItem[]): SourceItem[] {
  if (sources && sources.length > 0) return sources;
  if (!citations || citations.length === 0) return [];
  return citations.map((c, idx) => {
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

    return {
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
    };
  });
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  message: m,
  theme,
  apiBase,
  documents,
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
  isLastMessage = false,
  onSelectSource,
  onOpenSourcePanel,
  onSwitchModeAndRetry,
  onUploadDocument,
  onFeedback,
  groundingMode = "library",
}) => {
  const isUser = m.sender === "user";
  const sourceItems = normalizeToSourceItems(m.citations, m.sources);

  // Deteksi NoResult state: jawaban menyatakan tidak ditemukan dan tanpa sitasi
  const lowerText = (m.text || "").toLowerCase();
  const isNoResult =
    !isUser &&
    !isTypingStream &&
    sourceItems.length === 0 &&
    (lowerText.includes("tidak ditemukan") ||
      lowerText.includes("tidak dapat menemukan") ||
      lowerText.includes("belum tersedia di mylibrary") ||
      lowerText.includes("tidak ada dokumen yang cocok"));

  const handleSourceSelect = (source: SourceItem) => {
    if (onSelectSource) {
      onSelectSource(source);
    } else {
      // Fallback
      handleCitationClick({
        document_id: String(source.id || source.document_id || ""),
        document_title: source.title,
        page_number: source.page || 1,
        exact_quote: source.snippet || "",
        source_type: source.type,
        journal_name: source.journal,
        publication_year: String(source.year || ""),
        authors: source.authors,
        doi: source.doi,
        url: source.url,
        pdf_url: source.pdf_url,
        abstract_snippet: source.snippet,
        evidence_level: source.evidence_level,
      });
    }
  };

  return (
    <div
      className={`group/msg flex flex-col ${
        isUser ? "items-end" : "items-start"
      } animate-in fade-in duration-150 space-y-1 w-full`}
    >
      {isUser ? (
        /* USER MESSAGE: bubble kanan, surface-2, radius lg (14px), max 80%, padding 12x16 */
        <div className="flex flex-col items-end max-w-[80%]">
          <div className="group relative rounded-lg px-4 py-3 text-[14px] leading-[1.5] bg-surface-2 text-text border border-border select-text">
            {/* Lampiran User */}
            {m.attachments && m.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2 pt-0.5">
                {m.attachments.map((att, attIdx) => {
                  const isImg =
                    att.type?.startsWith("image/") ||
                    ["png", "jpg", "jpeg", "webp"].includes(att.name.split(".").pop()?.toLowerCase() || "");
                  if (isImg && att.dataUrl) {
                    return (
                      <div
                        key={attIdx}
                        className="group relative rounded-md overflow-hidden border border-border bg-surface hover:border-accent transition cursor-pointer"
                        onClick={() => setLightboxImage({ src: att.dataUrl!, title: att.name })}
                      >
                        <img
                          src={att.dataUrl}
                          alt={att.name}
                          className="max-h-40 max-w-xs object-cover rounded-md"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1.5 text-white text-xs font-medium">
                          <ZoomIn className="w-4 h-4" />
                          <span>Perbesar</span>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={attIdx}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] bg-surface border border-border text-text"
                    >
                      <FileFormatIcon filename={att.name} fileType={att.type} size="sm" />
                      <span className="truncate max-w-[150px] font-medium" title={att.name}>
                        {att.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Editor Pesan User */}
            {editingMessageId === m.id ? (
              <div className="w-full min-w-[280px] sm:min-w-[380px] pt-1">
                <textarea
                  value={editingMessageText}
                  onChange={(e) => setEditingMessageText(e.target.value)}
                  className="w-full p-2.5 text-[14px] rounded-md border border-accent bg-surface text-text outline-none resize-y min-h-[80px]"
                  placeholder="Sunting pesan Anda..."
                />
                <div className="flex items-center justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setEditingMessageId(null)}
                    className="px-2.5 py-1 rounded-sm text-[12px] font-medium text-text-muted hover:text-text cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveEditedMessage(m.id)}
                    className="px-3 py-1 rounded-sm text-[12px] font-semibold bg-accent text-white hover:bg-accent/90 transition cursor-pointer"
                  >
                    Kirim Ulang
                  </button>
                </div>
              </div>
            ) : (
              m.text && <div className="whitespace-pre-wrap">{m.text}</div>
            )}
          </div>

          {/* Action Bar User & Timestamp on Hover */}
          {editingMessageId !== m.id && (
            <div className="flex items-center gap-2 mt-1 px-1 text-[11px] text-text-muted select-none">
              <div className="flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-150">
                <button
                  type="button"
                  onClick={() => handleRetryUserMessage(m)}
                  className="p-1 rounded-sm hover:text-text hover:bg-surface-2 transition cursor-pointer"
                  title="Generate ulang pesan"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingMessageId(m.id);
                    setEditingMessageText(m.text);
                  }}
                  className="p-1 rounded-sm hover:text-text hover:bg-surface-2 transition cursor-pointer"
                  title="Sunting pesan"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyMessage(m.id, m.text)}
                  className="p-1 rounded-sm hover:text-text hover:bg-surface-2 transition cursor-pointer"
                  title="Salin pesan"
                >
                  {copiedMessageId === m.id ? (
                    <Check className="w-3.5 h-3.5 text-accent stroke-[2]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Timestamp hanya saat hover */}
              <span className="opacity-0 group-hover/msg:opacity-100 transition-opacity duration-150">
                {format24HourDisplay(m.timestamp)}
              </span>
            </div>
          )}
        </div>
      ) : (
        /* ASSISTANT MESSAGE: jawaban 16px / line-height 1.7, kolom baca tenang ala Claude/Perplexity */
        <div className="w-full text-[16px] leading-[1.7] text-text font-sans pt-1">
          {/* Status Progres Pencarian (SearchProgress) jika ada */}
          {m.searchProgress && (
            <SearchProgress
              steps={m.searchProgress.steps}
              isFinished={m.searchProgress.isFinished}
            />
          )}

          {/* Kartu Sumber di Atas Jawaban (SourceCards) */}
          {sourceItems.length > 0 && (
            <SourceCards
              sources={sourceItems}
              onSelectSource={handleSourceSelect}
              onOpenSourcePanel={onOpenSourcePanel}
            />
          )}

          {/* No Result State Card */}
          {isNoResult ? (
            <NoResult
              currentMode={groundingMode}
              onSwitchModeAndRetry={onSwitchModeAndRetry}
              onUploadDocument={onUploadDocument}
              customMessage={m.text}
            />
          ) : (
            /* Jawaban Asisten (Markdown Rendered) */
            <div className="selection:bg-accent-soft selection:text-text">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  img: ({ src, alt }: any) => {
                    if (src && typeof src === "string" && src.startsWith("#fig-")) {
                      const figIdx = parseInt(src.replace("#fig-", ""), 10);
                      const fig = m.figures && m.figures[figIdx];
                      if (!fig) return null;
                      const linkedDoc = documents.find((d) => d.id === fig.document_id);
                      const docTitle = linkedDoc?.title || "Dokumen Referensi";
                      return (
                        <figure className="my-5 flex flex-col items-center justify-center select-none max-w-lg mx-auto">
                          <div className="rounded-md overflow-hidden border border-border bg-surface">
                            <img
                              src={`${apiBase}${fig.image_url}`}
                              alt={fig.caption || `Gambar ${figIdx + 1}`}
                              className="max-h-72 w-auto object-contain block"
                              loading="lazy"
                            />
                          </div>
                          <figcaption
                            onClick={() =>
                              handleSourceSelect({
                                id: fig.document_id,
                                type: "pdf",
                                title: docTitle,
                                meta: `hal. ${fig.page_number}`,
                                page: fig.page_number,
                                snippet: fig.caption,
                              })
                            }
                            className="mt-2 text-center cursor-pointer hover:underline text-[12px] text-text-muted"
                          >
                            <span className="font-semibold text-text mr-1">Gambar {figIdx + 1}.</span>
                            <span>{fig.caption || `Halaman ${fig.page_number}`}</span>
                          </figcaption>
                        </figure>
                      );
                    }
                    return <img src={src} alt={alt} className="rounded-md my-2 max-w-full" />;
                  },
                  h1: ({ node, ...props }) => (
                    <h1 className="text-[24px] font-semibold text-text mt-5 mb-2.5 tracking-tight" {...props} />
                  ),
                  h2: ({ node, ...props }) => (
                    <h2 className="text-[18px] font-semibold text-text mt-4 mb-2 tracking-tight" {...props} />
                  ),
                  h3: ({ node, ...props }) => (
                    <h3 className="text-[16px] font-semibold text-text mt-3.5 mb-1.5" {...props} />
                  ),
                  p: ({ node, ...props }) => (
                    <p className="my-2 text-[16px] leading-[1.7]" {...props} />
                  ),
                  ul: ({ node, ...props }) => (
                    <ul className="list-disc list-outside ml-5 my-2 space-y-1 marker:text-text-muted" {...props} />
                  ),
                  ol: ({ node, ...props }) => (
                    <ol className="list-decimal list-outside ml-5 my-2 space-y-1.5 marker:text-text-muted" {...props} />
                  ),
                  li: ({ node, ...props }) => (
                    <li className="leading-[1.7] pl-1" {...props} />
                  ),
                  blockquote: ({ node, ...props }) => (
                    <blockquote
                      className="border-l-2 border-border pl-3.5 my-2.5 text-text-muted italic"
                      {...props}
                    />
                  ),
                  table: ({ node, ...props }) => (
                    <div className="overflow-x-auto my-3 rounded-md border border-border">
                      <table className="w-full text-[13px] text-left border-collapse" {...props} />
                    </div>
                  ),
                  th: ({ node, ...props }) => (
                    <th className="border-b border-border bg-surface-2 px-3 py-2 font-semibold text-text" {...props} />
                  ),
                  td: ({ node, ...props }) => (
                    <td className="border-b border-border px-3 py-2 text-text" {...props} />
                  ),
                  code: ({ node, className, children, ...props }: any) => {
                    const isInline = !className && typeof children === "string" && !children.includes("\n");
                    if (isInline) {
                      return (
                        <code
                          className="font-mono text-[13px] px-1.5 py-0.5 rounded-sm bg-surface-2 text-accent border border-border"
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    }
                    return (
                      <pre className="border border-border bg-surface-2 rounded-md p-3.5 my-3 overflow-x-auto font-mono text-[13px] text-text">
                        <code className={className} {...props}>
                          {children}
                        </code>
                      </pre>
                    );
                  },
                  a: ({ href, children, ...props }: any) => {
                    // Check if it's an inline citation token like [#cite-1](#cite-1)
                    if (href && typeof href === "string" && href.startsWith("#cite-")) {
                      const citeNum = parseInt(href.replace("#cite-", ""), 10);
                      const targetSource = sourceItems[citeNum - 1];
                      return (
                        <CitationChip
                          index={citeNum}
                          source={targetSource}
                          onClick={() => targetSource && handleSourceSelect(targetSource)}
                        />
                      );
                    }
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline font-medium"
                        {...props}
                      >
                        {children}
                      </a>
                    );
                  },
                }}
              >
                {formatInlineCitations(preprocessLatex(injectFiguresIntoContent(m.text, m.figures)))}
              </ReactMarkdown>
            </div>
          )}

          {/* Typing Stream Indicator */}
          {isTypingStream && streamingMsgId === m.id && (
            <span className="inline-block w-1.5 h-4 ml-1 rounded-xs bg-accent animate-pulse align-middle" />
          )}

          {/* Aksi Jawaban (Salin, Regenerasi, 👍/👎, Sumber) */}
          <MessageActions
            messageText={m.text}
            isLastMessage={isLastMessage}
            onRegenerate={() => handleRetryUserMessage(m)}
            onOpenSources={onOpenSourcePanel}
            hasSources={sourceItems.length > 0}
            onFeedback={(type) => onFeedback && onFeedback(m.id, type)}
            currentFeedback={m.feedback}
          />
        </div>
      )}
    </div>
  );
};
