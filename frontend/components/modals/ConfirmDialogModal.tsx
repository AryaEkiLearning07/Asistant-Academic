import React from "react";
import { AlertCircle, CheckCircle2, Trash2 } from "lucide-react";
import { ModalConfirmState, ModalAlertState } from "../../types";

interface ConfirmDialogModalProps {
  confirmModal: ModalConfirmState | null;
  onCancel: () => void;
  theme: "dark" | "light";
}

/**
 * ConfirmDialogModal - Modal dialog konfirmasi terpadu (pengganti window.confirm bawaan browser).
 */
export const ConfirmDialogModal: React.FC<ConfirmDialogModalProps> = ({
  confirmModal,
  onCancel,
  theme,
}) => {
  if (!confirmModal || !confirmModal.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`rounded-2xl max-w-sm w-full p-5 shadow-2xl border transform scale-100 transition-all font-claude-sans ${
          theme === "dark"
            ? "bg-[#1B2127] border-[#2A333B] text-[#E6EDF2]"
            : "bg-white border-[#DCE3E8] text-[#12202B]"
        }`}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              confirmModal.isDestructive
                ? theme === "dark"
                  ? "bg-rose-950/80 text-rose-400 border border-rose-800/60"
                  : "bg-rose-100 text-rose-600"
                : theme === "dark"
                ? "bg-[#34D3BE]/15 text-[#34D3BE] border border-[#34D3BE]/30"
                : "bg-teal-50 text-[#0F766E]"
            }`}
          >
            {confirmModal.isDestructive ? <Trash2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          </div>
          <h3 className={`text-base font-bold font-claude-serif ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
            {confirmModal.title}
          </h3>
        </div>
        <p className={`text-sm leading-relaxed mb-6 ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
          {confirmModal.message}
        </p>
        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition cursor-pointer ${
              theme === "dark"
                ? "text-[#9AA9B5] hover:text-[#E6EDF2] hover:bg-[#2A333B]"
                : "text-[#5B6B78] hover:text-[#12202B] hover:bg-[#F7F9FA]"
            }`}
          >
            {confirmModal.cancelText || "Batal"}
          </button>
          <button
            type="button"
            onClick={() => confirmModal.onConfirm()}
            className={`px-4 py-2 text-xs font-bold text-white rounded-xl transition shadow-xs cursor-pointer ${
              confirmModal.isDestructive
                ? "bg-[#E8684A] hover:bg-[#E8684A]/90"
                : theme === "dark"
                ? "bg-[#34D3BE] text-[#12161A] hover:bg-[#34D3BE]/90"
                : "bg-[#0F766E] text-white hover:bg-[#0F766E]/90"
            }`}
          >
            {confirmModal.confirmText || "Konfirmasi"}
          </button>
        </div>
      </div>
    </div>
  );
};

interface AlertDialogModalProps {
  alertModal: ModalAlertState | null;
  onClose: () => void;
  theme: "dark" | "light";
}

/**
 * AlertDialogModal - Modal alert pemberitahuan (pengganti window.alert bawaan browser).
 */
export const AlertDialogModal: React.FC<AlertDialogModalProps> = ({
  alertModal,
  onClose,
  theme,
}) => {
  if (!alertModal || !alertModal.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`rounded-2xl max-w-sm w-full p-5 shadow-2xl border transform scale-100 transition-all font-claude-sans ${
          theme === "dark"
            ? "bg-[#1B2127] border-[#2A333B] text-[#E6EDF2]"
            : "bg-white border-[#DCE3E8] text-[#12202B]"
        }`}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              alertModal.type === "error"
                ? theme === "dark"
                  ? "bg-rose-950/80 text-rose-400 border border-rose-800/60"
                  : "bg-rose-100 text-rose-600"
                : alertModal.type === "warning"
                ? theme === "dark"
                  ? "bg-amber-950/80 text-amber-400 border border-amber-800/60"
                  : "bg-amber-100 text-amber-600"
                : theme === "dark"
                ? "bg-[#34D3BE]/15 text-[#34D3BE] border border-[#34D3BE]/30"
                : "bg-teal-50 text-[#0F766E]"
            }`}
          >
            {alertModal.type === "error" ? (
              <AlertCircle className="w-5 h-5" />
            ) : alertModal.type === "warning" ? (
              <AlertCircle className="w-5 h-5" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
          </div>
          <h3 className={`text-base font-bold font-claude-serif ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
            {alertModal.title}
          </h3>
        </div>
        <p className={`text-sm leading-relaxed mb-6 ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
          {alertModal.message}
        </p>
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className={`px-5 py-2 text-xs font-bold rounded-xl transition shadow-xs cursor-pointer ${
              theme === "dark"
                ? "bg-[#34D3BE] text-[#12161A] hover:bg-[#34D3BE]/90"
                : "bg-[#0F766E] text-white hover:bg-[#0F766E]/90"
            }`}
          >
            Mengerti
          </button>
        </div>
      </div>
    </div>
  );
};
