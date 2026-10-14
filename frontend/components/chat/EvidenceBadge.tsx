import React from "react";
import { SourceItemType } from "@/types";

interface EvidenceBadgeProps {
  type: SourceItemType | "document";
  label?: string;
  className?: string;
}

export const EvidenceBadge: React.FC<EvidenceBadgeProps> = ({ type, label, className = "" }) => {
  let dotColor = "bg-ev-web";
  let defaultLabel = "Web";

  if (type === "journal") {
    dotColor = "bg-ev-jurnal";
    defaultLabel = "Jurnal";
  } else if (type === "label") {
    dotColor = "bg-ev-label";
    defaultLabel = "Label resmi";
  } else if (type === "pdf" || type === "document") {
    dotColor = "bg-ev-jurnal";
    defaultLabel = "Dokumen";
  }

  const displayLabel = label || defaultLabel;

  return (
    <span
      className={`inline-flex items-center gap-1.5 h-5 px-2 rounded-pill text-[11px] font-semibold bg-surface-2 text-text border border-border select-none shrink-0 ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span>{displayLabel}</span>
    </span>
  );
};
