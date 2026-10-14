import React, { useState } from "react";
import { Loader2, Check, ChevronDown, ChevronRight } from "lucide-react";
import { SearchProgressStep } from "@/types";

interface SearchProgressProps {
  steps: SearchProgressStep[];
  isFinished?: boolean;
}

export const SearchProgress: React.FC<SearchProgressProps> = ({ steps, isFinished = false }) => {
  const [isExpanded, setIsExpanded] = useState(!isFinished);

  if (!steps || steps.length === 0) return null;

  const completedCount = steps.filter((s) => s.status === "done").length;
  const currentStep = steps.find((s) => s.status === "running") || steps[steps.length - 1];

  return (
    <div className="w-full mb-3 text-[14px] leading-snug">
      {isFinished ? (
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1.5 text-text-muted hover:text-text text-[13px] font-medium transition cursor-pointer select-none py-1"
          >
            <Check className="w-3.5 h-3.5 text-accent shrink-0 stroke-[2]" />
            <span>Selesai menganalisis {completedCount} langkah pencarian</span>
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            )}
          </button>

          {isExpanded && (
            <div className="pl-5 pt-1 pb-1 space-y-1.5 border-l border-border mt-1">
              {steps.map((step, idx) => (
                <div key={idx} className="flex items-center gap-2 text-[13px] text-text-muted">
                  <Check className="w-3.5 h-3.5 text-accent shrink-0 stroke-[2]" />
                  <span>{step.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-1.5 py-1">
          {steps.map((step, idx) => {
            const isDone = step.status === "done";
            const isRunning = step.status === "running";
            return (
              <div
                key={idx}
                className={`flex items-center gap-2 text-[14px] ${
                  isRunning ? "text-text font-medium" : isDone ? "text-text-muted" : "text-text-muted/60"
                }`}
              >
                {isDone ? (
                  <Check className="w-3.5 h-3.5 text-accent shrink-0 stroke-[2]" />
                ) : isRunning ? (
                  <Loader2 className="w-3.5 h-3.5 text-accent animate-spin shrink-0 stroke-[2]" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-border shrink-0" />
                )}
                <span>{step.text}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
