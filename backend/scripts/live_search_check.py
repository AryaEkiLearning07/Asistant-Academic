#!/usr/bin/env python3
"""
Live Search Diagnostic & Quality Check Script (P3-1b)
Menjalankan 5 kueri farmasi nyata terhadap provider pencarian akademik (mode academic),
mencetak top 5 hasil per kueri, level bukti EBM, verifikasi entitas kunci, serta status/galat provider.
"""

import asyncio
import logging
import sys
import time
from pathlib import Path
from typing import List, Dict, Any

# Pastikan backend/ ada di sys.path
CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Konfigurasi logging handler untuk menangkap pesan error provider
provider_errors: List[str] = []

class ErrorCaptureHandler(logging.Handler):
    def emit(self, record):
        if record.levelno >= logging.WARNING:
            msg = self.format(record)
            if any(p in msg.lower() for p in ["pubmed", "semantic", "europepmc", "openfda", "tavily", "429"]):
                provider_errors.append(msg)

from app.search.orchestrator import SearchOrchestrator
from app.search.router import SearchRouter
from app.search.models import SearchResult

TEST_QUERIES = [
    "interaksi warfarin dengan aspirin risiko perdarahan",
    "efek samping amlodipine pada lansia",
    "dosis metformin untuk pasien diabetes melitus tipe 2 dengan gangguan fungsi ginjal",
    "efektivitas dan keamanan atorvastatin versus rosuvastatin",
    "kontraindikasi ciprofloxacin pada kehamilan dan menyusui",
]

async def check_query(orchestrator: SearchOrchestrator, idx: int, query: str) -> Dict[str, Any]:
    global provider_errors
    provider_errors.clear()

    print("\n" + "=" * 80)
    print(f"[{idx}/5] KUERI NYATA: \"{query}\"")
    print("=" * 80)

    # 1. Ekstraksi Entitas & Rewriting
    detected_drugs = SearchRouter.extract_drug_entities(query)
    rewritten = SearchRouter.rewrite_queries(query)
    print(f"[*] Entitas Obat Terdeteksi : {detected_drugs}")
    print(f"[*] Kueri Hasil Rewrite     :")
    for i, rq in enumerate(rewritten, 1):
        print(f"    {i}. {rq}")

    t0 = time.time()
    results: List[SearchResult] = []
    try:
        results = await orchestrator.search(query, mode="academic", force_refresh=True)
    except Exception as e:
        print(f"[!] Exception saat eksekusi: {e}")
    duration = time.time() - t0

    print(f"\n[*] Total Hasil Ditemukan   : {len(results)} naskah/label ({duration:.2f} detik)")

    # Status / Galat Provider
    if provider_errors:
        print(f"[!] Peringatan/Galat Provider Terdeteksi ({len(provider_errors)}):")
        for err in provider_errors:
            print(f"    - {err}")
    else:
        print(f"[*] Provider Status         : OK (Semua provider merespons tanpa error HTTP 429/500)")

    # Tampilkan Top 5
    top_5 = results[:5]
    print(f"\n[*] TOP {len(top_5)} HASIL PERINGKAT TERATAS:")
    print("-" * 80)
    for r_idx, item in enumerate(top_5, 1):
        title = item.title
        ev_level = item.evidence_level or "journal"
        year_str = str(item.year) if item.year else "N/A"
        journal_str = item.journal or "Publikasi Ilmiah"
        score_str = f"{item.score:.4f}" if hasattr(item, "score") else "N/A"
        
        # Periksa apakah naskah memuat entitas kunci
        text_corpus = f"{title} {item.snippet or ''} {item.full_text or ''}".lower()
        matched = [d for d in detected_drugs if d in text_corpus]

        print(f" #{r_idx} [Skor: {score_str}] [{ev_level.upper()}] ({year_str}) {title}")
        print(f"    Jurnal/Sumber : {journal_str}")
        print(f"    Entitas Cocok : {matched} / {detected_drugs}")
        print(f"    URL           : {item.url}")
        snippet_preview = (item.snippet or "").replace("\n", " ")[:140]
        print(f"    Cuplikan      : {snippet_preview}...")
        print()

    return {
        "query": query,
        "detected_drugs": detected_drugs,
        "duration_seconds": duration,
        "total_results": len(results),
        "errors": list(provider_errors),
        "top_5": top_5
    }

async def main():
    root_logger = logging.getLogger()
    handler = ErrorCaptureHandler()
    formatter = logging.Formatter("[%(levelname)s] %(message)s")
    handler.setFormatter(formatter)
    root_logger.addHandler(handler)

    print("################################################################")
    print(" EPIONA P3-1b LIVE ACADEMIC SEARCH QUALITY CHECK")
    print(" Menguji 5 Kueri Farmasi Nyata pada Mode Academic")
    print("################################################################")

    orchestrator = SearchOrchestrator()
    summary = []

    for i, q in enumerate(TEST_QUERIES, 1):
        info = await check_query(orchestrator, i, q)
        summary.append(info)

    print("\n" + "=" * 80)
    print(" REKAPITULASI PENGUJIAN 5 KUERI FARMASI")
    print("=" * 80)
    for i, s in enumerate(summary, 1):
        err_count = len(s["errors"])
        top_title = s["top_5"][0].title if s["top_5"] else "KOSONG"
        print(f"{i}. \"{s['query'][:45]}...\" -> {s['total_results']} hasil | Top #1: {top_title[:45]}... | Galat: {err_count}")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(main())
