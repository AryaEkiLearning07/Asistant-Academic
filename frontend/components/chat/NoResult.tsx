import React from "react";
import { SearchX, GraduationCap, Globe, Upload } from "lucide-react";
import { GroundingMode } from "@/types";

interface NoResultProps {
  currentMode: GroundingMode;
  onSwitchModeAndRetry?: (mode: GroundingMode) => void;
  onUploadDocument?: () => void;
  customMessage?: string;
}

export const NoResult: React.FC<NoResultProps> = ({
  currentMode,
  onSwitchModeAndRetry,
  onUploadDocument,
  customMessage,
}) => {
  const defaultMsg =
    currentMode === "library"
      ? "Tidak ditemukan rujukan yang cocok pada koleksi MyLibrary Anda."
      : currentMode === "academic"
      ? "Tidak ditemukan jurnal atau literatur PubMed yang cocok dengan kata kunci ini."
      : "Tidak ditemukan informasi relevan di pencarian web.";

  return (
    <div className="my-3 p-3.5 rounded-md border border-border bg-surface-2 text-text max-w-lg">
      <div className="flex items-start gap-3">
        <div className="p-1.5 rounded-sm bg-surface border border-border text-text-muted shrink-0 mt-0.5">
          <SearchX className="w-4 h-4 stroke-[1.75]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-text font-medium leading-snug">
            {customMessage || defaultMsg}
          </p>

          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            {currentMode !== "academic" && onSwitchModeAndRetry && (
              <button
                type="button"
                onClick={() => onSwitchModeAndRetry("academic")}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[12px] font-medium bg-surface hover:bg-surface-2 text-text border border-border transition cursor-pointer"
              >
                <GraduationCap className="w-3.5 h-3.5 text-accent stroke-[1.75]" />
                <span>Cari di Akademik</span>
              </button>
            )}

            {currentMode !== "web" && onSwitchModeAndRetry && (
              <button
                type="button"
                onClick={() => onSwitchModeAndRetry("web")}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[12px] font-medium bg-surface hover:bg-surface-2 text-text border border-border transition cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 text-accent stroke-[1.75]" />
                <span>Cari di Web</span>
              </button>
            )}

            {onUploadDocument && (
              <button
                type="button"
                onClick={onUploadDocument}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[12px] font-medium bg-surface hover:bg-surface-2 text-text border border-border transition cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-text-muted stroke-[1.75]" />
                <span>Unggah dokumen</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
