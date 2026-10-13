import React from "react";
import { Send, Plus, Mic, MicOff, X, Library, Globe, Zap, Sparkles, Crown, ChevronDown, Check, Lock } from "lucide-react";
import { AttachedFileItem, ModelPreference, UserProfile } from "../../types";
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
  modelPreference: ModelPreference;
  setModelPreference: (m: ModelPreference) => void;
  currentUser?: UserProfile | null;
  onOpenSubscriptionModal?: () => void;
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
  modelPreference,
  setModelPreference,
  currentUser,
  onOpenSubscriptionModal,
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
  const [isModelDropdownOpen, setIsModelDropdownOpen] = React.useState(false);
  const modelDropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const isAdmin = currentUser?.role === "admin";
  const isPro = isAdmin || (currentUser?.tier && currentUser.tier !== "free" && (currentUser?.claude_quota_left || 0) > 0);
  const claudeQuotaLeft = currentUser?.claude_quota_left || 0;

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

          {/* KANAN BAWAH TEXTAREA: MODEL SELECTOR DROPDOWN & SEND BUTTON */}
          <div className="flex items-center gap-1.5 shrink-0 mb-0.5">
            {/* MODEL SELECTOR DROPDOWN TRIGGER (ALA CLAUDE / PERPLEXITY) */}
            <div className="relative" ref={modelDropdownRef}>
              <button
                type="button"
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer select-none ${
                  modelPreference === "claude-3-5-sonnet"
                    ? theme === "dark"
                      ? "bg-[#251E19] border-orange-500/50 text-orange-300 hover:border-orange-500/80 shadow-2xs"
                      : "bg-orange-50 border-orange-200 text-orange-800 hover:border-orange-300 shadow-2xs"
                    : theme === "dark"
                    ? "bg-[#161C22] border-[#2A333B] text-[#E6EDF2] hover:border-[#34D3BE]/50 hover:text-[#34D3BE]"
                    : "bg-[#F7F9FA] border-[#DCE3E8] text-[#12202B] hover:border-[#0F766E]/50 hover:text-[#0F766E]"
                }`}
                title="Pilih Model AI (Claude 3.5 Sonnet / Gemini 2.0 Flash)"
              >
                {modelPreference === "claude-3-5-sonnet" ? (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    <span className="font-semibold text-[11px] sm:text-xs tracking-tight">Claude 3.5 Sonnet</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="font-semibold text-[11px] sm:text-xs tracking-tight">Gemini 2.0 Flash</span>
                  </>
                )}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 opacity-60 ${isModelDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {/* POPOVER MENU ALA CLAUDE / PERPLEXITY */}
              {isModelDropdownOpen && (
                <div
                  className={`absolute bottom-full right-0 mb-2.5 w-76 sm:w-84 rounded-2xl p-2.5 shadow-2xl border z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md ${
                    theme === "dark"
                      ? "bg-[#161B21]/98 border-[#2A333B] text-[#E6EDF2] shadow-[0_16px_48px_rgba(0,0,0,0.7)]"
                      : "bg-white/98 border-[#DCE3E8] text-[#12202B] shadow-[0_16px_48px_rgba(0,0,0,0.15)]"
                  }`}
                >
                  <div className={`px-2 py-1 mb-1.5 flex items-center justify-between border-b pb-1.5 ${
                    theme === "dark" ? "border-[#2A333B]" : "border-[#E2E8F0]"
                  }`}>
                    <span className="text-[10px] font-bold tracking-wider uppercase text-gray-400">PILIH MODEL AI</span>
                    <span className="text-[10px] text-gray-400 font-medium">Epiona Intelligence</span>
                  </div>

                  {/* OPSI 1: GEMINI 2.0 FLASH (DEFAULT & FREE) */}
                  <button
                    type="button"
                    onClick={() => {
                      setModelPreference("gemini-2.0-flash");
                      setIsModelDropdownOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl transition cursor-pointer flex items-start gap-2.5 mb-1.5 ${
                      modelPreference === "gemini-2.0-flash"
                        ? theme === "dark"
                          ? "bg-[#1E252D] ring-1 ring-[#34D3BE]/50"
                          : "bg-teal-50/80 ring-1 ring-[#0F766E]/40"
                        : theme === "dark"
                        ? "hover:bg-[#1E252D]/60"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400 shrink-0 mt-0.5">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold truncate">Gemini 2.0 Flash</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-extrabold bg-teal-500/20 text-teal-400">
                          DEFAULT
                        </span>
                        <span className="text-[9px] px-1 py-0.2 rounded font-semibold bg-gray-500/20 text-gray-400">
                          GRATIS
                        </span>
                      </div>
                      <p className={`text-[11px] leading-snug mt-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                        Model generasi baru Google. Respon ultra-cepat, multimodal, dan efisien untuk riset harian.
                      </p>
                    </div>
                    {modelPreference === "gemini-2.0-flash" && (
                      <Check className="w-4 h-4 text-[#34D3BE] shrink-0 mt-1" />
                    )}
                  </button>

                  {/* OPSI 2: CLAUDE 3.5 SONNET (LATEST & PRO) */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!isPro && !isAdmin) {
                        setIsModelDropdownOpen(false);
                        if (onOpenSubscriptionModal) onOpenSubscriptionModal();
                        return;
                      }
                      setModelPreference("claude-3-5-sonnet");
                      setIsModelDropdownOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl transition cursor-pointer flex items-start gap-2.5 ${
                      modelPreference === "claude-3-5-sonnet"
                        ? theme === "dark"
                          ? "bg-[#27211C] ring-1 ring-orange-500/50"
                          : "bg-orange-50/80 ring-1 ring-orange-400/40"
                        : theme === "dark"
                        ? "hover:bg-[#27211C]/60"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="p-1.5 rounded-lg bg-orange-500/15 text-orange-400 shrink-0 mt-0.5">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold truncate">Claude 3.5 Sonnet</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-extrabold bg-orange-500/25 text-orange-400 flex items-center gap-0.5">
                          <Crown className="w-2.5 h-2.5" /> PRO
                        </span>
                        {isAdmin ? (
                          <span className="text-[9px] px-1 py-0.2 rounded font-bold bg-amber-500/25 text-amber-300">
                            Admin
                          </span>
                        ) : claudeQuotaLeft > 0 ? (
                          <span className="text-[9px] px-1 py-0.2 rounded font-bold bg-orange-500/20 text-orange-300">
                            {claudeQuotaLeft} Kuota
                          </span>
                        ) : null}
                      </div>
                      <p className={`text-[11px] leading-snug mt-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                        Model tercanggih Anthropic untuk riset mendalam, penalaran akademik, dan formulasi ilmiah.
                      </p>
                    </div>
                    {modelPreference === "claude-3-5-sonnet" ? (
                      <Check className="w-4 h-4 text-orange-400 shrink-0 mt-1" />
                    ) : !isPro && !isAdmin ? (
                      <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-1" />
                    ) : null}
                  </button>
                </div>
              )}
            </div>

            {/* TOMBOL SEND */}
            <button
              type="submit"
              disabled={isSending || (!inputQuestion.trim() && attachedFiles.length === 0)}
              className={`p-2 rounded-xl transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer shrink-0 ${
                theme === "dark"
                  ? "bg-[#34D3BE] text-[#12161A] hover:bg-[#34D3BE]/90 disabled:bg-[#2A333B] disabled:text-[#9AA9B5]"
                  : "bg-[#0F766E] text-white hover:bg-[#0F766E]/90 disabled:bg-[#E2E8F0] disabled:text-[#94A3B8]"
              }`}
              title="Kirim Pesan (Enter)"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
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
          className={`text-[11px] truncate text-center hidden md:inline ${
            theme === "dark" ? "text-[#9AA9B5]/75" : "text-[#5B6B78]/80"
          }`}
        >
          Epiona is AI and can make mistakes.
        </span>

        {/* KANAN: Grounding Mode Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div
            className={`flex items-center p-0.5 rounded-lg border text-xs ${
              theme === "dark" ? "bg-[#12161A] border-[#2A333B]" : "bg-[#F7F9FA] border-[#DCE3E8]"
            }`}
          >
            <button
              type="button"
              onClick={() => setGroundingMode("library")}
              className={`flex items-center gap-1 ${isHero ? "px-2 sm:px-2.5 py-1" : "px-1.5 sm:px-2 py-0.5"} rounded-md text-[10.5px] font-semibold transition cursor-pointer ${
                groundingMode === "library"
                  ? theme === "dark"
                    ? "bg-[#34D3BE] text-[#12161A] shadow-2xs font-bold"
                    : "bg-[#0F766E] text-white shadow-2xs font-bold"
                  : theme === "dark"
                  ? "text-[#9AA9B5] hover:text-[#E6EDF2]"
                  : "text-[#5B6B78] hover:text-[#12202B]"
              }`}
              title="Riset terisolasi berbasis koleksi MyLibrary Anda"
            >
              <Library className="w-3 h-3 shrink-0" />
              <span>Library</span>
            </button>
            <button
              type="button"
              onClick={() => setGroundingMode("academic")}
              className={`flex items-center gap-1 ${isHero ? "px-2 sm:px-2.5 py-1" : "px-1.5 sm:px-2 py-0.5"} rounded-md text-[10.5px] font-semibold transition cursor-pointer ${
                groundingMode === "academic"
                  ? theme === "dark"
                    ? "bg-[#34D3BE] text-[#12161A] shadow-2xs font-bold"
                    : "bg-[#0F766E] text-white shadow-2xs font-bold"
                  : theme === "dark"
                  ? "text-[#9AA9B5] hover:text-[#E6EDF2]"
                  : "text-[#5B6B78] hover:text-[#12202B]"
              }`}
              title="Riset literatur terbuka (PubMed, arXiv, jurnal farmasi)"
            >
              <Globe className="w-3 h-3 shrink-0" />
              <span>Web</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
