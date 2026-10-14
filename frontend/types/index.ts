/**
 * EPIONA Research Assistant - Shared Frontend Type Definitions
 * Seluruh antarmuka data global untuk interaksi frontend, API backend, dan state pengguna.
 */

export interface CitationItem {
  document_id: string;
  document_title: string;
  page_number: number;
  exact_quote: string;
  is_verbatim?: boolean;
  // Metadata Tambahan Mode Web Akademik

  source_type?: "local_pdf" | "academic_web" | "journal" | "label" | "web" | "document" | string;
  journal_name?: string;
  publication_year?: string;
  authors?: string[];
  doi?: string;
  url?: string;
  pdf_url?: string;
  abstract_snippet?: string;
  evidence_level?: string;
}

export type SourceItemType = "pdf" | "journal" | "web" | "label";

export interface SourceItem {
  id: string | number;
  type: SourceItemType;
  title: string;
  meta: string;
  page?: number;
  total_pages?: number;
  doi?: string;
  url?: string;
  pdf_url?: string;
  snippet?: string;
  highlights?: string[];
  authors?: string[];
  journal?: string;
  year?: string | number;
  evidence_level?: string;
  document_id?: string;
}

export type GroundingMode = "library" | "academic" | "web";

export interface FigureSnippet {
  document_id: string;
  page_number: number;
  figure_index: number;
  caption: string;
  image_url: string;
}

export interface MessageAttachment {
  name: string;
  size: number;
  type: string;
  dataUrl?: string | null;
}

export interface SearchProgressStep {
  text: string;
  status: "pending" | "running" | "done";
}

export interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  citations?: CitationItem[];
  sources?: SourceItem[];
  figures?: FigureSnippet[];
  attachments?: MessageAttachment[];
  timestamp: string;
  feedback?: "like" | "dislike" | null;
  searchProgress?: {
    steps: SearchProgressStep[];
    isFinished: boolean;
  };
}

export interface DocumentItem {
  id: string;
  file_hash: string;
  title: string;
  filename: string;
  total_pages: number;
  file_size_bytes: number;
  created_at: string;
  preview_snippet?: string;
  thumbnail_url?: string;
  pdf_url: string;
}

export type ModelPreference = "gemini-2.0-flash" | "claude-3-5-sonnet";
export type ModelTierOption = "auto" | "fast" | "pro" | "best";


export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  token: string;
  role?: string;
  tier?: "free" | "pro_weekly" | "pro_monthly";
  claude_quota_left?: number;
}

export interface ChatSessionItem {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AttachedFileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
  base64?: string;
}

export interface LightboxImageItem {
  src: string;
  title: string;
}

export interface ModalConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
}

export interface ModalAlertState {
  isOpen: boolean;
  title: string;
  message: string;
  type?: "info" | "warning" | "error";
}
