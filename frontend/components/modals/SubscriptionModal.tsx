import React, { useState } from "react";
import { Sparkles, Check, Zap, Crown, X, ShieldCheck, ArrowRight } from "lucide-react";
import { UserProfile } from "../../types";

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onSubscriptionSuccess: (newQuota: number, newTier: string) => void;
  apiBase: string;
  theme: "dark" | "light";
}

/**
 * SubscriptionModal - Modal peningkatan paket langganan (Price Anchoring Rp19k/mgg vs Rp49k/bln).
 */
export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSubscriptionSuccess,
  apiBase,
  theme,
}) => {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleActivatePlan(planType: "pro_weekly" | "pro_monthly") {
    if (!currentUser) return;
    setLoadingPlan(planType);
    setErrorMessage(null);
    try {
      const res = await fetch(`${apiBase}/api/v1/subscription/activate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": currentUser.token,
        },
        body: JSON.stringify({ plan_type: planType }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Gagal mengaktifkan paket langganan.");
      }
      const data = await res.json();
      onSubscriptionSuccess(data.added_quota, data.plan_type);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kendala saat memproses langganan.");
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-2xl rounded-3xl border shadow-2xl p-5 sm:p-7 overflow-hidden transition-all ${
          theme === "dark"
            ? "bg-[#161B20] border-[#2A333B] text-[#E6EDF2]"
            : "bg-white border-[#DCE3E8] text-[#12202B]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* CLOSE BUTTON */}
        <button
          type="button"
          onClick={onClose}
          className={`absolute top-4 right-4 p-1.5 rounded-xl border transition cursor-pointer ${
            theme === "dark"
              ? "border-[#2A333B] text-[#9AA9B5] hover:text-white hover:bg-[#2A333B]"
              : "border-[#DCE3E8] text-[#5B6B78] hover:text-[#12202B] hover:bg-[#F7F9FA]"
          }`}
        >
          <X className="w-5 h-5" />
        </button>

        {/* HEADER */}
        <div className="text-center max-w-md mx-auto mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/30 text-orange-400 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Akses Eksklusif Riset Farmasi & Kedokteran</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-2">
            Pilih Paket Epiona Pro
          </h2>
          <p className={`text-xs sm:text-sm ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
            Nikmati penalaran tingkat tinggi Claude 3.5 Sonnet untuk sintesis jurnal, uji klinis, dan telaah formulasi obat.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs text-center font-medium">
            {errorMessage}
          </div>
        )}

        {/* PRICING CARDS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          {/* PAKET 1: PRO MINGGUAN */}
          <div
            className={`rounded-2xl border p-4 sm:p-5 flex flex-col justify-between transition-all ${
              theme === "dark"
                ? "bg-[#1C232A] border-[#2A333B] hover:border-[#34D3BE]/60"
                : "bg-[#F8FAFC] border-[#E2E8F0] hover:border-[#0F766E]/60 shadow-xs"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-500">
                  Mikro Fleksibel
                </span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full border ${theme === "dark" ? "border-[#2A333B] text-[#9AA9B5]" : "border-[#E2E8F0] text-[#64748B]"}`}>
                  7 Hari
                </span>
              </div>
              <h3 className="text-base font-bold mb-1">Pro Mingguan</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-2xl font-black">Rp19.000</span>
                <span className={`text-xs ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#64748B]"}`}>
                  / minggu
                </span>
              </div>
              <ul className="space-y-2.5 text-xs mb-5">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>150 Chat</strong> Claude 3.5 Sonnet</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Unlimited Gemini 2.0 Flash</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Sitasi Resmi PubMed & arXiv</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Split-Screen PDF Reader 1:1</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              disabled={loadingPlan !== null}
              onClick={() => handleActivatePlan("pro_weekly")}
              className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                theme === "dark"
                  ? "bg-[#2A333B] hover:bg-[#34D3BE] text-white hover:text-[#12161A]"
                  : "bg-[#E2E8F0] hover:bg-[#0F766E] text-[#1E293B] hover:text-white"
              }`}
            >
              {loadingPlan === "pro_weekly" ? "Mengaktifkan..." : "Pilih Paket Mingguan"}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* PAKET 2: PRO BULANAN (POPULER) */}
          <div
            className={`rounded-2xl border-2 p-4 sm:p-5 flex flex-col justify-between relative transition-all ${
              theme === "dark"
                ? "bg-[#1F252C] border-orange-500/80 shadow-[0_0_24px_rgba(249,115,22,0.2)]"
                : "bg-white border-orange-500 shadow-md"
            }`}
          >
            {/* POPULAR BADGE */}
            <div className="absolute -top-3 right-4 px-3 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] font-bold tracking-wider uppercase shadow-xs">
              Pilihan Terlaris
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5" /> Hemat 40%
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full border border-orange-500/30 text-orange-400 font-semibold">
                  30 Hari
                </span>
              </div>
              <h3 className="text-base font-bold mb-1">Pro Bulanan</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-2xl font-black text-orange-500">Rp49.000</span>
                <span className={`text-xs ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#64748B]"}`}>
                  / bulan
                </span>
              </div>
              <ul className="space-y-2.5 text-xs mb-5">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-orange-400 shrink-0" />
                  <span><strong>700 Chat</strong> Claude 3.5 Sonnet</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-orange-400 shrink-0" />
                  <span>Unlimited Gemini 2.0 Flash</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-orange-400 shrink-0" />
                  <span>Prioritas Response Tanpa Antre</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-orange-400 shrink-0" />
                  <span>Sitasi KaTeX LaTeX Presisi Tinggi</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              disabled={loadingPlan !== null}
              onClick={() => handleActivatePlan("pro_monthly")}
              className="w-full py-2.5 px-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
            >
              {loadingPlan === "pro_monthly" ? "Mengaktifkan..." : "Aktifkan Pro Bulanan"}
              <Crown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* FOOTER GUARANTEE */}
        <div className={`pt-3 border-t flex items-center justify-center gap-2 text-[11px] ${theme === "dark" ? "border-[#2A333B] text-[#9AA9B5]" : "border-[#E2E8F0] text-[#64748B]"}`}>
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>QRIS Instan Otomatis (GoPay, OVO, ShopeePay, BCA, Mandiri). Tanpa komitmen tahunan.</span>
        </div>
      </div>
    </div>
  );
};
