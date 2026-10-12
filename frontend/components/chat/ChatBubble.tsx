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
import { Message, DocumentItem, CitationItem, FigureSnippet } from "../../types";
import { FileFormatIcon } from "../library/FileFormatIcon";

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
}

/**
 * Sisipkan diagram / potongan gambar figure secara proporsional ke dalam paragraf.
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
 * menjadi format standar $ ... $ dan $$ ... $$ agar dirender presisi oleh KaTeX.
 */
function preprocessLatex(text: string): string {
  if (!text) return "";
  let processed = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `\n$$\n${math.trim()}\n$$\n`);
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math.trim()}$`);
  return processed;
}

/**
 * Mengubah token sitasi [1], [1, 2] menjadi link markdown [#cite-1](#cite-1)
 * dengan melindungi rumus matematika dan blok kode agar tidak rusak.
 */
function formatInlineCitations(text: string): string {
  if (!text) return "";
  const tokens = text.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$|```[\s\S]*?```|`[^`\n]+?`)/g);
  return tokens
    .map((token, idx) => {
      // Token ganjil adalah blok math ($...$, $$...$$) atau code block, jangan diubah
      if (idx % 2 === 1) return token;
      return token.replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (_, nums) => {
        const list = nums.split(",").map((n: string) => n.trim());
        return list.map((n: string) => `[${n}](#cite-${n})`).join(" ");
      });
    })
    .join("");
}

