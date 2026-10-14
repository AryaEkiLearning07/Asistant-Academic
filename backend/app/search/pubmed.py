import logging
import re
import xml.etree.ElementTree as ET
from typing import List, Optional
import httpx
from app.search.models import BaseSearchProvider, SearchResult

logger = logging.getLogger(__name__)

class PubMedProvider(BaseSearchProvider):
    """
    Penyedia pencarian literatur biomedis NCBI PubMed via E-utilities (esearch + efetch).
    Mendukung NCBI_API_KEY opsional untuk rate limit lebih tinggi.
    """

    def __init__(self, api_key: Optional[str] = None, timeout: float = 7.0):
        self.api_key = api_key.strip() if api_key else None
        self.timeout = timeout
        self.esearch_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
        self.efetch_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"

    @property
    def name(self) -> str:
        return "pubmed"

    def _determine_evidence_level(self, pub_types: List[str], text_to_check: str) -> str:
        lower_types = [pt.lower() for pt in pub_types]
        combined_text = ((" ".join(lower_types)) + " " + text_to_check).lower()

        if any(k in combined_text for k in ["meta-analysis", "meta analysis"]):
            return "meta_analysis"
        if any(k in combined_text for k in ["systematic review", "systematic literature review"]):
            return "systematic_review"
        if any(k in combined_text for k in [
            "randomized controlled trial", "randomised controlled trial", "clinical trial", "rct"
        ]):
            return "rct"
        if any(k in combined_text for k in [
            "cohort study", "case-control", "observational study", "prospective cohort", "retrospective cohort"
        ]):
            return "observational"
        if any(k in combined_text for k in ["practice guideline", "guideline", "consensus"]):
            return "guideline"
        if any(k in combined_text for k in ["review", "scoping review"]):
            return "review"
        return "journal"

    async def search(self, query: str, limit: int = 5) -> List[SearchResult]:
        if not query or not query.strip():
            return []

        clean_query = query.strip()
        params = {
            "db": "pubmed",
            "term": clean_query,
            "retmax": str(limit),
            "retmode": "json",
            "sort": "relevance",
        }
        if self.api_key:
            params["api_key"] = self.api_key

        headers = {"User-Agent": "EPIONA-ResearchAssistant/2.0 (mailto:admin@epiona.my.id)"}

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(self.esearch_url, params=params, headers=headers)
                if resp.status_code != 200:
                    logger.warning(f"[PubMed] ESearch error HTTP {resp.status_code}")
                    return []

                search_data = resp.json()
                id_list = search_data.get("esearchresult", {}).get("idlist", [])
                if not id_list:
                    return []

                # Fetch full metadata & XML abstract
                fetch_params = {
                    "db": "pubmed",
                    "id": ",".join(id_list),
                    "retmode": "xml",
                }
                if self.api_key:
                    fetch_params["api_key"] = self.api_key

                fetch_resp = await client.get(self.efetch_url, params=fetch_params, headers=headers)
                if fetch_resp.status_code != 200:
                    logger.warning(f"[PubMed] EFetch error HTTP {fetch_resp.status_code}")
                    return []

                xml_content = fetch_resp.text
                return self._parse_pubmed_xml(xml_content)

        except Exception as e:
            logger.warning(f"[PubMed] Search error: {e}")
            return []

    def _parse_pubmed_xml(self, xml_content: str) -> List[SearchResult]:
        results: List[SearchResult] = []
        try:
            root = ET.fromstring(xml_content)
        except Exception as e:
            logger.warning(f"[PubMed] XML parse error: {e}")
            return []

        for article_tag in root.findall(".//PubmedArticle"):
            try:
                # 1. Title
                title_elem = article_tag.find(".//ArticleTitle")
                title = "".join(title_elem.itertext()).strip() if title_elem is not None else ""
                title = title.rstrip(".")

                # 2. PMID
                pmid_elem = article_tag.find(".//MedlineCitation/PMID")
                pmid = pmid_elem.text.strip() if pmid_elem is not None and pmid_elem.text else ""

                # 3. Abstract
                abstract_parts = []
                for abs_elem in article_tag.findall(".//Abstract/AbstractText"):
                    label = abs_elem.get("Label")
                    text = "".join(abs_elem.itertext()).strip()
                    if text:
                        if label:
                            abstract_parts.append(f"{label}: {text}")
                        else:
                            abstract_parts.append(text)
                abstract = " ".join(abstract_parts).strip()

                # 4. Authors
                authors: List[str] = []
                for auth_elem in article_tag.findall(".//AuthorList/Author"):
                    last_name = auth_elem.findtext("LastName") or ""
                    fore_name = auth_elem.findtext("ForeName") or auth_elem.findtext("Initials") or ""
                    full_name = f"{fore_name} {last_name}".strip()
                    if full_name:
                        authors.append(full_name)

                # 5. Journal
                journal_elem = article_tag.find(".//Journal/Title")
                if journal_elem is None:
                    journal_elem = article_tag.find(".//Journal/ISOAbbreviation")
                journal = "".join(journal_elem.itertext()).strip() if journal_elem is not None else "PubMed Central"

                # 6. Year
                year_elem = article_tag.find(".//JournalIssue/PubDate/Year")
                if year_elem is None:
                    year_elem = article_tag.find(".//JournalIssue/PubDate/MedlineDate")
                if year_elem is None:
                    year_elem = article_tag.find(".//PubDate/Year")
                if year_elem is None:
                    year_elem = article_tag.find(".//PubDate")

                year_val: Optional[int] = None
                if year_elem is not None:
                    text_content = "".join(year_elem.itertext()).strip()
                    m_year = re.search(r"\b(19\d\d|20\d\d)\b", text_content)
                    if m_year:
                        year_val = int(m_year.group(1))

                # 7. DOI & PMCID
                doi: Optional[str] = None
                pmcid: Optional[str] = None
                for aid in article_tag.findall(".//ArticleIdList/ArticleId"):
                    id_type = aid.get("IdType")
                    if id_type == "doi" and aid.text:
                        doi = aid.text.strip()
                    elif id_type == "pmc" and aid.text:
                        pmcid = aid.text.strip()

                # 8. Publication types
                pub_types: List[str] = []
                for pt in article_tag.findall(".//PublicationTypeList/PublicationType"):
                    if pt.text:
                        pub_types.append(pt.text.strip())

                evidence_level = self._determine_evidence_level(pub_types, f"{title} {abstract}")

                # 9. URL & PDF URL
                url = f"https://doi.org/{doi}" if doi else (
                    f"https://pmc.ncbi.nlm.nih.gov/articles/{pmcid}/" if pmcid else f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/"
                )
                pdf_url = f"https://pmc.ncbi.nlm.nih.gov/articles/{pmcid}/pdf/" if pmcid else None

                if title:
                    results.append(SearchResult(
                        title=title,
                        url=url,
                        snippet=abstract or title,
                        full_text=abstract or None,
                        source_type="journal",
                        year=year_val,
                        authors=authors,
                        doi=doi,
                        evidence_level=evidence_level,
                        journal=journal,
                        pdf_url=pdf_url,
                    ))
            except Exception as item_err:
                logger.debug(f"[PubMed] Error parsing article: {item_err}")
                continue

        return results
