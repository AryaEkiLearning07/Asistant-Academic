import React from "react";
import { Library, GraduationCap, Globe } from "lucide-react";
import { GroundingMode } from "@/types";

interface ModeSegmentedProps {
  value: GroundingMode;
  onChange: (mode: GroundingMode) => void;
  disabled?: boolean;
}

export const ModeSegmented: React.FC<ModeSegmentedProps> = ({ value, onChange, disabled = false }) => {
  const options: { mode: GroundingMode; label: string; icon: React.FC<{ className?: string }> }[] = [
    { mode: "library", label: "Library", icon: Library },
    { mode: "academic", label: "Akademik", icon: GraduationCap },
    { mode: "web", label: "Web", icon: Globe },
  ];

  return (
    <div
      role="group"
      aria-label="Pilihan Grounding Mode"
      className="inline-flex items-center h-7 p-0.5 rounded-lg bg-surface-2 border border-border select-none"
    >
      {options.map(({ mode, label, icon: Icon }) => {
        const isActive = value === mode;
        return (
          <button
            key={mode}
            type="button"
            disabled={disabled}
            onClick={() => onChange(mode)}
            className={`flex items-center gap-1.5 h-6 px-2.5 rounded-sm text-[12px] font-medium transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              isActive
                ? "bg-surface text-text border border-border shadow-xs font-semibold"
                : "text-text-muted hover:text-text"
            }`}
            title={`Mode riset: ${label}`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
};