/**
 * ChatBubble - Menampilkan pesan obrolan (pengguna di kanan & asisten di kiri).
 */
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
}) => {
  return (
    <div
      className={`group/msg flex flex-col ${
        m.sender === "user" ? "items-end" : "items-start"
      } animate-in fade-in duration-150 space-y-1`}
    >
      {m.sender === "user" ? (
        <>
          <div
            className={`group relative max-w-[85%] rounded-2xl px-4 py-2.5 text-sm md:text-[15px] leading-relaxed rounded-tr-xs shadow-2xs ${
              theme === "dark"
                ? "bg-[#1B2127] text-[#E6EDF2] border border-[#2A333B]"
                : "bg-[#0F766E] text-white shadow-xs"
            }`}
          >
            {/* Lampiran User */}
            {m.attachments && m.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2 pt-0.5">
                {m.attachments.map((att, attIdx) => {
                  const isImg = att.type?.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(att.name.split(".").pop()?.toLowerCase() || "");
                  if (isImg && att.dataUrl) {
                    return (
                      <div
                        key={attIdx}
                        className={`group relative rounded-xl overflow-hidden border shadow-sm transition cursor-pointer ${
                          theme === "dark"
                            ? "border-[#2A333B] bg-[#12161A] hover:border-[#34D3BE]"
                            : "border-teal-700/60 bg-teal-800/60 hover:border-white"
                        }`}
                        onClick={() => setLightboxImage({ src: att.dataUrl!, title: att.name })}
                      >
                        <img
                          src={att.dataUrl}
                          alt={att.name}
                          className="max-h-48 max-w-xs object-cover group-hover:scale-102 transition duration-200 rounded-lg"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1.5 text-white text-xs font-semibold backdrop-blur-[1px]">
                          <ZoomIn className="w-4 h-4" />
                          <span>Perbesar</span>
                        </div>
                        <div className="absolute bottom-1 left-1 right-1 px-1.5 py-0.5 rounded bg-black/75 text-[10px] text-zinc-200 truncate backdrop-blur-xs">
                          {att.name}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={attIdx}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border shadow-2xs ${
                        theme === "dark"
                          ? "bg-[#12161A] border-[#2A333B] text-[#E6EDF2]"
                          : "bg-teal-800/80 border-teal-600 text-white"
                      }`}
                    >
                      <FileFormatIcon filename={att.name} fileType={att.type} size="sm" />
                      <span className="truncate max-w-[160px] font-medium" title={att.name}>
                        {att.name}
                      </span>
                      <span className="text-[10px] opacity-75">
                        ({(att.size / 1024).toFixed(0)} KB)
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Konten Teks User / Editor */}
            {editingMessageId === m.id ? (
              <div className="w-full min-w-[280px] sm:min-w-[420px] pt-1">
                <textarea
                  value={editingMessageText}
                  onChange={(e) => setEditingMessageText(e.target.value)}
                  className={`w-full p-2.5 text-sm rounded-xl border outline-none resize-y min-h-[90px] ${
                    theme === "dark"
                      ? "bg-[#12161A] text-[#E6EDF2] border-[#34D3BE]/60 focus:border-[#34D3BE]"
                      : "bg-white text-zinc-900 border-teal-300 focus:border-teal-500"
                  }`}
                  placeholder="Sunting pesan Anda..."
                />
                <div className="flex items-center justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setEditingMessageId(null)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer border ${
                      theme === "dark"
                        ? "bg-transparent text-[#9AA9B5] border-[#2A333B] hover:text-white"
                        : "bg-transparent text-zinc-700 border-zinc-200 hover:bg-zinc-100"
                    }`}
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveEditedMessage(m.id)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-teal-500 hover:bg-teal-600 text-white transition cursor-pointer shadow-xs"
                  >
                    Kirim Ulang
                  </button>
                </div>
              </div>
            ) : (
              m.text && <div className="whitespace-pre-wrap">{m.text}</div>
            )}
          </div>

          {/* Action Bar User */}
          {editingMessageId !== m.id && (
            <div className="flex items-center justify-end gap-2.5 mt-1.5 px-1 text-xs select-none">
              <div className="flex items-center gap-2 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-150">
                <button
                  type="button"
                  onClick={() => handleRetryUserMessage(m)}
                  className={`p-1 rounded-md transition cursor-pointer hover:scale-105 ${
                    theme === "dark" ? "hover:text-[#34D3BE] text-[#9AA9B5]" : "hover:text-[#0F766E] text-zinc-500"
                  }`}
                  title="Generate ulang pertanyaan ini"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingMessageId(m.id);
                    setEditingMessageText(m.text);
                  }}
                  className={`p-1 rounded-md transition cursor-pointer hover:scale-105 ${
                    theme === "dark" ? "hover:text-[#34D3BE] text-[#9AA9B5]" : "hover:text-[#0F766E] text-zinc-500"
                  }`}
                  title="Edit pesan ini"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyMessage(m.id, m.text)}
                  className={`p-1 rounded-md transition cursor-pointer hover:scale-105 ${
                    theme === "dark" ? "hover:text-[#34D3BE] text-[#9AA9B5]" : "hover:text-[#0F766E] text-zinc-500"
                  }`}
                  title="Salin pesan"
                >
                  {copiedMessageId === m.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <span className="text-[11px] font-mono text-[#9AA9B5] opacity-75">
                {format24HourDisplay(m.timestamp)}
              </span>
            </div>
          )}
        </>
      ) : (
        /* Asisten Message */
        <div
          className={`group relative w-full text-sm md:text-[15px] leading-relaxed pt-1 ${
            theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
          }`}
        >
          <div className="leading-relaxed selection:bg-teal-500/20">
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
                    const triggerOpenPdf = (e: React.MouseEvent) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleCitationClick({
                        document_id: fig.document_id,
                        document_title: docTitle,
                        page_number: fig.page_number,
                        exact_quote: fig.caption || `Gambar Halaman ${fig.page_number}`,
                        source_type: "local_pdf",
                      });
                    };
                    return (
                      <figure className="my-5 flex flex-col items-center justify-center select-none max-w-lg mx-auto">
                        <div
                          className={`rounded-xl overflow-hidden border shadow-2xs ${
                            theme === "dark" ? "bg-[#181E24] border-[#2A333B]" : "bg-white border-[#E2E8F0]"
                          }`}
                        >
                          <img
                            src={`${apiBase}${fig.image_url}`}
                            alt={fig.caption || `Gambar ${figIdx + 1}`}
                            className="max-h-72 sm:max-h-80 w-auto object-contain block"
                            loading="lazy"
                          />
                        </div>
                        <figcaption
                          onClick={triggerOpenPdf}
                          className="mt-2 text-center cursor-pointer transition max-w-md group/cap"
                          title={`Klik referensi untuk membuka ${docTitle} pada Halaman ${fig.page_number}`}
                        >
                          <div className={`text-xs font-semibold ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
                            <span className={`font-bold mr-1 ${theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"}`}>
                              Gambar {figIdx + 1}.
                            </span>
                            <span>{fig.caption || `Ilustrasi pada halaman ${fig.page_number}`}</span>
                          </div>
                          <div
                            className={`text-[11px] mt-0.5 flex items-center justify-center gap-1 group-hover/cap:underline ${
                              theme === "dark"
                                ? "text-[#9AA9B5] group-hover/cap:text-[#34D3BE]"
                                : "text-[#5B6B78] group-hover/cap:text-[#0F766E]"
                            }`}
                          >
                            <span>Sumber: {docTitle}, Halaman {fig.page_number}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </div>
                        </figcaption>
                      </figure>
                    );
                  }
                  return <img src={src} alt={alt} className="rounded-lg my-2 max-w-full" />;
                },
                strong: ({ node, ...props }) => (
                  <strong className={`font-semibold ${theme === "dark" ? "text-white" : "text-[#12202B]"}`} {...props} />
                ),
                b: ({ node, ...props }) => (
                  <b className={`font-semibold ${theme === "dark" ? "text-white" : "text-[#12202B]"}`} {...props} />
                ),
                em: ({ node, ...props }) => (
                  <em className={`italic ${theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"}`} {...props} />
                ),
                h1: ({ node, ...props }) => (
                  <h1 className={`text-xl font-bold mt-4 mb-2 tracking-tight font-claude-serif ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`} {...props} />
                ),
                h2: ({ node, ...props }) => (
                  <h2 className={`text-lg font-bold mt-3.5 mb-2 tracking-tight font-claude-serif ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`} {...props} />
                ),
                h3: ({ node, ...props }) => (
                  <h3 className={`text-base font-bold mt-3 mb-1.5 font-claude-serif ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`} {...props} />
                ),
                p: ({ node, ...props }) => (
                  <p className={`my-2 leading-relaxed ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`} {...props} />
                ),
                ul: ({ node, ...props }) => (
                  <ul className={`list-disc list-outside ml-5 my-2 space-y-1 ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`} {...props} />
                ),
                ol: ({ node, ...props }) => (
                  <ol className={`list-decimal list-outside ml-5 my-2 space-y-1.5 ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`} {...props} />
                ),
                li: ({ node, ...props }) => (
                  <li className="leading-relaxed pl-1 marker:text-teal-500" {...props} />
                ),
                pre: ({ node, ...props }) => (
                  <pre
                    className={`border rounded-xl p-3.5 my-3 overflow-x-auto font-mono text-xs ${
                      theme === "dark"
                        ? "bg-[#12161A] border-[#2A333B] text-[#E6EDF2]"
                        : "bg-slate-900 border-slate-800 text-slate-100"
                    }`}
                    {...props}
                  />
                ),
                code: ({ node, className, children, ...props }: any) => {
                  const isInline = !className && typeof children === "string" && !children.includes("\n");
                  if (isInline) {
                    return (
                      <code
                        className={`font-mono text-[13px] px-1.5 py-0.5 rounded border ${
                          theme === "dark"
                            ? "bg-[#1B2127] text-[#34D3BE] border-[#2A333B]"
                            : "bg-teal-50 text-[#0F766E] border-teal-200"
                        }`}
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  }
                  return <code className={className} {...props}>{children}</code>;
                },
                blockquote: ({ node, ...props }) => (
                  <blockquote
                    className={`border-l-2 pl-3.5 my-2 italic ${
                      theme === "dark" ? "text-[#9AA9B5] border-[#34D3BE]" : "text-[#5B6B78] border-[#0F766E]"
                    }`}
                    {...props}
                  />
                ),
                table: ({ node, ...props }) => (
                  <div className={`overflow-x-auto my-3 rounded-lg border ${theme === "dark" ? "border-[#2A333B]" : "border-[#DCE3E8]"}`}>
                    <table className="w-full text-xs text-left border-collapse" {...props} />
                  </div>
                ),
                th: ({ node, ...props }) => (
                  <th
                    className={`border-b px-3 py-2 font-bold ${
                      theme === "dark"
                        ? "border-[#2A333B] bg-[#1B2127] text-[#E6EDF2]"
                        : "border-[#DCE3E8] bg-[#F7F9FA] text-[#12202B]"
                    }`}
                    {...props}
                  />
                ),
                td: ({ node, ...props }) => (
                  <td
                    className={`border-b px-3 py-2 ${
                      theme === "dark" ? "border-[#2A333B]" : "border-[#DCE3E8]"
                    }`}
                    {...props}
                  />
                ),
                a: ({ href, children, ...props }: any) => {
                  if (href && typeof href === "string" && href.startsWith("#cite-")) {
                    const citeNum = parseInt(href.replace("#cite-", ""), 10);
                    const citeIdx = citeNum - 1;
                    const citation = m.citations && m.citations[citeIdx];
                    const cleanDocTitle = citation?.document_title
                      ? citation.document_title.replace(/\.pdf$/i, "").replace(/[-_]/g, " ").slice(0, 24)
                      : "";
                    const isAcademic = citation?.source_type === "academic_web" || Boolean(citation?.journal_name);
                    const labelText = isAcademic
                      ? `${citation?.journal_name || "Jurnal"} (${citation?.publication_year || "2024"})`
                      : cleanDocTitle;
                    return (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (citation) handleCitationClick(citation);
                        }}
                        title={
                          citation
                            ? isAcademic
                              ? `JURNAL: ${citation.document_title}\nPublikasi: ${citation.journal_name} (${citation.publication_year})\nDOI: ${citation.doi || '-'}\n\nKutipan Bukti Empiris:\n"${citation.exact_quote}"`
                              : `Dokumen: ${citation.document_title}\nHalaman: ${citation.page_number}\n\nKutipan:\n"${citation.exact_quote}"`
                            : `Rujukan [${citeNum}]`
                        }
                        className={`inline-flex items-center gap-1.5 max-w-[260px] h-[21px] px-2 mx-1 text-[11px] font-semibold rounded-md border transition-all cursor-pointer align-baseline select-none -translate-y-0.5 shadow-2xs group ${
                          theme === "dark"
                            ? "bg-[#1B2127] text-[#E6EDF2] border-[#2A333B] hover:bg-[#34D3BE] hover:text-[#12161A] hover:border-[#34D3BE]"
                            : "bg-teal-50/80 text-teal-900 border-teal-200 hover:bg-[#0F766E] hover:text-white hover:border-[#0F766E]"
                        }`}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                            theme === "dark"
                              ? "bg-[#34D3BE] text-[#12161A] group-hover:bg-[#12161A] group-hover:text-[#34D3BE]"
                              : "bg-[#0F766E] text-white group-hover:bg-white group-hover:text-[#0F766E]"
                          }`}
                        >
                          {citeNum}
                        </span>
                        {labelText && (
                          <span
                            className={`truncate text-[10.5px] ${
                              theme === "dark" ? "text-[#9AA9B5] group-hover:text-[#12161A]" : "text-teal-800 group-hover:text-white"
                            }`}
                          >
                            {labelText}
                          </span>
                        )}
                        {!isAcademic && citation && (
                          <span
                            className={`text-[10px] font-bold shrink-0 ${
                              theme === "dark" ? "text-[#34D3BE] group-hover:text-[#12161A]" : "text-[#0F766E] group-hover:text-white"
                            }`}
                          >
                            hlm.{citation.page_number}
                          </span>
                        )}
                        {isAcademic && (
                          <span
                            className={`text-[9px] font-bold px-1 py-0.2 rounded shrink-0 ${
                              theme === "dark"
                                ? "bg-[#34D3BE]/20 text-[#34D3BE] group-hover:bg-[#12161A] group-hover:text-[#34D3BE]"
                                : "bg-teal-200/80 text-teal-900 group-hover:bg-white group-hover:text-[#0F766E]"
                            }`}
                          >
                            Jurnal
                          </span>
                        )}
                      </button>
                    );
                  }
                  return (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={theme === "dark" ? "text-[#34D3BE] hover:underline font-semibold" : "text-[#0F766E] hover:underline font-semibold"}
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
            {isTypingStream && streamingMsgId === m.id && (
              <span
                className={`inline-block w-1.5 h-4 ml-1 rounded-xs animate-pulse align-middle ${
                  theme === "dark" ? "bg-[#34D3BE]" : "bg-[#0F766E]"
                }`}
              />
            )}
          </div>

          {/* Action Bar Assistant (Salin & Timestamp 24 Jam) */}
          <div className="flex items-center justify-between w-full mt-3 pt-1 text-xs select-none">
            <button
              type="button"
              onClick={() => handleCopyMessage(m.id, m.text)}
              className={`p-1 rounded-md transition cursor-pointer hover:scale-105 flex items-center gap-1.5 ${
                theme === "dark" ? "hover:text-[#34D3BE] text-[#9AA9B5]" : "hover:text-[#0F766E] text-zinc-500"
              }`}
              title="Salin respon asisten"
            >
              {copiedMessageId === m.id ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px] text-emerald-500 font-semibold">Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Salin</span>
                </>
              )}
            </button>
            <span className="text-[11px] font-mono text-[#9AA9B5] opacity-80 ml-auto">
              {format24HourDisplay(m.timestamp)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
