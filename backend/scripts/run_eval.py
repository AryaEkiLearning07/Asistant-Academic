#!/usr/bin/env python3
"""
EPIONA Evaluation Runner Script
Mengevaluasi performa grounding asisten farmasi Epiona terhadap dataset evaluasi (JSONL).
Menghitung:
- Presisi Sitasi (Citation Precision)
- Tingkat Halusinasi (Hallucination Rate)
- Penolakan Benar (Correct Rejection Rate)
"""

import argparse
import json
import os
import sys
import uuid
from pathlib import Path
from typing import Dict, Any, List

# Tambahkan direktori root backend ke sys.path agar modul internal dapat diimpor
CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent
ROOT_DIR = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Indikator frasa penolakan benar (grounding integrity)
REJECTION_INDICATORS = [
    "tidak terdapat",
    "tidak ditemukan",
    "tidak memuat",
    "tidak disebutkan",
    "dokumen tidak memuat",
    "di luar materi",
    "di luar dokumen",
    "tidak ada informasi",
    "tidak tercantum",
    "tidak dijelaskan",
    "tidak memuat informasi",
    "tidak dapat ditemukan",
    "dokumen rujukan tidak",
    "tidak dibahas",
]

def is_rejected_response(answer_text: str) -> bool:
    """Mendeteksi apakah asisten menolak menjawab karena data tidak ada di dokumen."""
    ans_lower = answer_text.lower()
    return any(phrase in ans_lower for phrase in REJECTION_INDICATORS)

