import React from "react";
import { FileText, BookOpen, Globe, Layers, Pill } from "lucide-react";
import { SourceItem } from "@/types";

interface SourceCardsProps {
  sources: SourceItem[];
  onSelectSource: (source: SourceItem) => void;
  onOpenSourcePanel?: () => void;
}

export const SourceCards: React.FC<SourceCardsProps> = ({
  sources,
  onSelectSource,
  onOpenSourcePanel,
}) => {
  if (!sources || sources.length === 0) return null;

  const MAX_DISPLAY = 4;
  const visibleSources = sources.slice(0, MAX_DISPLAY);
  const remainingCount = sources.length - MAX_DISPLAY;

  const getSourceIcon = (type: string) => {
    switch (type) {
      case "pdf":
        return <FileText className="w-4 h-4 text-ev-jurnal shrink-0 stroke-[1.75]" />;
      case "journal":
        return <BookOpen className="w-4 h-4 text-ev-jurnal shrink-0 stroke-[1.75]" />;
      case "label":
        return <Pill className="w-4 h-4 text-ev-label shrink-0 stroke-[1.75]" />;
      case "web":
      default:
        return <Globe className="w-4 h-4 text-ev-web shrink-0 stroke-[1.75]" />;
    }
  };

  return (
    <div className="w-full mb-3.5 select-none">
      <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
        {visibleSources.map((source, index) => (
          <button
            key={source.id || index}
            type="button"
            onClick={() => onSelectSource(source)}
            className="group flex flex-col justify-between w-[200px] h-[72px] shrink-0 p-2.5 rounded-md border border-border bg-surface hover:border-accent-soft hover:bg-surface-2 transition text-left cursor-pointer"
            title={`${source.title}\n${source.meta}`}
          >
            <div className="flex items-start gap-1.5 min-w-0">
              <div className="mt-0.5">{getSourceIcon(source.type)}</div>
              <p className="text-[13px] leading-[1.25] text-text font-medium line-clamp-2 break-words">
                {source.title}
              </p>
            </div>
            <div className="text-[12px] text-text-muted truncate pl-5">
              {source.meta}
            </div>
          </button>
        ))}

        {remainingCount > 0 && (
          <button
            type="button"
            onClick={onOpenSourcePanel}
            className="flex flex-col items-center justify-center w-[120px] h-[72px] shrink-0 p-2.5 rounded-md border border-border bg-surface-2 hover:border-accent-soft hover:bg-surface text-text-muted hover:text-text transition cursor-pointer text-center"
            title="Lihat seluruh sumber di panel samping"
          >
            <Layers className="w-4 h-4 mb-1 text-accent stroke-[1.75]" />
            <span className="text-[12px] font-semibold text-text">+{remainingCount} lainnya</span>
            <span className="text-[11px] text-text-muted">Buka panel</span>
          </button>
        )}
      </div>
    </div>
  );
};
