import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Zap, Sparkles, Wand2, Award } from "lucide-react";
import { ModelPreference, ModelTierOption } from "@/types";

interface ModelSelectProps {
  modelPreference: ModelPreference;
  onModelChange: (model: ModelPreference) => void;
  isPro?: boolean;
  isAdmin?: boolean;
  onOpenSubscription?: () => void;
  disabled?: boolean;
}

interface OptionConfig {
  id: ModelTierOption;
  label: string;
  description: string;
  mappedModel: ModelPreference;
  technicalName: string;
  requiresPro?: boolean;
  icon: React.FC<{ className?: string }>;
}

export const ModelSelect: React.FC<ModelSelectProps> = ({
  modelPreference,
  onModelChange,
  isPro = false,
  isAdmin = false,
  onOpenSubscription,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<ModelTierOption>(() => {
    return modelPreference === "claude-3-5-sonnet" ? "pro" : "fast";
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const options: OptionConfig[] = [
    {
      id: "auto",
      label: "Otomatis",
      description: "Penyesuaian cerdas sesuai kompleksitas",
      mappedModel: "gemini-2.0-flash",
      technicalName: "Epiona Auto Routing",
      icon: Wand2,
    },
    {
      id: "fast",
      label: "Cepat",
      description: "Respon instan, efisien & cepat",
      mappedModel: "gemini-2.0-flash",
      technicalName: "Google Gemini 2.0 Flash",
      icon: Zap,
    },
    {
      id: "pro",
      label: "Pro",
      description: "Penalaran mendalam & analisis formulasi",
      mappedModel: "claude-3-5-sonnet",
      technicalName: "Anthropic Claude 3.5 Sonnet",
      requiresPro: true,
      icon: Sparkles,
    },
    {
      id: "best",
      label: "Terbaik",
      description: "Akurasi riset & sintesis tingkat lanjut",
      mappedModel: "claude-3-5-sonnet",
      technicalName: "Anthropic Claude 3.5 Sonnet (Extended)",
      requiresPro: true,
      icon: Award,
    },
  ];

  // Sync internal selectedTier if modelPreference changes externally
  useEffect(() => {
    if (modelPreference === "claude-3-5-sonnet" && selectedTier !== "pro" && selectedTier !== "best") {
      setSelectedTier("pro");
    } else if (modelPreference === "gemini-2.0-flash" && selectedTier !== "fast" && selectedTier !== "auto") {
      setSelectedTier("fast");
    }
  }, [modelPreference]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const activeOption = options.find((opt) => opt.id === selectedTier) || options[1];

  const handleSelect = (option: OptionConfig) => {
    if (option.requiresPro && !isPro && !isAdmin) {
      setIsOpen(false);
      if (onOpenSubscription) onOpenSubscription();
      return;
    }
    setSelectedTier(option.id);
    onModelChange(option.mappedModel);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        title={`Model: ${activeOption.technicalName}`}
        className="flex items-center gap-1.5 h-7 px-2.5 rounded-sm bg-surface-2 hover:bg-surface text-text border border-border text-[12px] font-medium transition cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="truncate">{activeOption.label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          className="absolute bottom-full right-0 mb-2 w-[260px] rounded-md bg-surface border border-border shadow-popover p-1.5 z-50 animate-in fade-in duration-150"
          style={{ boxShadow: "0 8px 24px rgba(0,0,0,.12)" }}
        >
          <div className="space-y-0.5">
            {options.map((option) => {
              const isSelected = selectedTier === option.id;
              const OptionIcon = option.icon;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelect(option)}
                  title={option.technicalName}
                  className={`w-full text-left p-2 rounded-sm transition flex items-center justify-between gap-2 cursor-pointer ${
                    isSelected
                      ? "bg-surface-2 text-text font-semibold"
                      : "hover:bg-surface-2 text-text-muted hover:text-text"
                  }`}
                >
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-center gap-1.5">
                      <OptionIcon className="w-3.5 h-3.5 text-text shrink-0" />
                      <span className="text-[13px] text-text font-medium">{option.label}</span>
                      {option.requiresPro && (
                        <span className="text-[10px] font-bold px-1 rounded bg-accent-soft text-accent">
                          PRO
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-text-muted truncate mt-0.5 leading-tight">
                      {option.description}
                    </p>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-accent shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
