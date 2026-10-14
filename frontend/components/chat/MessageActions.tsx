import React, { useState } from "react";
import { Copy, Check, RotateCcw, ThumbsUp, ThumbsDown, Layers } from "lucide-react";

interface MessageActionsProps {
  messageText: string;
  isLastMessage?: boolean;
  onRegenerate?: () => void;
  onOpenSources?: () => void;
  hasSources?: boolean;
  onFeedback?: (type: "like" | "dislike") => void;
  currentFeedback?: "like" | "dislike" | null;
}

export const MessageActions: React.FC<MessageActionsProps> = ({
  messageText,
  isLastMessage = false,
  onRegenerate,
  onOpenSources,
  hasSources = false,
  onFeedback,
  currentFeedback = null,
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const [feedback, setFeedback] = useState<"like" | "dislike" | null>(currentFeedback);

  const handleCopy = async () => {
    if (!messageText) return;
    try {
      await navigator.clipboard.writeText(messageText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Gagal menyalin pesan:", err);
    }
  };

  const handleThumb = (type: "like" | "dislike") => {
    const nextVal = feedback === type ? null : type;
    setFeedback(nextVal);
    if (onFeedback && nextVal) {
      onFeedback(nextVal);
    }
  };

  return (
    <div
      className={`flex items-center gap-1 mt-2.5 pt-1 text-text-muted select-none ${
        isLastMessage ? "opacity-100" : "opacity-0 group-hover:opacity-100 transition-opacity duration-150"
      }`}
    >
      {/* Salin */}
      <button
        type="button"
        onClick={handleCopy}
        disabled={!messageText}
        className="p-1.5 rounded-sm hover:text-text hover:bg-surface-2 transition cursor-pointer disabled:opacity-40"
        title={isCopied ? "Tersalin!" : "Salin jawaban"}
        aria-label="Salin jawaban"
      >
        {isCopied ? (
          <Check className="w-4 h-4 text-accent stroke-[2]" />
        ) : (
          <Copy className="w-4 h-4 stroke-[1.75]" />
        )}
      </button>

      {/* Regenerasi */}
      {onRegenerate && (
        <button
          type="button"
          onClick={onRegenerate}
          className="p-1.5 rounded-sm hover:text-text hover:bg-surface-2 transition cursor-pointer"
          title="Regenerasi jawaban ini"
          aria-label="Regenerasi jawaban"
        >
          <RotateCcw className="w-4 h-4 stroke-[1.75]" />
        </button>
      )}

      {/* Feedback 👍 */}
      <button
        type="button"
        onClick={() => handleThumb("like")}
        className={`p-1.5 rounded-sm hover:text-text hover:bg-surface-2 transition cursor-pointer ${
          feedback === "like" ? "text-accent bg-surface-2" : ""
        }`}
        title="Bermanfaat"
        aria-label="Bermanfaat"
      >
        <ThumbsUp className={`w-4 h-4 stroke-[1.75] ${feedback === "like" ? "fill-current" : ""}`} />
      </button>

      {/* Feedback 👎 */}
      <button
        type="button"
        onClick={() => handleThumb("dislike")}
        className={`p-1.5 rounded-sm hover:text-text hover:bg-surface-2 transition cursor-pointer ${
          feedback === "dislike" ? "text-danger bg-surface-2" : ""
        }`}
        title="Kurang membantu"
        aria-label="Kurang membantu"
      >
        <ThumbsDown className={`w-4 h-4 stroke-[1.75] ${feedback === "dislike" ? "fill-current" : ""}`} />
      </button>

      {/* Sumber (jika ada) */}
      {hasSources && onOpenSources && (
        <button
          type="button"
          onClick={onOpenSources}
          className="flex items-center gap-1 px-2 py-1 rounded-sm text-[12px] font-medium hover:text-text hover:bg-surface-2 transition cursor-pointer ml-1"
          title="Buka panel sumber referensi"
          aria-label="Buka panel sumber"
        >
          <Layers className="w-3.5 h-3.5 stroke-[1.75]" />
          <span>Sumber</span>
        </button>
      )}
    </div>
  );
};
