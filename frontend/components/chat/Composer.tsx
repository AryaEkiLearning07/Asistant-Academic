import React, { useRef, useEffect } from "react";
import { Plus, Mic, MicOff, ArrowUp, Square, X } from "lucide-react";
import { GroundingMode, ModelPreference, AttachedFileItem, UserProfile } from "@/types";
import { ModeSegmented } from "./ModeSegmented";
import { ModelSelect } from "./ModelSelect";
import { FileFormatIcon } from "../library/FileFormatIcon";

interface ComposerProps {
  inputQuestion: string;
  setInputQuestion: (val: string) => void;
  isSending: boolean;
  onSend: (e?: React.FormEvent) => void;
  onStop?: () => void;
  groundingMode: GroundingMode;
  setGroundingMode: (m: GroundingMode) => void;
  modelPreference: ModelPreference;
  setModelPreference: (m: ModelPreference) => void;
  currentUser?: UserProfile | null;
  onOpenSubscription?: () => void;
  attachedFiles: AttachedFileItem[];
  setAttachedFiles: React.Dispatch<React.SetStateAction<AttachedFileItem[]>>;
  isRecording?: boolean;
  toggleVoiceInput?: () => void;
  onPreviewImage?: (img: { src: string; title: string }) => void;
}

export const Composer: React.FC<ComposerProps> = ({
  inputQuestion,
  setInputQuestion,
  isSending,
  onSend,
  onStop,
  groundingMode,
  setGroundingMode,
  modelPreference,
  setModelPreference,
  currentUser,
  onOpenSubscription,
  attachedFiles,
  setAttachedFiles,
  isRecording = false,
  toggleVoiceInput,
  onPreviewImage,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-grow textarea between 56px and 240px
  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const nextH = Math.min(Math.max(el.scrollHeight, 56), 240);
    el.style.height = `${nextH}px`;
    el.style.overflowY = el.scrollHeight > 240 ? "auto" : "hidden";
  };

  useEffect(() => {
    adjustHeight();
  }, [inputQuestion]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isSending && (inputQuestion.trim() || attachedFiles.length > 0)) {
        onSend();
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const isImg = file.type.startsWith("image/");
      const reader = new FileReader();

      reader.onload = () => {
        const dataUrl = reader.result as string;
        setAttachedFiles((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: file.name,
            size: file.size,
            type: file.type || "application/octet-stream",
            dataUrl: isImg ? dataUrl : undefined,
            base64: dataUrl.includes(";base64,") ? dataUrl.split(";base64,")[1] : undefined,
          },
        ]);
      };

      if (isImg) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsDataURL(file);
      }
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const placeholders: Record<GroundingMode, string> = {
    library: "Tanya dokumen MyLibrary…",
    academic: "Cari jurnal PubMed/arXiv…",
    web: "Cari di web…",
  };

  const isCanSend = Boolean(inputQuestion.trim() || attachedFiles.length > 0);
  const isAdmin = currentUser?.role === "admin";
  const isPro = isAdmin || (currentUser?.tier && currentUser.tier !== "free");

  return (
    <div className="w-full">
      {/* File attachments list */}
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 px-1">
          {attachedFiles.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-2 px-2.5 py-1 rounded-md text-[12px] bg-surface-2 border border-border text-text select-none"
            >
              {f.dataUrl ? (
                <img
                  src={f.dataUrl}
                  alt={f.name}
                  className="w-5 h-5 rounded-xs object-cover cursor-pointer"
                  onClick={() => onPreviewImage && onPreviewImage({ src: f.dataUrl!, title: f.name })}
                />
              ) : (
                <FileFormatIcon filename={f.name} fileType={f.type} size="sm" />
              )}
              <span className="truncate max-w-[140px]" title={f.name}>
                {f.name}
              </span>
              <button
                type="button"
                onClick={() => setAttachedFiles((prev) => prev.filter((item) => item.id !== f.id))}
                className="text-text-muted hover:text-danger p-0.5 cursor-pointer"
                title="Hapus lampiran"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Composer Box */}
      <div
        className="w-full rounded-lg border border-border bg-surface transition-all focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20"
      >
        <textarea
          ref={textareaRef}
          value={inputQuestion}
          onChange={(e) => setInputQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? "Sedang mendengarkan ucapan Anda…" : placeholders[groundingMode]}
          disabled={isSending}
          rows={1}
          className="w-full px-4 pt-3 pb-2 text-[14px] leading-[1.5] bg-transparent text-text placeholder:text-text-muted outline-none resize-none min-h-[56px] max-h-[240px]"
        />

        {/* Baris Bawah 36px */}
        <div className="h-9 px-3 pb-2 flex items-center justify-between gap-2 border-t border-transparent select-none">
          {/* Kiri: [+ lampiran][mic] */}
          <div className="flex items-center gap-1.5">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              multiple
              className="hidden"
            />
            <button
              type="button"
              disabled={isSending}
              onClick={() => fileInputRef.current?.click()}
              className="w-7 h-7 flex items-center justify-center rounded-sm text-text-muted hover:text-text hover:bg-surface-2 transition cursor-pointer disabled:opacity-50"
              title="Tambah lampiran file atau gambar"
              aria-label="Tambah lampiran"
            >
              <Plus className="w-4 h-4 stroke-[1.75]" />
            </button>

            {toggleVoiceInput && (
              <button
                type="button"
                disabled={isSending}
                onClick={toggleVoiceInput}
                className={`w-7 h-7 flex items-center justify-center rounded-sm transition cursor-pointer disabled:opacity-50 ${
                  isRecording
                    ? "text-danger bg-surface-2"
                    : "text-text-muted hover:text-text hover:bg-surface-2"
                }`}
                title={isRecording ? "Hentikan perekaman suara" : "Dikte suara (Voice)"}
                aria-label="Dikte suara"
              >
                {isRecording ? <MicOff className="w-4 h-4 stroke-[1.75]" /> : <Mic className="w-4 h-4 stroke-[1.75]" />}
              </button>
            )}
          </div>

          {/* Kanan: [Mode segmented][Model dropdown][Kirim 32x32] */}
          <div className="flex items-center gap-2">
            <ModeSegmented
              value={groundingMode}
              onChange={setGroundingMode}
              disabled={isSending}
            />

            <ModelSelect
              modelPreference={modelPreference}
              onModelChange={setModelPreference}
              isPro={isPro}
              isAdmin={isAdmin}
              onOpenSubscription={onOpenSubscription}
              disabled={isSending}
            />

            {/* Kirim Button 32x32 */}
            {isSending ? (
              <button
                type="button"
                onClick={onStop}
                className="w-8 h-8 rounded-sm bg-text text-surface flex items-center justify-center transition cursor-pointer hover:opacity-90 shrink-0"
                title="Hentikan respon"
                aria-label="Hentikan respon"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                disabled={!isCanSend}
                onClick={() => onSend()}
                className={`w-8 h-8 rounded-sm flex items-center justify-center transition shrink-0 ${
                  isCanSend
                    ? "bg-accent text-white hover:bg-accent/90 cursor-pointer"
                    : "bg-surface-2 text-text-muted cursor-not-allowed opacity-60"
                }`}
                title="Kirim pesan (Enter)"
                aria-label="Kirim pesan"
              >
                <ArrowUp className="w-4 h-4 stroke-[2]" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
