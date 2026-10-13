import re
import json
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

class AcademicRetrieverService:
    """
    Layanan pengambil data literatur ilmiah real-time (NCBI PubMed, PMC, arXiv)
    untuk mode Web Akademik ala Perplexity / Consensus.
    """

    @staticmethod
    def translate_to_indonesian(text: str) -> str:
        """
        Menerjemahkan teks ilmiah (abstrak/judul) dari bahasa Inggris ke bahasa Indonesia
        menggunakan lightweight translator fallback. Jika gagal, kembalikan teks asli.
        """
        if not text or not text.strip():
            return ""
        clean_input = text.strip()
        try:
            # Gunakan endpoint translasi cepat
            encoded = urllib.parse.quote(clean_input[:1000])
            url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=id&dt=t&q={encoded}"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
            with urllib.request.urlopen(req, timeout=4) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            if data and isinstance(data, list) and len(data) > 0 and isinstance(data[0], list):
                translated_segments = [seg[0] for seg in data[0] if seg and len(seg) > 0 and seg[0]]
                translated = "".join(translated_segments).strip()
                if translated:
                    return translated
        except Exception as e:
            logger.debug(f"[TRANSLATE ERROR] {e}")
    @staticmethod
    def translate_to_english(text: str) -> str:
        """
        Menerjemahkan kueri / pertanyaan bahasa Indonesia ke bahasa Inggris ilmiah
        menggunakan endpoint translasi cepat (< 300ms).
        """
        if not text or not text.strip():
            return ""
        clean_input = text.strip()
        try:
            encoded = urllib.parse.quote(clean_input[:400])
            url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl=id&tl=en&dt=t&q={encoded}"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
            with urllib.request.urlopen(req, timeout=3) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            if data and isinstance(data, list) and len(data) > 0 and isinstance(data[0], list):
                translated_segments = [seg[0] for seg in data[0] if seg and len(seg) > 0 and seg[0]]
                translated = "".join(translated_segments).strip()
                if translated:
                    return translated
        except Exception as e:
            logger.debug(f"[TRANSLATE TO EN ERROR] {e}")
        return clean_input

    @classmethod
    def clean_search_query(cls, user_question: str) -> str:
        """
        Merumuskan kueri pencarian PubMed presisi ala Perplexity / Consensus:
        1. Cek akronim farmasi spesifik
        2. Terjemahkan pertanyaan ke bahasa Inggris ilmiah
        3. Hilangkan stopwords pertanyaan dan ekstraksi kata kunci biomedis esensial
        """
        clean_text = user_question.strip().lower()

        # 1. Pemetaan khusus singkatan/akronim medis & farmasi umum
        acronym_map = {
            "adma": '"asymmetric dimethylarginine" AND (nitric oxide OR cardiovascular OR pharmacology)',
            "sdma": '"symmetric dimethylarginine" AND (renal OR kidney OR pharmacology)',
            "cyp450": "cytochrome P450 drug metabolism",
            "nsaid": "nonsteroidal anti-inflammatory drugs pharmacology",
            "acei": "angiotensin converting enzyme inhibitor pharmacology",
            "arb": "angiotensin receptor blocker pharmacology",
            "dm2": "type 2 diabetes mellitus pharmacotherapy",
            "tb": "tuberculosis antitubercular therapy",
            "hiv": "antiretroviral therapy HIV pharmacology",
            "gerd": "gastroesophageal reflux disease proton pump inhibitor"
        }
        for acr, mapped_query in acronym_map.items():
            if re.search(rf"\b{acr}\b", clean_text):
                return mapped_query

        # 2. Terjemahkan ke Bahasa Inggris Ilmiah
        translated_en = cls.translate_to_english(user_question).lower()

        # 3. Filter stopwords pertanyaan dalam bahasa Inggris
        en_stopwords = {
            "what", "is", "are", "the", "a", "an", "of", "for", "in", "to", "does", "do", "how",
            "can", "could", "should", "would", "tell", "me", "about", "explain", "please", "why",
            "which", "when", "where", "safe", "effect", "effects", "drug", "medicine", "medication",
            "and", "or", "on", "with", "during", "patient", "patients"
        }
        tokens = re.findall(r"\b[a-zA-Z0-9-]+\b", translated_en)
        key_terms = [t for t in tokens if t not in en_stopwords and len(t) > 2]

        # Jika ada istilah khusus keamanan/efek/mekanisme, pertahankan
        special_tags = []
        if any(w in clean_text for w in ["efek samping", "bahaya", "toksik", "adverse", "side effect"]):
            special_tags.append("adverse effects")
        if any(w in clean_text for w in ["mekanisme", "cara kerja", "mechanism", "action"]):
            special_tags.append("mechanism of action")
        if any(w in clean_text for w in ["ibu hamil", "hamil", "kandungan", "pregnancy", "pregnant"]):
            special_tags.append("pregnancy")
        if any(w in clean_text for w in ["anak", "balita", "pediatric", "children"]):
            special_tags.append("pediatric")
        if any(w in clean_text for w in ["dosis", "aturan pakai", "dosage", "dose"]):
            special_tags.append("dosage")

        combined = key_terms[:4] + special_tags
        # Hilangkan duplikat sambil mempertahankan urutan
        seen = set()
        final_terms = []
        for t in combined:
            if t not in seen:
                seen.add(t)
                final_terms.append(t)

        final_query = " ".join(final_terms)
        return final_query if final_query else translated_en[:40]

    @classmethod
    def search_pubmed(cls, query: str, max_results: int = 4) -> List[Dict[str, Any]]:
        """
        Mencari artikel jurnal di NCBI PubMed Central (PMC) & PubMed E-Utilities berbasis relevansi.
        Mengembalikan metadata kredibel: Title, Authors, Journal, Year, DOI, Abstract, & URL.
        """
        results = []
        try:
            encoded_query = urllib.parse.quote_plus(query)
            # 1. eSearch PubMed utama dengan sort=relevance
            pubmed_search_url = (
                f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
                f"?db=pubmed&term={encoded_query}&retmax={max_results}&retmode=json&sort=relevance"
            )
            req_pm = urllib.request.Request(pubmed_search_url, headers={"User-Agent": "EPIONA-ResearchAssistant/1.0"})
            with urllib.request.urlopen(req_pm, timeout=5) as resp_pm:
                pm_data = json.loads(resp_pm.read().decode("utf-8"))
            id_list = pm_data.get("esearchresult", {}).get("idlist", [])
            target_db = "pubmed"

            # Jika di pubmed kosong, coba PMC dengan sort=relevance
            if not id_list:
                search_url = (
                    f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
                    f"?db=pmc&term={encoded_query}&retmax={max_results}&retmode=json&sort=relevance"
                )
                req = urllib.request.Request(search_url, headers={"User-Agent": "EPIONA-ResearchAssistant/1.0"})
                with urllib.request.urlopen(req, timeout=5) as resp:
                    search_data = json.loads(resp.read().decode("utf-8"))
                id_list = search_data.get("esearchresult", {}).get("idlist", [])
                target_db = "pmc"

            if not id_list:
                return []

            # 2. eSummary untuk metadata naskah
            ids_str = ",".join(id_list)
            summary_url = (
                f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
                f"?db={target_db}&id={ids_str}&retmode=json"
            )
            req_sum = urllib.request.Request(summary_url, headers={"User-Agent": "EPIONA-ResearchAssistant/1.0"})
            with urllib.request.urlopen(req_sum, timeout=5) as resp_sum:
                sum_data = json.loads(resp_sum.read().decode("utf-8"))

            # 3. eFetch untuk mengambil abstrak asli
            abstracts_dict = {}
            try:
                fetch_url = (
                    f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
                    f"?db={target_db}&id={ids_str}&retmode=xml"
                )
                req_fetch = urllib.request.Request(fetch_url, headers={"User-Agent": "EPIONA-ResearchAssistant/1.0"})
                with urllib.request.urlopen(req_fetch, timeout=5) as resp_fetch:
                    root_xml = ET.fromstring(resp_fetch.read().decode("utf-8", errors="ignore"))
                    for art in root_xml.findall(".//PubmedArticle"):
                        pmid_el = art.findtext(".//PMID")
                        abs_parts = [el.text for el in art.findall(".//AbstractText") if el.text]
                        if pmid_el and abs_parts:
                            abstracts_dict[pmid_el] = " ".join(abs_parts)
            except Exception as e:
                logger.debug(f"[EFETCH ABSTRACT ERROR] {e}")

            uids = sum_data.get("result", {}).get("uids", [])
            for uid in uids:
                item = sum_data.get("result", {}).get(uid, {})
                title = item.get("title", "").strip().rstrip(".")
                journal = item.get("source") or item.get("fulljournalname") or None
                pubdate = item.get("pubdate", "") or item.get("epubdate", "")
                year = pubdate.split()[0] if pubdate else None

                authors = [a.get("name") for a in item.get("authors", [])[:4] if a.get("name")]

                doi = None
                pmcid = None
                for aid in item.get("articleids", []):
                    if aid.get("idtype") == "doi":
                        doi = aid.get("value")
                    elif aid.get("idtype") == "pmcid":
                        pmcid = aid.get("value")

                url = f"https://doi.org/{doi}" if doi else (f"https://pmc.ncbi.nlm.nih.gov/articles/{pmcid}/" if pmcid else f"https://pubmed.ncbi.nlm.nih.gov/{uid}/")
                pdf_url = f"https://pmc.ncbi.nlm.nih.gov/articles/{pmcid}/pdf/" if pmcid else None

                raw_abstract = abstracts_dict.get(uid, "").strip()
                # Item 6: Kirim teks abstrak asli lengkap tanpa pemotongan 600 char & tanpa Google Translate tidak resmi
                abstract_snippet = raw_abstract if raw_abstract else None

                results.append({
                    "source_type": "academic_web",
                    "repo": "PubMed / PMC",
                    "document_title": title,
                    "journal_name": journal,
                    "publication_year": year,
                    "authors": authors,
                    "doi": doi,
                    "url": url,
                    "pdf_url": pdf_url,
                    "abstract_snippet": abstract_snippet
                })
        except Exception as e:
            logger.warning(f"[PUBMED SEARCH ERROR] {e}")

        return results

    @classmethod
    def search_arxiv(cls, query: str, max_results: int = 3) -> List[Dict[str, Any]]:
        """
        Mencari preprint ilmiah mutakhir di arXiv khusus kategori Biomedis / Farmakologi (q-bio).
        """
        results = []
        try:
            # Batasi pencarian arXiv hanya pada domain Quantitative Biology (q-bio)
            # Hindari paper NLP / LLM komputer murni
            clean_q = re.sub(r'["\(\)]', '', query).strip()
            encoded_query = urllib.parse.quote_plus(clean_q)
            arxiv_url = f"http://export.arxiv.org/api/query?search_query=cat:q-bio*+AND+all:{encoded_query}&start=0&max_results={max_results}"
            req = urllib.request.Request(arxiv_url, headers={"User-Agent": "EPIONA-ResearchAssistant/1.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                xml_data = resp.read().decode("utf-8", errors="ignore")

            root = ET.fromstring(xml_data)
            ns = {"atom": "http://www.w3.org/2005/Atom"}

            for entry in root.findall("atom:entry", ns):
                title_elem = entry.find("atom:title", ns)
                summary_elem = entry.find("atom:summary", ns)
                published_elem = entry.find("atom:published", ns)
                id_elem = entry.find("atom:id", ns)

                title = " ".join(title_elem.text.split()) if title_elem is not None and title_elem.text else "Riset arXiv"
                summary = " ".join(summary_elem.text.split()) if summary_elem is not None and summary_elem.text else ""
                published = published_elem.text[:4] if published_elem is not None and published_elem.text else None
                entry_id = id_elem.text if id_elem is not None and id_elem.text else ""

                authors = []
                for author_elem in entry.findall("atom:author", ns):
                    name_elem = author_elem.find("atom:name", ns)
                    if name_elem is not None and name_elem.text:
                        authors.append(name_elem.text)

                pdf_link = None
                for link in entry.findall("atom:link", ns):
                    if link.get("title") == "pdf" or link.get("type") == "application/pdf":
                        pdf_link = link.get("href")

                # Item 6: Kirim abstrak asli lengkap (Bahasa Inggris) ke model
                abstract_snippet = summary.strip() if summary else None

                results.append({
                    "source_type": "academic_web",
                    "repo": "arXiv Preprint",
                    "document_title": title,
                    "journal_name": "arXiv Quantitative Biology",
                    "publication_year": published,
                    "authors": authors[:3] if authors else [],
                    "doi": None,
                    "url": entry_id,
                    "pdf_url": pdf_link or (f"{entry_id}.pdf" if entry_id else None),
                    "abstract_snippet": abstract_snippet
                })

        except Exception as e:
            logger.warning(f"[ARXIV SEARCH ERROR] {e}")

        return results

    @classmethod
    def retrieve_academic_evidence(cls, user_question: str) -> List[Dict[str, Any]]:
        """
        Orkestrator pencarian multi-repositori (PubMed Central + arXiv).
        Mengambil 3-5 sumber ilmiah paling otoritatif & relevan.
        Menetapkan result_id asli (1-based) sebelum deduplikasi agar nomor sitasi [n]
        tetap merujuk ke ID hasil asli.
        """
        search_terms = cls.clean_search_query(user_question)

        # 1. Utamakan PubMed / PMC untuk biomedis & farmasi dengan sort=relevance
        evidence = cls.search_pubmed(search_terms, max_results=4)

        # 1b. Query Relaxation: Jika kueri gabungan tidak menemukan paper, coba terjemahan bahasa Inggris langsung
        if not evidence:
            raw_en = cls.translate_to_english(user_question)
            if raw_en and raw_en.lower() != search_terms.lower():
                evidence = cls.search_pubmed(raw_en, max_results=4)

        # 2. Jika PubMed masih sedikit (< 3), tambahkan preprint arXiv biomedis (q-bio)
        if len(evidence) < 3:
            arxiv_docs = cls.search_arxiv(search_terms, max_results=2)
            evidence.extend(arxiv_docs)

        # Tetapkan result_id asli (1-based) sebelum deduplikasi
        for idx, item in enumerate(evidence, 1):
            item["result_id"] = idx

        # Deduplikasi: pertahankan result_id asli, jangan nomor ulang
        seen_keys = set()
        deduped = []
        for item in evidence:
            key = item.get("doi") or item.get("url") or item.get("document_title", "").lower().strip()
            if key and key in seen_keys:
                continue
            if key:
                seen_keys.add(key)
            deduped.append(item)

        return deduped

