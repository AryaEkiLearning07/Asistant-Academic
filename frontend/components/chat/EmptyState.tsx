import React from "react";
import { GroundingMode, ModelPreference, AttachedFileItem, UserProfile } from "@/types";
import { Composer } from "./Composer";

interface EmptyStateProps {
  inputQuestion: string;
  setInputQuestion: (val: string) => void;
  isSending: boolean;
  onSend: (text?: string) => void;
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

export const EmptyState: React.FC<EmptyStateProps> = ({
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
  isRecording,
  toggleVoiceInput,
  onPreviewImage,
}) => {
  const suggestionsByMode: Record<GroundingMode, string[]> = {
    auto: [
      "Bagaimana mekanisme kerja amlodipine dan efek samping utamanya?",
      "Jelaskan konsep Volume of Distribution (Vd) dengan analogi mudah",
      "Apakah ada interaksi antara warfarin dan paracetamol?",
      "Rangkum temuan penting dari dokumen yang saya unggah",
    ],
    library: [
      "Rangkum mekanisme kerja obat di dokumen saya",
      "Bandingkan bioavailabilitas sediaan tablet vs sirup",
      "Identifikasi efek samping dan kontraindikasi utama",
      "Cek stabilitas formulasi dan petunjuk penyimpanan",
    ],
    academic: [
      "Uji klinis terbaru efikasi metformin pada PCOS",
      "Meta-analisis keamanan GLP-1 agonis pada ginjal",
      "Sistematik review interaksi statin dan makrolida",
      "Studi farmakokinetik amoksisilin-klavulanat pada geriatri",
    ],
    web: [
      "Regulasi registrasi obat BPOM terkini",
      "Panduan terapi hipertensi terbaru (JNC / ESC)",
      "Ketersediaan obat orphan disease di Asia Tenggara",
      "Update monografi Farmakope Indonesia edisi VI",
    ],
  };

  const suggestions = suggestionsByMode[groundingMode] || suggestionsByMode.library;

  const handleSuggestionClick = (text: string) => {
    setInputQuestion(text);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-[760px] w-full mx-auto px-6 py-10 animate-in fade-in duration-200">
      <h1 className="text-[24px] font-semibold text-text tracking-tight mb-8 text-center">
        Mau belajar apa hari ini?
      </h1>

      <div className="w-full mb-6">
        <Composer
          inputQuestion={inputQuestion}
          setInputQuestion={setInputQuestion}
          isSending={isSending}
          onSend={() => onSend()}
          onStop={onStop}
          groundingMode={groundingMode}
          setGroundingMode={setGroundingMode}
          modelPreference={modelPreference}
          setModelPreference={setModelPreference}
          currentUser={currentUser}
          onOpenSubscription={onOpenSubscription}
          attachedFiles={attachedFiles}
          setAttachedFiles={setAttachedFiles}
          isRecording={isRecording}
          toggleVoiceInput={toggleVoiceInput}
          onPreviewImage={onPreviewImage}
        />
      </div>

      {/* 4 Suggestion Chips sesuai mode (pill, h 32px) */}
      <div className="flex flex-wrap items-center justify-center gap-2 max-w-2xl select-none">
        {suggestions.map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSuggestionClick(item)}
            className="h-8 px-3.5 rounded-pill text-[12px] font-medium bg-surface-2 hover:bg-surface border border-border text-text-muted hover:text-text transition cursor-pointer"
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
};