def run_evaluation(input_file: Path, api_url: str = "", model_preference: str = "gemini-2.0-flash", verbose: bool = False):
    """Membaca file eval JSONL dan mengeksekusi pengujian terhadap API."""
    if not input_file.exists():
        print(f"[ERROR] Berkas evaluasi tidak ditemukan: {input_file}", file=sys.stderr)
        sys.exit(1)

    eval_items: List[Dict[str, Any]] = []
    with open(input_file, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line_str = line.strip()
            if not line_str or line_str.startswith("#"):
                continue
            try:
                data = json.loads(line_str)
                eval_items.append(data)
            except json.JSONDecodeError as e:
                print(f"[WARN] Baris {line_num} bukan JSON valid, dilewati: {e}", file=sys.stderr)

    if not eval_items:
        print("[ERROR] Tidak ada item evaluasi yang valid untuk dijalankan.", file=sys.stderr)
        sys.exit(1)

    print(f"================================================================")
    print(f" EPIONA ASSISTANT - BENCHMARK EVALUATION RUNNER")
    print(f" Dataset: {input_file.name} ({len(eval_items)} soal)")
    print(f" Mode Model: {model_preference}")
    print(f"================================================================\n")

    # Inisialisasi API client
    use_http = bool(api_url and api_url.strip())
    test_client = None
    token = ""

    if use_http:
        import urllib.request
        api_base = api_url.rstrip("/")
        print(f"[RUNNER] Menggunakan endpoint HTTP eksternal: {api_base}")
    else:
        print("[RUNNER] Menggunakan in-process FastAPI TestClient...")
        from fastapi.testclient import TestClient
        from app.main import app
        test_client = TestClient(app)

        # Buat user evaluasi sementara
        eval_email = f"eval_runner_{uuid.uuid4().hex[:6]}@epiona.my.id"
        reg = test_client.post("/api/v1/auth/register", json={
            "email": eval_email,
            "password": "EvalPassword123!",
            "full_name": "Eval Benchmark Runner"
        })
        if reg.status_code == 200:
            token = reg.json().get("token", "")
        else:
            token = "mock_eval_token"

        # Unggah dokumen PDF sintetis rujukan ke MyLibrary agar korpus evaluasi terisi
        try:
            import fitz
            doc = fitz.open()
            p1 = doc.new_page()
            p1.insert_text((50, 72), "Bab 1: Parameter farmakokinetika volume distribusi (Vd) mencerminkan proporsi dosis obat terhadap konsentrasi plasma. Rumus: Vd = Dosis / C0.")
            p2 = doc.new_page()
            p2.insert_text((50, 72), "Bab 2: Eliminasi dan Klirens. Penyesuaian dosis obat tereliminasi ginjal pada gagal ginjal kronis dihitung berdasarkan laju filtrasi glomerulus (GFR) dan klirens kreatinin.")
            p3 = doc.new_page()
            p3.insert_text((50, 72), "Bab 3: Biofarmasetika dan Formulasi. Bioavailabilitas sediaan per oral dipengaruhi kelarutan obat, laju absorpsi membran usus, dan metabolisme lintas pertama (first-pass metabolism).")
            pdf_bytes = doc.tobytes()
            doc.close()

            test_client.post(
                "/api/v1/documents/upload",
                headers={"X-User-Id": token},
                files={"file": ("Farmakokinetika Klinik dan Biofarmasetika.pdf", pdf_bytes, "application/pdf")},
                data={"title": "Farmakokinetika Klinik dan Biofarmasetika"}
            )
        except Exception as up_err:
            print(f"[WARN] Tidak dapat mengunggah dokumen sintetis uji: {up_err}", file=sys.stderr)

    results = []
    total_rejection_target = 0
    correct_rejections = 0
    hallucination_cases = 0
    total_factual_target = 0
    valid_citations = 0
    content_matches_total = 0

    for idx, item in enumerate(eval_items, 1):
        q = item.get("pertanyaan", "")
        doc_ref = item.get("dokumen", "")
        must_include = item.get("jawaban_harus_memuat", [])
        must_reject = bool(item.get("harus_menolak", False))
        label = item.get("label", "CONTOH")

        print(f"[{idx}/{len(eval_items)}] [{label}] Menguji: \"{q[:60]}...\"")

        answer_text = ""
        citations = []
        is_error = False

        if use_http:
            req_data = json.dumps({
                "question": q,
                "grounding_mode": "library",
                "model_preference": model_preference
            }).encode("utf-8")
            req = urllib.request.Request(
                f"{api_base}/api/v1/chat",
                data=req_data,
                headers={"Content-Type": "application/json"}
            )
            try:
                with urllib.request.urlopen(req, timeout=40) as resp:
                    resp_data = json.loads(resp.read().decode("utf-8"))
                    answer_text = resp_data.get("answer", "")
                    citations = resp_data.get("citations", [])
            except Exception as e:
                is_error = True
                answer_text = f"[ERROR HTTP] {e}"
        else:
            resp = test_client.post(
                "/api/v1/chat",
                headers={"X-User-Id": token},
                json={
                    "question": q,
                    "grounding_mode": "library",
                    "model_preference": model_preference
                }
            )
            if resp.status_code == 200:
                resp_data = resp.json()
                answer_text = resp_data.get("answer", "")
                citations = resp_data.get("citations", [])
            else:
                is_error = True
                answer_text = f"[ERROR API {resp.status_code}] {resp.text}"

        rejected = is_rejected_response(answer_text)

        # Evaluasi Metrik
        if must_reject:
            total_rejection_target += 1
            if rejected:
                correct_rejections += 1
                verdict = "PENOLAKAN_BENAR (Lolos)"
            else:
                hallucination_cases += 1
                verdict = "HALUSINASI (Gagal: Seharusnya menolak karena di luar dokumen)"
        else:
            total_factual_target += 1
            # Cek apakah memuat kata kunci
            matched_terms = [t for t in must_include if t.lower() in answer_text.lower()]
            match_pct = (len(matched_terms) / len(must_include) * 100) if must_include else 100.0
            if match_pct >= 50.0:
                content_matches_total += 1

            # Cek sitasi
            has_citations = len(citations) > 0 or ("[" in answer_text and "]" in answer_text)
            if has_citations and not rejected:
                valid_citations += 1

            if rejected:
                verdict = "SALAH_TOLAK (Gagal: Pertanyaan faktual ditolak)"
            elif match_pct >= 60.0:
                verdict = "FAKTUAL_TEPAT (Lolos)"
            else:
                verdict = "SEBAGIAN (Kata kunci kunci kurang lengkap)"

        results.append({
            "idx": idx,
            "pertanyaan": q,
            "must_reject": must_reject,
            "rejected": rejected,
            "citations_count": len(citations),
            "verdict": verdict,
            "answer_preview": answer_text[:120].replace("\n", " ")
        })
        print(f"      -> Hasil: {verdict}")
        if verbose:
            print(f"      -> Cuplikan Jawaban: {answer_text[:180].replace(chr(10), ' ')}...")

    # Rekapitulasi Metrik
    cr_rate = (correct_rejections / total_rejection_target * 100) if total_rejection_target else 100.0
    hal_rate = (hallucination_cases / total_rejection_target * 100) if total_rejection_target else 0.0
    cit_prec = (valid_citations / total_factual_target * 100) if total_factual_target else 100.0
    factual_acc = (content_matches_total / total_factual_target * 100) if total_factual_target else 100.0

    print("\n" + "=" * 64)
    print(" RINGKASAN HASIL EVALUASI EPIONA")
    print("=" * 64)
    print(f" Total Pertanyaan Diuji     : {len(eval_items)}")
    print(f" Target Pertanyaan Faktual  : {total_factual_target}")
    print(f" Target Pertanyaan Ditolak  : {total_rejection_target}")
    print("-" * 64)
    print(f" Penolakan Benar (Correct Rejection Rate) : {cr_rate:5.1f}% ({correct_rejections}/{total_rejection_target})")
    print(f" Tingkat Halusinasi (Hallucination Rate)   : {hal_rate:5.1f}% ({hallucination_cases}/{total_rejection_target})")
    print(f" Presisi Sitasi (Citation Precision)      : {cit_prec:5.1f}% ({valid_citations}/{total_factual_target})")
    print(f" Akurasi Konten Faktual                   : {factual_acc:5.1f}% ({content_matches_total}/{total_factual_target})")
    print("=" * 64 + "\n")

    return {
        "total": len(eval_items),
        "correct_rejections_rate": cr_rate,
        "hallucination_rate": hal_rate,
        "citation_precision": cit_prec,
        "factual_accuracy": factual_acc,
        "items": results
    }

def main():
    parser = argparse.ArgumentParser(description="Jalankan set evaluasi Epiona terhadap API.")
    parser.add_argument(
        "--input", "-i",
        type=Path,
        default=ROOT_DIR / "eval" / "sample.jsonl",
        help="Path ke berkas dataset evaluasi format JSONL (default: eval/sample.jsonl)"
    )
    parser.add_argument(
        "--api-url", "-u",
        type=str,
        default="",
        help="URL dasar API jika menguji server HTTP eksternal (misal http://localhost:8000)"
    )
    parser.add_argument(
        "--model", "-m",
        type=str,
        default="gemini-2.0-flash",
        help="Preferensi model (default: gemini-2.0-flash)"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Tampilkan cuplikan respon jawaban asisten"
    )
    args = parser.parse_args()

    input_path = args.input
    if not input_path.is_absolute():
        input_path = (ROOT_DIR / input_path).resolve()

    run_evaluation(input_path, api_url=args.api_url, model_preference=args.model, verbose=args.verbose)

if __name__ == "__main__":
    main()
