"use client";

import React from "react";
import { X } from "lucide-react";

interface UserChatInspectorModalProps {
  theme: "dark" | "light";
  inspectingUser: any | null;
  setInspectingUser: (user: any | null) => void;
  inspectingSessions: any[];
  inspectingActiveSessionId: string | null;
  inspectingMessages: any[];
  isInspectingLoading: boolean;
  handleSelectInspectingSession: (sessionId: string) => void;
}

export function UserChatInspectorModal({
  theme,
  inspectingUser,
  setInspectingUser,
  inspectingSessions,
  inspectingActiveSessionId,
  inspectingMessages,
  isInspectingLoading,
  handleSelectInspectingSession,
}: UserChatInspectorModalProps) {
  if (!inspectingUser) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div
        className={`w-full max-w-5xl h-[88vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden ${
          theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
        }`}
      >
        {/* MODAL HEADER */}
        <div
          className={`p-4 border-b flex items-center justify-between ${
            theme === "dark" ? "border-[#2A333B] bg-[#12161A]" : "border-[#DCE3E8] bg-[#F7F9FA]"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500 text-white font-bold flex items-center justify-center text-sm shadow-xs">
              {inspectingUser.full_name ? inspectingUser.full_name.charAt(0).toUpperCase() : "U"}
            </div>
            <div>
              <h3 className={`text-sm font-bold ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
                Audit Riwayat Percakapan: {inspectingUser.full_name}
              </h3>
              <span className={`text-[11px] font-mono ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                {inspectingUser.email}
              </span>
            </div>
          </div>

          <button
            onClick={() => setInspectingUser(null)}
            className={`p-2 rounded-xl transition cursor-pointer ${
              theme === "dark" ? "text-[#9AA9B5] hover:text-[#E6EDF2] hover:bg-[#2A333B]" : "text-[#5B6B78] hover:text-[#12202B] hover:bg-slate-200"
            }`}
            title="Tutup dialog inspeksi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
          {/* SISI KIRI: DAFTAR SESI */}
          <div
            className={`w-full sm:w-72 border-b sm:border-b-0 sm:border-r flex flex-col overflow-hidden shrink-0 ${
              theme === "dark" ? "border-[#2A333B] bg-[#12161A]/40" : "border-[#DCE3E8] bg-[#F7F9FA]/40"
            }`}
          >
            <div className={`p-3 border-b text-xs font-bold ${theme === "dark" ? "border-[#2A333B]" : "border-[#DCE3E8]"}`}>
              Sesi Obrolan ({inspectingSessions.length})
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
              {isInspectingLoading ? (
                <div className="p-4 text-center text-xs text-slate-500">Memuat sesi...</div>
              ) : inspectingSessions.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">Pengguna belum memiliki sesi obrolan.</div>
              ) : (
                inspectingSessions.map((s) => {
                  const isActive = inspectingActiveSessionId === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSelectInspectingSession(s.id)}
                      className={`p-2.5 rounded-xl text-xs cursor-pointer transition ${
                        isActive
                          ? "bg-rose-500 text-white font-bold shadow-xs"
                          : theme === "dark"
                          ? "text-[#9AA9B5] hover:bg-[#2A333B] hover:text-[#E6EDF2]"
                          : "text-[#5B6B78] hover:bg-slate-100 hover:text-[#12202B]"
                      }`}
                    >
                      <p className="truncate font-semibold">{s.title}</p>
                      <span className="text-[10px] block mt-0.5 opacity-80">
                        {new Date(s.updated_at || s.created_at).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* SISI KANAN: TRANSKRIP PESAN */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div
              className={`p-3 border-b text-xs font-bold flex items-center justify-between ${
                theme === "dark" ? "border-[#2A333B]" : "border-[#DCE3E8]"
              }`}
            >
              <span>Transkrip Obrolan Lengkap</span>
              <span className="text-[11px] font-normal opacity-70">
                {inspectingMessages.length} pesan dalam sesi ini
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scrollbar-thin">
              {inspectingMessages.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Pilih sesi obrolan di sebelah kiri untuk membaca dialog verbatim.
                </div>
              ) : (
                inspectingMessages.map((m) => {
                  const isUser = m.sender === "user";
                  return (
                    <div key={m.id} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                      <span
                        className={`text-[10px] font-bold mb-1 ${
                          isUser ? "text-cyan-500" : "text-rose-500"
                        }`}
                      >
                        {isUser ? `Pertanyaan ${inspectingUser.full_name}` : "Respons EPIONA AI"}
                      </span>

                      <div
                        className={`p-4 rounded-2xl max-w-2xl text-xs leading-relaxed ${
                          isUser
                            ? theme === "dark"
                              ? "bg-[#2A333B] text-[#E6EDF2]"
                              : "bg-teal-50 text-[#12202B] border border-teal-200"
                            : theme === "dark"
                            ? "bg-[#12161A] text-[#E6EDF2] border border-[#2A333B]"
                            : "bg-white text-[#12202B] border border-[#DCE3E8] shadow-xs"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.text}</p>

                        {m.citations && m.citations.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-slate-700/40 text-[10.5px] space-y-1">
                            <span className="font-bold block text-teal-400">Bukti Rujukan Sitasi:</span>
                            {m.citations.map((c: any, cIdx: number) => (
                              <div key={cIdx} className="italic opacity-80">
                                • Hlm {c.page_number} ({c.document_title}): "{c.exact_quote}"
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-[9.5px] opacity-50 mt-1 font-mono">
                        {new Date(m.timestamp).toLocaleTimeString("id-ID")}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
