import React from "react";
import { Send, Plus, Mic, MicOff, X, Library, Globe } from "lucide-react";
import { AttachedFileItem } from "../../types";
import { FileFormatIcon } from "../library/FileFormatIcon";

interface ChatInputFormProps {
  mode: "hero" | "bottom";
  theme: "dark" | "light";
  inputQuestion: string;
  setInputQuestion: (val: string) => void;
  isSending: boolean;
  isRecording: boolean;
  groundingMode: "library" | "academic";
  setGroundingMode: (m: "library" | "academic") => void;
  attachedFiles: AttachedFileItem[];
  setAttachedFiles: React.Dispatch<React.SetStateAction<AttachedFileItem[]>>;
  chatTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
  chatAttachmentInputRef: React.RefObject<HTMLInputElement | null>;
  handleSendMessage: (e?: React.FormEvent) => void;
  toggleVoiceInput: () => void;
  adjustTextareaHeight: () => void;
  setLightboxImage: (img: { src: string; title: string } | null) => void;
}

/**
 * ChatInputForm - Komponen kotak input chat serbaguna (mode hero terpusat dan mode bottom sticky).
 */
export const ChatInputForm: React.FC<ChatInputFormProps> = ({
  mode,
  theme,
  inputQuestion,
  setInputQuestion,
  isSending,
  isRecording,
  groundingMode,
  setGroundingMode,
  attachedFiles,
  setAttachedFiles,
  chatTextareaRef,
  chatAttachmentInputRef,
  handleSendMessage,
  toggleVoiceInput,
  adjustTextareaHeight,
  setLightboxImage,
}) => {
  const isHero = mode === "hero";

  return (
    <div className="w-full text-left">
      {/* PREVIEW ATTACHED FILES CHIPS */}
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 px-1">
          {attachedFiles.map((f) => {
            const isImg = f.type?.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(f.name.split(".").pop()?.toLowerCase() || "");
            return (
              <div
                key={f.id}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium border animate-in fade-in duration-150 shadow-2xs ${
                  theme === "dark"
                    ? "bg-[#1B2127] border-[#2A333B] text-[#E6EDF2]"
                    : "bg-white border-[#DCE3E8] text-[#12202B]"
                }`}
              >
                {isImg && f.dataUrl ? (
                  <img
                    src={f.dataUrl}
                    alt={f.name}
                    className="w-7 h-7 rounded-md object-cover border border-[#34D3BE]/30 cursor-pointer hover:scale-105 transition shrink-0"
                    onClick={() => f.dataUrl && setLightboxImage({ src: f.dataUrl, title: f.name })}
                  />
                ) : (
                  <FileFormatIcon filename={f.name} fileType={f.type} size="sm" />
                )}
                <span className="truncate max-w-[150px]" title={f.name}>{f.name}</span>
                <span className={`text-[10px] ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                  ({(f.size / 1024).toFixed(0)} KB)
                </span>
                <button
                  type="button"
                  onClick={() => setAttachedFiles((prev) => prev.filter((item) => item.id !== f.id))}
                  className={`p-0.5 rounded hover:text-rose-400 cursor-pointer ${
                    theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* FORM INPUT CONTAINER */}
      <form
        onSubmit={handleSendMessage}
        className={`border rounded-2xl ${isHero ? "p-3.5 sm:p-4 shadow-sm" : "p-2.5 sm:p-3 shadow-xs"} transition-all duration-300 ${
          isRecording
            ? theme === "dark"
              ? "bg-[#1B2127] border-[#34D3BE] ring-2 ring-[#34D3BE]/60 shadow-[0_0_24px_rgba(52,211,190,0.45)] animate-pulse"
              : "bg-white border-[#0F766E] ring-2 ring-[#0F766E]/50 shadow-[0_0_24px_rgba(15,118,110,0.35)] animate-pulse"
            : theme === "dark"
            ? "bg-[#1B2127] border-[#2A333B] focus-within:border-[#34D3BE] focus-within:ring-1 focus-within:ring-[#34D3BE]/30"
            : "bg-white border-[#DCE3E8] focus-within:border-[#0F766E] focus-within:ring-1 focus-within:ring-[#0F766E]/20"
        }`}
      >
        <div className="flex items-end gap-2 sm:gap-3">
          <textarea
            ref={chatTextareaRef as any}
            value={inputQuestion}
            onChange={(e) => {
              setInputQuestion(e.target.value);
              adjustTextareaHeight();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
            placeholder={
              isRecording
                ? "🎙️ Sedang mendengarkan... Kata-kata langsung muncul di sini..."
                : groundingMode === "academic"
                ? isHero
                  ? "Bagaimana saya dapat membantu riset jurnal atau formulasi farmasi Anda hari ini?"
                  : "Ajukan pertanyaan riset jurnal akademik..."
                : isHero
                ? "Bagaimana saya dapat membantu analisis dokumen atau formulasi farmasi Anda hari ini?"
                : "Tanyakan topik farmasi atau analisis dokumen MyLibrary..."
            }
            disabled={isSending}
            className={`w-full bg-transparent ${isHero ? "text-sm sm:text-[15px]" : "text-sm"} focus:outline-none resize-none max-h-[340px] overflow-y-hidden disabled:opacity-50 leading-relaxed px-1.5 scrollbar-thin transition-all duration-75 ${
              theme === "dark"
                ? "text-[#E6EDF2] placeholder-[#9AA9B5]/60"
                : "text-[#12202B] placeholder-[#5B6B78]/60"
            }`}
            style={{ minHeight: isHero ? "56px" : "40px" }}
          />

          <button
            type="submit"
            disabled={isSending || (!inputQuestion.trim() && attachedFiles.length === 0)}
            className={`p-2 rounded-xl transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer shrink-0 mb-0.5 ${
              theme === "dark"
                ? "bg-[#34D3BE] text-[#12161A] hover:bg-[#34D3BE]/90 disabled:bg-[#2A333B] disabled:text-[#9AA9B5]"
                : "bg-[#0F766E] text-white hover:bg-[#0F766E]/90 disabled:bg-[#E2E8F0] disabled:text-[#94A3B8]"
            }`}
            title="Kirim Pesan (Enter)"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* SUB-BARIS KONTROL DI BAWAH TEXTBOX */}
      <div className={`flex items-center justify-between gap-2 ${isHero ? "mt-2.5" : "mt-2"} px-1 select-none`}>
        {/* KIRI: Tombol + Lampiran & Mic */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => chatAttachmentInputRef.current?.click()}
            className={`p-1.5 rounded-lg border transition cursor-pointer flex items-center justify-center ${
              theme === "dark"
                ? "border-[#2A333B] text-[#9AA9B5] hover:text-[#E6EDF2] hover:bg-[#2A333B]"
                : "border-[#DCE3E8] text-[#5B6B78] hover:text-[#12202B] hover:bg-[#F7F9FA]"
            }`}
            title="Lampirkan dokumen atau gambar (+)"
          >
            <Plus className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={toggleVoiceInput}
            className={`p-1.5 rounded-lg transition cursor-pointer border flex items-center justify-center ${
              isRecording
                ? theme === "dark"
                  ? "bg-[#34D3BE] text-[#12161A] border-[#34D3BE] ring-2 ring-[#34D3BE]/60 shadow-[0_0_16px_rgba(52,211,190,0.5)] animate-pulse"
                  : "bg-[#0F766E] text-white border-[#0F766E] ring-2 ring-[#0F766E]/50 shadow-[0_0_16px_rgba(15,118,110,0.4)] animate-pulse"
                : theme === "dark"
                ? "bg-transparent border-[#2A333B] text-[#9AA9B5] hover:text-[#34D3BE] hover:border-[#34D3BE]"
                : "bg-transparent border-[#DCE3E8] text-[#5B6B78] hover:text-[#0F766E] hover:border-[#0F766E]"
            }`}
            title={isRecording ? "Mendengarkan suara... Klik untuk berhenti" : "Gunakan Suara (Voice to Text)"}
          >
            {isRecording ? <MicOff className="w-4 h-4 text-rose-500" /> : <Mic className="w-4 h-4" />}
          </button>
        </div>

        {/* TENGAH: Disclaimer */}
        <span
          className={`text-[11px] truncate text-center max-w-[180px] sm:max-w-none ${
            theme === "dark" ? "text-[#9AA9B5]/75" : "text-[#5B6B78]/80"
          }`}
        >
          Epiona is AI and can make mistakes.
        </span>

        {/* KANAN: Toggle Mode Grounding */}
        <div
          className={`flex items-center p-0.5 rounded-lg border shrink-0 text-xs ${
            theme === "dark" ? "bg-[#12161A] border-[#2A333B]" : "bg-[#F7F9FA] border-[#DCE3E8]"
          }`}
        >
          <button
            type="button"
            onClick={() => setGroundingMode("library")}
            className={`flex items-center gap-1 ${isHero ? "px-2.5 py-1" : "px-2 py-0.5"} rounded-md text-[10.5px] font-semibold transition cursor-pointer ${
              groundingMode === "library"
                ? theme === "dark"
                  ? "bg-[#34D3BE] text-[#12161A] shadow-2xs"
                  : "bg-[#0F766E] text-white shadow-2xs"
                : theme === "dark"
                ? "text-[#9AA9B5] hover:text-[#E6EDF2]"
                : "text-[#5B6B78] hover:text-[#12202B]"
            }`}
            title="Riset terisolasi berbasis koleksi MyLibrary Anda"
          >
            <Library className="w-3 h-3" />
            <span>Library</span>
          </button>
          <button
            type="button"
            onClick={() => setGroundingMode("academic")}
            className={`flex items-center gap-1 ${isHero ? "px-2.5 py-1" : "px-2 py-0.5"} rounded-md text-[10.5px] font-semibold transition cursor-pointer ${
              groundingMode === "academic"
                ? theme === "dark"
                  ? "bg-[#34D3BE] text-[#12161A] shadow-2xs"
                  : "bg-[#0F766E] text-white shadow-2xs"
                : theme === "dark"
                ? "text-[#9AA9B5] hover:text-[#E6EDF2]"
                : "text-[#5B6B78] hover:text-[#12202B]"
            }`}
            title="Riset literatur terbuka (PubMed, arXiv, jurnal farmasi)"
          >
            <Globe className="w-3 h-3" />
            <span>Web</span>
          </button>
        </div>
      </div>
    </div>
  );
};
