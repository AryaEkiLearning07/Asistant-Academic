import React, { useState, useRef } from "react";
import { SourceItem } from "@/types";
import { EvidenceBadge } from "./EvidenceBadge";

interface CitationChipProps {
  index: number;
  source?: SourceItem;
  onClick?: () => void;
}

export const CitationChip: React.FC<CitationChipProps> = ({ index, source, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 150);
  };

  return (
    <span
      className="relative inline-block align-baseline mx-0.5 select-none"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center justify-center h-[18px] min-w-[18px] px-1 rounded-sm text-[11px] font-semibold bg-surface-2 hover:bg-accent-soft hover:text-accent border border-border text-text transition cursor-pointer -translate-y-1"
        title={source ? `${source.title} (${source.meta})` : `Sumber [${index}]`}
        aria-label={`Lihat sitasi ${index}`}
      >
        {index}
      </button>

      {/* Popover Preview (320px) */}
      {isHovered && source && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[320px] p-3 rounded-md bg-surface border border-border shadow-popover z-50 animate-in fade-in zoom-in-95 duration-150 pointer-events-none"
          style={{ boxShadow: "0 8px 24px rgba(0,0,0,.12)" }}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <EvidenceBadge type={source.type} />
            <span className="text-[11px] text-text-muted truncate max-w-[180px]">
              {source.meta}
            </span>
          </div>

          <h4 className="text-[12px] font-semibold text-text leading-tight line-clamp-2 mb-1.5">
            {source.title}
          </h4>

          {source.snippet && (
            <p className="text-[11px] text-text-muted leading-relaxed line-clamp-3 italic border-l-2 border-accent pl-2 mt-1">
              "{source.snippet}"
            </p>
          )}

          <div className="mt-2 pt-1 border-t border-border flex items-center justify-between text-[10px] text-text-muted">
            <span>Klik untuk membuka detail sumber</span>
            <span className="text-accent font-medium">Buka panel &rarr;</span>
          </div>
        </div>
      )}
    </span>
  );
};
