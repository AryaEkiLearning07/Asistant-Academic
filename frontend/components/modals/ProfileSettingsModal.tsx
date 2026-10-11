import React from "react";
import { User, X, Sun, Moon, LogOut } from "lucide-react";
import { UserProfile, DocumentItem, ChatSessionItem } from "../../types";

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  theme: "dark" | "light";
  toggleTheme: () => void;
  documents: DocumentItem[];
  chatSessions: ChatSessionItem[];
  onLogout: () => void;
}

/**
 * ProfileSettingsModal - Modal dialog profil pengguna, preferensi tema, ringkasan akademik & logout.
 */
export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  theme,
  toggleTheme,
  documents,
  chatSessions,
  onLogout,
}) => {
  if (!isOpen || !currentUser) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`rounded-2xl max-w-md w-full shadow-2xl border overflow-hidden transform scale-100 transition-all font-claude-sans ${
          theme === "dark"
            ? "bg-[#1B2127] border-[#2A333B] text-[#E6EDF2]"
            : "bg-white border-[#DCE3E8] text-[#12202B]"
        }`}
      >
        {/* HEADER MODAL */}
        <div
          className={`p-5 border-b flex items-center justify-between ${
            theme === "dark" ? "border-[#2A333B] bg-[#12161A]/50" : "border-[#DCE3E8] bg-[#F7F9FA]"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                theme === "dark" ? "bg-[#34D3BE]/15 text-[#34D3BE]" : "bg-teal-50 text-[#0F766E]"
              }`}
            >
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold font-claude-serif">Pengaturan Akun</h3>
              <p className={`text-[11px] ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                Kelola profil pengguna &amp; preferensi platform
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              theme === "dark"
                ? "text-[#9AA9B5] hover:text-[#E6EDF2] hover:bg-[#2A333B]"
                : "text-[#5B6B78] hover:text-[#12202B] hover:bg-[#E6EDF2]"
            }`}
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* BODY MODAL */}
        <div className="p-5 space-y-5 text-xs max-h-[80vh] overflow-y-auto">
          {/* KARTU IDENTITAS PENGGUNA */}
          <div
            className={`p-4 rounded-xl border flex items-center gap-3.5 ${
              theme === "dark" ? "bg-[#12161A] border-[#2A333B]" : "bg-[#F8FAFC] border-[#E2E8F0]"
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0F766E] to-[#34D3BE] text-white font-black text-lg flex items-center justify-center shrink-0 shadow-md">
              {currentUser.full_name ? currentUser.full_name.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="flex-1 overflow-hidden">
              <h4 className="font-bold text-sm truncate">{currentUser.full_name}</h4>
              <p className={`text-xs truncate ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#64748B]"}`}>
                {currentUser.email}
              </p>
              <span
                className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  theme === "dark"
                    ? "bg-[#34D3BE]/15 text-[#34D3BE] border-[#34D3BE]/30"
                    : "bg-teal-50 text-[#0F766E] border-teal-200"
                }`}
              >
                {currentUser.role === "admin" ? "Akun Administrator Utama" : "Akun Mahasiswa Farmasi Aktif"}
              </span>
            </div>
          </div>

          {/* SECTION: PREFERENSI TAMPILAN */}
          <div className="space-y-2">
            <label
              className={`text-[11px] font-bold uppercase tracking-wider block ${
                theme === "dark" ? "text-[#9AA9B5]" : "text-[#64748B]"
              }`}
            >
              Tampilan &amp; Tema
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  if (theme !== "light") toggleTheme();
                }}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                  theme === "light"
                    ? "border-[#0F766E] bg-teal-50/50 text-[#0F766E] shadow-2xs"
                    : theme === "dark"
                    ? "border-[#2A333B] bg-[#12161A] text-[#9AA9B5] hover:bg-[#2A333B]"
                    : "border-[#DCE3E8] bg-white text-[#5B6B78]"
                }`}
              >
                <Sun className="w-4 h-4 text-amber-500" />
                <span>Mode Terang</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (theme !== "dark") toggleTheme();
                }}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                  theme === "dark"
                    ? "border-[#34D3BE] bg-[#34D3BE]/15 text-[#34D3BE] shadow-2xs"
                    : "border-[#DCE3E8] bg-white text-[#5B6B78] hover:bg-[#F8FAFC]"
                }`}
              >
                <Moon className="w-4 h-4 text-cyan-400" />
                <span>Mode Gelap</span>
              </button>
            </div>
          </div>

          {/* SECTION: RINGKASAN DATA AKADEMIK */}
          <div className="space-y-2">
            <label
              className={`text-[11px] font-bold uppercase tracking-wider block ${
                theme === "dark" ? "text-[#9AA9B5]" : "text-[#64748B]"
              }`}
            >
              Ringkasan Data Akademik
            </label>
            <div
              className={`p-3 rounded-xl border divide-y ${
                theme === "dark"
                  ? "bg-[#12161A] border-[#2A333B] divide-[#2A333B]"
                  : "bg-[#F8FAFC] border-[#E2E8F0] divide-[#E2E8F0]"
              }`}
            >
              <div className="flex items-center justify-between py-1.5">
                <span className={theme === "dark" ? "text-[#9AA9B5]" : "text-[#64748B]"}>Dokumen MyLibrary</span>
                <span className="font-bold">{documents.length} File PDF</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className={theme === "dark" ? "text-[#9AA9B5]" : "text-[#64748B]"}>Sesi Diskusi Riset</span>
                <span className="font-bold">{chatSessions.length} Percakapan</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className={theme === "dark" ? "text-[#9AA9B5]" : "text-[#64748B]"}>Status API / Gateway</span>
                <span className="font-bold text-teal-600 dark:text-[#34D3BE]">Online (Port 8005)</span>
              </div>
            </div>
          </div>

          {/* SECTION: TOMBOL KELUAR AKUN */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout();
              }}
              className={`w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border font-bold text-xs transition shadow-2xs cursor-pointer ${
                theme === "dark"
                  ? "border-rose-900/60 bg-rose-950/20 text-rose-400 hover:bg-rose-950/40"
                  : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
              }`}
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar dari Akun (Logout)</span>
            </button>
          </div>
        </div>

        {/* FOOTER MODAL */}
        <div
          className={`p-4 border-t flex items-center justify-between text-[11px] ${
            theme === "dark" ? "border-[#2A333B] bg-[#12161A]/50 text-[#9AA9B5]" : "border-[#DCE3E8] bg-[#F8FAFC] text-[#64748B]"
          }`}
        >
          <span>EPIONA Platform v1.1.0</span>
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-1.5 rounded-lg border font-semibold transition cursor-pointer ${
              theme === "dark"
                ? "border-[#2A333B] bg-[#1B2127] text-[#E6EDF2] hover:bg-[#2A333B]"
                : "border-[#CBD5E1] bg-white text-[#12202B] hover:bg-[#F1F5F9]"
            }`}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
