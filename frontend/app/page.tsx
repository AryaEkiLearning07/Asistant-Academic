"use client";

import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BookOpen,
  Send,
  UploadCloud,
  FileText,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Library,
  ChevronRight,
  ChevronLeft,
  BookmarkCheck,
  LayoutDashboard,
  User,
  LogOut,
  GraduationCap,
  ShieldCheck,
  PlusCircle,
  ArrowRight,
  ArrowLeft,
  Image as ImageIcon,
  PanelRightClose,
  PanelRightOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Home,
  Bot,
  X,
  Trash2,
  MoreVertical,
  Download,
  Printer,
  ZoomIn,
  ZoomOut,
  MessageSquare,
  LayoutGrid,
  Search,
  Layers,
  ChevronDown,
  Pill,
  Brain,
  Cpu,
  Sun,
  Moon,
  SquarePen,
  Settings,
  Folder,
  Paperclip,
  Globe,
  Check,
  Calculator,
  Stethoscope,
  Edit2,
  Copy,
  RotateCcw,
  Mic,
  MicOff,
  Plus,
  Activity,
  Users,
  Server,
  Terminal,
  RefreshCw,
  Eye,
  Lock,
  Unlock,
  Clock,
  Database,
  HardDrive
} from "lucide-react";

interface CitationItem {
  document_id: string;
  document_title: string;
  page_number: number;
  exact_quote: string;
  // Metadata Tambahan Mode Web Akademik
  source_type?: "local_pdf" | "academic_web";
  journal_name?: string;
  publication_year?: string;
  authors?: string[];
  doi?: string;
  url?: string;
  pdf_url?: string;
  abstract_snippet?: string;
}

interface FigureSnippet {
  document_id: string;
  page_number: number;
  figure_index: number;
  caption: string;
  image_url: string;
}

interface MessageAttachment {
  name: string;
  size: number;
  type: string;
  dataUrl?: string | null;
}

interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  citations?: CitationItem[];
  figures?: FigureSnippet[];
  attachments?: MessageAttachment[];
  timestamp: string;
}

interface DocumentItem {
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

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  token: string;
  role?: string;
}

interface ChatSessionItem {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8005";

export default function AppRoot() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [currentNav, setCurrentNav] = useState<"dashboard" | "workspace" | "library" | "admin">("dashboard");
  const [theme, setTheme] = useState<"dark" | "light">("light");

  // Admin & Developer Console State
  const [adminActiveTab, setAdminActiveTab] = useState<"activity" | "users" | "documents" | "server">("activity");
  const [adminStats, setAdminStats] = useState<any | null>(null);
  const [adminActivities, setAdminActivities] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminDocuments, setAdminDocuments] = useState<any[]>([]);
  const [adminSystemStatus, setAdminSystemStatus] = useState<any | null>(null);
  const [adminLogs, setAdminLogs] = useState<any[]>([]);
  const [isAdminLoading, setIsAdminLoading] = useState<boolean>(false);
  const [adminAutoRefresh, setAdminAutoRefresh] = useState<boolean>(true);
  const [adminSearchFilter, setAdminSearchFilter] = useState<string>("");
  
  // User Inspector State (Audit Chat Langsung)
  const [inspectingUser, setInspectingUser] = useState<any | null>(null);
  const [inspectingSessions, setInspectingSessions] = useState<any[]>([]);
  const [inspectingActiveSessionId, setInspectingActiveSessionId] = useState<string | null>(null);
  const [inspectingMessages, setInspectingMessages] = useState<any[]>([]);
  const [isInspectingLoading, setIsInspectingLoading] = useState<boolean>(false);

  // Auth Form State
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [fullNameInput, setFullNameInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Workspace & Documents State
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [activeDoc, setActiveDoc] = useState<DocumentItem | null>(null);
  const [targetPage, setTargetPage] = useState<number>(1);
  const [highlightQuote, setHighlightQuote] = useState<string | null>(null);
  const [activeAcademicCitation, setActiveAcademicCitation] = useState<CitationItem | null>(null);
  const [isPdfPanelOpen, setIsPdfPanelOpen] = useState<boolean>(false);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState<boolean>(true);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [previewPage, setPreviewPage] = useState<number>(1);
  const [activeMenuDocId, setActiveMenuDocId] = useState<string | null>(null);
  const [librarySearch, setLibrarySearch] = useState<string>("");
  const [isSourcesOpen, setIsSourcesOpen] = useState<boolean>(false);
  const [sourcesAccordionOpen, setSourcesAccordionOpen] = useState<"web" | "files" | null>("web");
  const sourcesRef = useRef<HTMLDivElement>(null);

  function openDocumentPreview(doc: DocumentItem) {
    setPreviewDoc(doc);
    setPreviewPage(1);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      setActiveMenuDocId(null);
      setActiveSessionMenuId(null);
      if (sourcesRef.current && !sourcesRef.current.contains(e.target as Node)) {
        setIsSourcesOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPreviewDoc(null);
        setIsSourcesOpen(false);
        setActiveSessionMenuId(null);
        setEditingSessionId(null);
      }
    }
    window.addEventListener("click", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Chat State
  const [chatSessions, setChatSessions] = useState<ChatSessionItem[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputQuestion, setInputQuestion] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState("");
  const [isSearchingSessions, setIsSearchingSessions] = useState(false);
  const [activeSessionMenuId, setActiveSessionMenuId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionTitle, setEditingSessionTitle] = useState("");
  const [groundingMode, setGroundingMode] = useState<"library" | "academic">("library");

  interface AttachedFileItem {
    id: string;
    name: string;
    size: number;
    type: string;
    dataUrl?: string;
    base64?: string;
  }

  const [attachedFiles, setAttachedFiles] = useState<AttachedFileItem[]>([]);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; title: string } | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState<string>("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const shouldStopRecordingRef = useRef<boolean>(false);
  const speechBaseTextRef = useRef<string>("");
  const chatAttachmentInputRef = useRef<HTMLInputElement>(null);
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [sendingStatusText, setSendingStatusText] = useState<string>("EPIONA sedang membaca literatur...");
  const [isTypingStream, setIsTypingStream] = useState<boolean>(false);
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);

  // Auto-Expanding Chat Textarea ala Claude (Tumbuh Maksimal sampai Ketinggian Tertentu lalu Scrollbar Aktif)
  function adjustTextareaHeight() {
    const el = chatTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = 340; // Ketinggian batas maksimal sebelum scrollbar aktif
    const currentScrollHeight = el.scrollHeight;
    if (currentScrollHeight > maxHeight) {
      el.style.height = `${maxHeight}px`;
      el.style.overflowY = "auto";
    } else {
      el.style.height = `${Math.max(currentScrollHeight, 44)}px`;
      el.style.overflowY = "hidden";
    }
  }

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputQuestion]);

  // Helper Format Waktu 24 Jam Eksplisit (Format HH.mm, misal 23.00 tanpa AM/PM)
  function getNow24Hour(): string {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}.${String(now.getMinutes()).padStart(2, '0')}`;
  }

  function format24HourDisplay(timeStr?: string): string {
    if (!timeStr) return getNow24Hour();
    const colonMatch = timeStr.match(/^(\d{1,2})[:.](\d{2})(?:\s*([APap][Mm]))?/);
    if (colonMatch) {
      let hours = parseInt(colonMatch[1], 10);
      const minutes = colonMatch[2];
      const ampm = colonMatch[3]?.toUpperCase();
      if (ampm === "PM" && hours < 12) hours += 12;
      if (ampm === "AM" && hours === 12) hours = 0;
      return `${String(hours).padStart(2, '0')}.${minutes}`;
    }
    const parsed = new Date(timeStr);
    if (!isNaN(parsed.getTime())) {
      return `${String(parsed.getHours()).padStart(2, '0')}.${String(parsed.getMinutes()).padStart(2, '0')}`;
    }
    return timeStr;
  }

  // Helper Klasifikasi Format File & Badge Tipe
  function getFileBadgeInfo(filename: string, fileType?: string) {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    const isImage = fileType?.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(ext);
    const isPdf = ext === "pdf" || fileType === "application/pdf";
    const isDoc = ["doc", "docx", "dot", "dotx", "rtf"].includes(ext);
    const isSpreadsheet = ["xls", "xlsx", "csv", "tsv", "ods"].includes(ext);
    const isPresentation = ["ppt", "pptx", "odp"].includes(ext);
    const isText = ["txt", "md", "json", "log", "xml"].includes(ext);

    if (isImage) return { category: "image" as const, label: "IMG", ext };
    if (isPdf) return { category: "pdf" as const, label: "PDF", ext };
    if (isDoc) return { category: "word" as const, label: "DOCX", ext };
    if (isSpreadsheet) return { category: "sheet" as const, label: "XLSX", ext };
    if (isPresentation) return { category: "ppt" as const, label: "PPT", ext };
    if (isText) return { category: "text" as const, label: "TXT", ext };
    return { category: "other" as const, label: ext.toUpperCase() || "FILE", ext };
  }

  // Komponen Ikon Dokumen Resmi & Otentik (Menggunakan Aset Ikon Asli Standar Resmi Adobe PDF, Word, Excel, PPT)
  function FileFormatIcon({ filename, fileType, size = "md" }: { filename: string; fileType?: string; size?: "sm" | "md" | "lg" }) {
    const info = getFileBadgeInfo(filename, fileType);
    const sizeClasses = {
      sm: "w-5 h-5",
      md: "w-6 h-6",
      lg: "w-8 h-8",
    }[size];

    if (info.category === "pdf") {
      return (
        <div className={`relative shrink-0 flex items-center justify-center ${sizeClasses}`} title="Dokumen Adobe PDF">
          <img
            src="/icons/pdf.png"
            alt="PDF"
            className="w-full h-full object-contain drop-shadow-xs"
            onError={(e: any) => {
              // Fallback jika image gagal dimuat
              e.currentTarget.style.display = "none";
              if (e.currentTarget.nextSibling) {
                e.currentTarget.nextSibling.style.display = "block";
              }
            }}
          />
          <svg viewBox="0 0 40 48" fill="none" className="w-full h-full drop-shadow-xs hidden">
            <path d="M4 4C4 1.79086 5.79086 0 8 0H26L38 12V44C38 46.2091 36.2091 48 34 48H8C5.79086 48 4 46.2091 4 44V4Z" fill="#EA4335" />
            <path d="M26 0V12H38L26 0Z" fill="#FCE8E6" />
            <rect x="7" y="32" width="26" height="11" rx="2.5" fill="#C5221F" />
            <text x="20" y="40.5" fill="#FFFFFF" fontSize="8.5" fontWeight="900" fontFamily="sans-serif" textAnchor="middle">PDF</text>
          </svg>
        </div>
      );
    }

    if (info.category === "word") {
      return (
        <div className={`relative shrink-0 flex items-center justify-center ${sizeClasses}`} title="Dokumen Microsoft Word">
          <img
            src="/icons/word.png"
            alt="Word"
            className="w-full h-full object-contain drop-shadow-xs"
            onError={(e: any) => {
              e.currentTarget.style.display = "none";
              if (e.currentTarget.nextSibling) {
                e.currentTarget.nextSibling.style.display = "block";
              }
            }}
          />
          <svg viewBox="0 0 40 48" fill="none" className="w-full h-full drop-shadow-xs hidden">
            <path d="M4 4C4 1.79086 5.79086 0 8 0H26L38 12V44C38 46.2091 36.2091 48 34 48H8C5.79086 48 4 46.2091 4 44V4Z" fill="#2B579A" />
            <path d="M26 0V12H38L26 0Z" fill="#D2E3FC" />
            <rect x="6" y="28" width="18" height="16" rx="3" fill="#185ABD" />
            <path d="M9.5 32H11.5L13.2 38.5L15 32H16.8L18.6 38.5L20.3 32H22.3L20 41.5H17.8L16 35.5L14.2 41.5H12L9.5 32Z" fill="white" />
          </svg>
        </div>
      );
    }

    if (info.category === "sheet") {
      return (
        <div className={`relative shrink-0 flex items-center justify-center ${sizeClasses}`} title="Dokumen Microsoft Excel / Spreadsheet">
          <img
            src="/icons/excel.png"
            alt="Excel"
            className="w-full h-full object-contain drop-shadow-xs"
            onError={(e: any) => {
              e.currentTarget.style.display = "none";
              if (e.currentTarget.nextSibling) {
                e.currentTarget.nextSibling.style.display = "block";
              }
            }}
          />
          <svg viewBox="0 0 40 48" fill="none" className="w-full h-full drop-shadow-xs hidden">
            <path d="M4 4C4 1.79086 5.79086 0 8 0H26L38 12V44C38 46.2091 36.2091 48 34 48H8C5.79086 48 4 46.2091 4 44V4Z" fill="#217346" />
            <path d="M26 0V12H38L26 0Z" fill="#CEEAD6" />
            <rect x="6" y="28" width="18" height="16" rx="3" fill="#107C41" />
            <path d="M10 32.5L13.8 37L10 41.5H12.6L15 38.6L17.4 41.5H20L16.2 37L20 32.5H17.4L15 35.4L12.6 32.5H10Z" fill="white" />
          </svg>
        </div>
      );
    }

    if (info.category === "ppt") {
      return (
        <div className={`relative shrink-0 flex items-center justify-center ${sizeClasses}`} title="Dokumen Microsoft PowerPoint">
          <img
            src="/icons/ppt.png"
            alt="PowerPoint"
            className="w-full h-full object-contain drop-shadow-xs"
            onError={(e: any) => {
              e.currentTarget.style.display = "none";
              if (e.currentTarget.nextSibling) {
                e.currentTarget.nextSibling.style.display = "block";
              }
            }}
          />
          <svg viewBox="0 0 40 48" fill="none" className="w-full h-full drop-shadow-xs hidden">
            <path d="M4 4C4 1.79086 5.79086 0 8 0H26L38 12V44C38 46.2091 36.2091 48 34 48H8C5.79086 48 4 46.2091 4 44V4Z" fill="#D24726" />
            <path d="M26 0V12H38L26 0Z" fill="#FCE8E6" />
            <rect x="6" y="28" width="18" height="16" rx="3" fill="#C43E1C" />
            <path d="M11 32.5H15.5C17.5 32.5 18.5 33.5 18.5 35C18.5 36.5 17.5 37.5 15.5 37.5H13V41.5H11V32.5ZM13 34.2V35.8H15.2C16 35.8 16.5 35.5 16.5 35C16.5 34.5 16 34.2 15.2 34.2H13Z" fill="white" />
          </svg>
        </div>
      );
    }

    if (info.category === "text") {
      // Ikon Dokumen Teks Polos (Slate Gray dengan Garis Kode / Teks)
      return (
        <div className={`relative shrink-0 flex items-center justify-center ${sizeClasses}`} title="Dokumen Teks Murni">
          <svg viewBox="0 0 40 48" fill="none" className="w-full h-full drop-shadow-xs">
            <path d="M4 4C4 1.79086 5.79086 0 8 0H26L38 12V44C38 46.2091 36.2091 48 34 48H8C5.79086 48 4 46.2091 4 44V4Z" fill="#4B5563" />
            <path d="M26 0V12H38L26 0Z" fill="#E5E7EB" fillOpacity="0.8" />
            <rect x="10" y="16" width="20" height="2.5" rx="1" fill="white" fillOpacity="0.6" />
            <rect x="10" y="22" width="16" height="2.5" rx="1" fill="white" fillOpacity="0.6" />
            <rect x="10" y="28" width="18" height="2.5" rx="1" fill="white" fillOpacity="0.6" />
            <rect x="7" y="34" width="26" height="10" rx="2.5" fill="#374151" />
            <text x="20" y="42" fill="#FFFFFF" fontSize="8" fontWeight="800" fontFamily="sans-serif" textAnchor="middle">
              TXT
            </text>
          </svg>
        </div>
      );
    }

    // Default File Icon
    return (
      <div className={`relative shrink-0 flex items-center justify-center ${sizeClasses}`} title={`Berkas ${info.label}`}>
        <svg viewBox="0 0 40 48" fill="none" className="w-full h-full drop-shadow-xs">
          <path d="M4 4C4 1.79086 5.79086 0 8 0H26L38 12V44C38 46.2091 36.2091 48 34 48H8C5.79086 48 4 46.2091 4 44V4Z" fill="#64748B" />
          <path d="M26 0V12H38L26 0Z" fill="#E2E8F0" fillOpacity="0.8" />
          <rect x="7" y="32" width="26" height="11" rx="2.5" fill="#475569" />
          <text x="20" y="40.5" fill="#FFFFFF" fontSize="7.5" fontWeight="800" fontFamily="sans-serif" textAnchor="middle">
            {info.label.slice(0, 4)}
          </text>
        </svg>
      </div>
    );
  }

  // Modal Dialog UI Bawaan Platform (Menggantikan window.confirm & window.alert)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: "info" | "warning" | "error";
  } | null>(null);

  function showAlert(title: string, message: string, type: "info" | "warning" | "error" = "info") {
    setAlertModal({
      isOpen: true,
      title,
      message,
      type,
    });
  }
  const [isUploading, setIsUploading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sumber yang dikutip pada percakapan aktif (Sources ala Perplexity)
  // Dipetakan juga ke pertanyaan apa yang dijawab oleh referensi tersebut
  interface CitationWithContext extends CitationItem {
    questionText?: string;
  }

  const { sessionCitations, webCitationsGrouped, fileCitationsGrouped, totalWebCount, totalFileCount } = React.useMemo(() => {
    const list: CitationItem[] = [];
    const seen = new Set<string>();

    const webMap = new Map<string, CitationItem[]>(); // Map: Question -> Citations[]
    const fileMap = new Map<string, { docTitle: string; page: number; items: { quote: string; question: string; rawCit: CitationItem }[] }>();

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (m.sender === "assistant" && m.citations && m.citations.length > 0) {
        // Cari pertanyaan user yang relevan sebelum pesan assistant ini
        let userQuestion = "";
        for (let j = i - 1; j >= 0; j--) {
          if (messages[j].sender === "user") {
            userQuestion = messages[j].text;
            break;
          }
        }
        if (!userQuestion) userQuestion = "Pertanyaan Sesi Ini";

        m.citations.forEach((c) => {
          const key = `${c.document_id}-p${c.page_number}-${c.exact_quote.slice(0, 30)}`;
          if (!seen.has(key)) {
            seen.add(key);
            list.push(c);

            if (c.source_type === "academic_web") {
              const qKey = userQuestion;
              if (!webMap.has(qKey)) {
                webMap.set(qKey, []);
              }
              webMap.get(qKey)!.push(c);
            } else {
              const docKey = `${c.document_id}-p${c.page_number}`;
              if (!fileMap.has(docKey)) {
                fileMap.set(docKey, {
                  docTitle: c.document_title,
                  page: c.page_number,
                  items: []
                });
              }
              fileMap.get(docKey)!.items.push({
                quote: c.exact_quote,
                question: userQuestion,
                rawCit: c
              });
            }
          }
        });
      }
    }

    let webCount = 0;
    webMap.forEach((cits) => { webCount += cits.length; });

    let fileCount = 0;
    fileMap.forEach((group) => { fileCount += group.items.length; });

    return {
      sessionCitations: list,
      webCitationsGrouped: Array.from(webMap.entries()).map(([question, items]) => ({ question, items })),
      fileCitationsGrouped: Array.from(fileMap.values()),
      totalWebCount: webCount,
      totalFileCount: fileCount
    };
  }, [messages]);

  const uniqueDocsCount = React.useMemo(() => {
    const docIds = new Set(sessionCitations.map((c) => c.document_id));
    return docIds.size;
  }, [sessionCitations]);

  // 1. Cek sesi lokal pengguna & preferensi tema saat inisialisasi
  useEffect(() => {
    const saved = localStorage.getItem("epiona_session_user");
    if (saved) {
      try {
        setCurrentUser(JSON.parse(saved));
      } catch (e) {
        localStorage.removeItem("epiona_session_user");
      }
    }
    const savedTheme = localStorage.getItem("epiona_theme");
    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
      if (savedTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, []);

  function toggleTheme() {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("epiona_theme", next);
      if (next === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      return next;
    });
  }


  // 2. Muat dokumen & riwayat chat saat user login
  useEffect(() => {
    if (currentUser) {
      fetchUserDocuments();
      fetchChatSessions();
    }
  }, [currentUser]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function fetchChatSessions() {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/chats`, {
        headers: { "X-User-Id": currentUser.token },
      });
      if (res.ok) {
        const data = await res.json();
        setChatSessions(data.sessions || []);
      }
    } catch (err) {
      console.error("Gagal mengambil riwayat chat:", err);
    }
  }

  async function handleSelectSession(sessionId: string) {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/chats/${sessionId}/messages`, {
        headers: { "X-User-Id": currentUser.token },
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentSessionId(sessionId);
        if (data.messages && data.messages.length > 0) {
          const formatted = data.messages.map((m: any) => ({
            id: m.id,
            sender: m.sender,
            text: m.text,
            citations: m.citations || [],
            figures: m.figures || [],
            attachments: m.attachments || [],
            timestamp: m.timestamp && m.timestamp.includes("T")
              ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : (m.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
          }));
          setMessages(formatted);
        } else {
          setMessages([]);
        }
        setCurrentNav("workspace");
      }
    } catch (err) {
      console.error("Gagal memuat pesan:", err);
    }
  }

  async function handleNewChat() {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/chats`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": currentUser.token
        },
        body: JSON.stringify({ title: "Percakapan Baru" })
      });
      if (res.ok) {
        const newSess = await res.json();
        setChatSessions((prev) => [newSess, ...prev]);
        setCurrentSessionId(newSess.id);
        setMessages([]);
        setCurrentNav("workspace");
      }
    } catch (err) {
      console.error("Gagal membuat sesi baru:", err);
    }
  }

  async function handleDeleteSession(sessionId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!currentUser) return;
    setConfirmModal({
      isOpen: true,
      title: "Hapus Percakapan",
      message: "Apakah Anda yakin ingin menghapus percakapan ini dari riwayat?",
      confirmText: "Hapus",
      cancelText: "Batal",
      isDestructive: true,
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const res = await fetch(`${API_BASE}/api/v1/chats/${sessionId}`, {
            method: "DELETE",
            headers: { "X-User-Id": currentUser.token }
          });
          if (res.ok) {
            setChatSessions((prev) => prev.filter((s) => s.id !== sessionId));
            if (currentSessionId === sessionId) {
              setCurrentSessionId(null);
              setMessages([]);
            }
          }
        } catch (err) {
          console.error("Gagal menghapus percakapan:", err);
          showAlert("Gagal Menghapus", "Terjadi kesalahan saat menghapus percakapan.", "error");
        }
      }
    });
  }

  async function handleRenameSession(sessionId: string, newTitle: string) {
    if (!currentUser || !newTitle.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/chats/${sessionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": currentUser.token
        },
        body: JSON.stringify({ title: newTitle.trim() })
      });
      if (res.ok) {
        setChatSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, title: newTitle.trim() } : s))
        );
        setEditingSessionId(null);
      }
    } catch (err) {
      console.error("Gagal mengubah judul percakapan:", err);
    }
  }

  async function fetchUserDocuments() {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/documents`, {
        headers: { "X-User-Id": currentUser.token },
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents);
        if (data.documents.length > 0 && !activeDoc) {
          setActiveDoc(data.documents[0]);
        }
      }
    } catch (err) {
      console.error("Gagal mengambil dokumen:", err);
    }
  }

  // Handle Login & Register
  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setIsAuthLoading(true);

    const endpoint = authMode === "login" ? "/api/v1/auth/login" : "/api/v1/auth/register";
    const payload =
      authMode === "login"
        ? { email: emailInput, password: passwordInput }
        : { email: emailInput, password: passwordInput, full_name: fullNameInput };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Terjadi kesalahan pada autentikasi.");
      }

      const profile: UserProfile = {
        id: data.user_id,
        email: data.email,
        full_name: data.full_name,
        token: data.token,
        role: data.role || (data.email === "admin@epiona.my.id" ? "admin" : "user"),
      };

      setCurrentUser(profile);
      localStorage.setItem("epiona_session_user", JSON.stringify(profile));
      if (profile.role === "admin") {
        setCurrentNav("admin");
      }
      setEmailInput("");
      setPasswordInput("");
      setFullNameInput("");
    } catch (err: any) {
      setAuthError(err.message || "Gagal menghubungi server");
    } finally {
      setIsAuthLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("epiona_session_user");
    setCurrentUser(null);
    setDocuments([]);
    setActiveDoc(null);
    setMessages([]);
  }

  // --- ADMIN & DEVELOPER CONSOLE HANDLERS ---
  const fetchAdminStatsAndActivities = React.useCallback(async () => {
    if (!currentUser || currentUser.role !== "admin") return;
    try {
      const headers = { "Authorization": `Bearer ${currentUser.token}`, "X-User-Id": currentUser.token };
      const [resStats, resAct] = await Promise.all([
        fetch(`${API_BASE}/api/v1/admin/stats`, { headers }),
        fetch(`${API_BASE}/api/v1/admin/activities?limit=60`, { headers })
      ]);
      if (resStats.ok) {
        const data = await resStats.json();
        setAdminStats(data);
      }
      if (resAct.ok) {
        const data = await resAct.json();
        setAdminActivities(data.activities || []);
      }
    } catch (e) {
      console.error("Gagal mengambil data monitoring admin:", e);
    }
  }, [currentUser]);

  const fetchAdminTabContent = React.useCallback(async (tab: "activity" | "users" | "documents" | "server") => {
    if (!currentUser || currentUser.role !== "admin") return;
    setIsAdminLoading(true);
    const headers = { "Authorization": `Bearer ${currentUser.token}`, "X-User-Id": currentUser.token };
    try {
      if (tab === "activity") {
        await fetchAdminStatsAndActivities();
      } else if (tab === "users") {
        const res = await fetch(`${API_BASE}/api/v1/admin/users`, { headers });
        if (res.ok) {
          const data = await res.json();
          setAdminUsers(data.users || []);
        }
      } else if (tab === "documents") {
        const res = await fetch(`${API_BASE}/api/v1/admin/documents`, { headers });
        if (res.ok) {
          const data = await res.json();
          setAdminDocuments(data.documents || []);
        }
      } else if (tab === "server") {
        const [resStatus, resLogs] = await Promise.all([
          fetch(`${API_BASE}/api/v1/admin/system/status`, { headers }),
          fetch(`${API_BASE}/api/v1/admin/system/logs?limit=80`, { headers })
        ]);
        if (resStatus.ok) {
          const data = await resStatus.json();
          setAdminSystemStatus(data);
        }
        if (resLogs.ok) {
          const data = await resLogs.json();
          setAdminLogs(data.logs || []);
        }
      }
    } catch (err) {
      console.error("Gagal memuat tab admin:", err);
    } finally {
      setIsAdminLoading(false);
    }
  }, [currentUser, fetchAdminStatsAndActivities]);

  // Efek memuat data saat masuk ke halaman Admin atau ganti tab
  useEffect(() => {
    if (currentNav === "admin" && currentUser?.role === "admin") {
      fetchAdminStatsAndActivities();
      fetchAdminTabContent(adminActiveTab);
    }
  }, [currentNav, adminActiveTab, currentUser, fetchAdminTabContent, fetchAdminStatsAndActivities]);

  // Efek interval live refresh untuk feed aktivitas pengguna
  useEffect(() => {
    if (currentNav !== "admin" || !adminAutoRefresh || currentUser?.role !== "admin") return;
    const interval = setInterval(() => {
      fetchAdminStatsAndActivities();
    }, 7000);
    return () => clearInterval(interval);
  }, [currentNav, adminAutoRefresh, currentUser, fetchAdminStatsAndActivities]);

  async function handleToggleUserStatus(targetUserId: string, currentActive: boolean) {
    if (!currentUser) return;
    const newStatus = !currentActive;
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/users/${targetUserId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser.token}`,
          "X-User-Id": currentUser.token
        },
        body: JSON.stringify({ is_active: newStatus })
      });
      if (res.ok) {
        setAdminUsers((prev) =>
          prev.map((u) => (u.id === targetUserId ? { ...u, is_active: newStatus } : u))
        );
        fetchAdminStatsAndActivities();
      } else {
        const errData = await res.json();
        showAlert("Aksi Gagal", errData.detail || "Tidak dapat mengubah status pengguna.", "error");
      }
    } catch (err: any) {
      showAlert("Error", "Gagal menghubungi server.", "error");
    }
  }

  async function handleInspectUser(targetUser: any) {
    if (!currentUser) return;
    setInspectingUser(targetUser);
    setInspectingSessions([]);
    setInspectingMessages([]);
    setInspectingActiveSessionId(null);
    setIsInspectingLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/users/${targetUser.id}/chats`, {
        headers: {
          "Authorization": `Bearer ${currentUser.token}`,
          "X-User-Id": currentUser.token
        }
      });
      if (res.ok) {
        const data = await res.json();
        const sessList = data.sessions || [];
        setInspectingSessions(sessList);
        if (sessList.length > 0) {
          handleSelectInspectingSession(sessList[0].id);
        }
      }
    } catch (err) {
      console.error("Gagal memeriksa sesi pengguna:", err);
    } finally {
      setIsInspectingLoading(false);
    }
  }

  async function handleSelectInspectingSession(sessionId: string) {
    if (!currentUser) return;
    setInspectingActiveSessionId(sessionId);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/chats/${sessionId}/messages`, {
        headers: {
          "Authorization": `Bearer ${currentUser.token}`,
          "X-User-Id": currentUser.token
        }
      });
      if (res.ok) {
        const data = await res.json();
        setInspectingMessages(data.messages || []);
      }
    } catch (err) {
      console.error("Gagal mengambil pesan sesi:", err);
    }
  }


  // Upload File ke MyLibrary milik user (Mendukung banyak file sekaligus / Multi-upload)
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0 || !currentUser) return;

    const fileList = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (fileList.length === 0) {
      showAlert("Format Berkas Tidak Sesuai", "Hanya berkas dengan format PDF yang didukung.", "warning");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploading(true);
    setUploadNotice(`Mengunggah ${fileList.length} berkas PDF ke MyLibrary...`);

    let successCount = 0;
    let failedCount = 0;
    let lastReceiptId: string | null = null;

    try {
      // Unggah berkas secara parallel / concurrent
      const uploadPromises = fileList.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", file.name.replace(/\.pdf$/i, ""));

        try {
          const res = await fetch(`${API_BASE}/api/v1/documents/upload`, {
            method: "POST",
            headers: { "X-User-Id": currentUser.token },
            body: formData,
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || `Gagal mengunggah ${file.name}`);
          }

          const receipt = await res.json();
          successCount++;
          lastReceiptId = receipt.id;
          return { success: true, receipt };
        } catch (err) {
          failedCount++;
          return { success: false, error: err };
        }
      });

      await Promise.all(uploadPromises);

      if (successCount > 0) {
        setUploadNotice(
          `✓ Berhasil menambahkan ${successCount} dokumen ke MyLibrary. Pengindeksan mendalam & pemotongan gambar berjalan di latar belakang.`
        );
        showAlert(
          "Upload Berhasil",
          `${successCount} dokumen telah ditambahkan ke MyLibrary.${failedCount > 0 ? ` (${failedCount} gagal)` : ""}`,
          "info"
        );
        await fetchUserDocuments();

        // Jika ada dokumen yang berhasil, aktifkan salah satunya jika belum ada yang aktif
        if (lastReceiptId) {
          const updated = await fetch(`${API_BASE}/api/v1/documents`, {
            headers: { "X-User-Id": currentUser.token },
          }).then((r) => r.json()).catch(() => ({ documents: [] }));

          const found = updated.documents?.find((d: DocumentItem) => d.id === lastReceiptId);
          if (found && !activeDoc) {
            setActiveDoc(found);
            setTargetPage(1);
          }
        }
      } else {
        showAlert("Gagal Mengunggah", "Semua berkas gagal diunggah. Pastikan server aktif.", "error");
      }
    } catch (err: any) {
      showAlert("Gagal Mengunggah", err.message || "Gagal mengunggah file.", "error");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Hapus Referensi Dokumen dari MyLibrary milik user (Smart Reference-Counting)
  async function handleDeleteDocument(docId: string, docTitle: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    if (!currentUser) return;

    setConfirmModal({
      isOpen: true,
      title: "Hapus Dokumen",
      message: `Apakah Anda yakin ingin menghapus "${docTitle}" dari MyLibrary Anda?`,
      confirmText: "Hapus",
      cancelText: "Batal",
      isDestructive: true,
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const res = await fetch(`${API_BASE}/api/v1/documents/${docId}`, {
            method: "DELETE",
            headers: { "X-User-Id": currentUser.token },
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.detail || "Gagal menghapus dokumen");
          }

          const data = await res.json();
          setDocuments((prev) => prev.filter((d) => d.id !== docId));
          if (activeDoc?.id === docId) {
            setActiveDoc(null);
          }
          setUploadNotice(data.message || `"${docTitle}" berhasil dihapus dari MyLibrary.`);
        } catch (err: any) {
          showAlert("Gagal Menghapus", err.message || "Gagal menghapus dokumen.", "error");
        }
      }
    });
  }

  // Timer Status Progresif (Menampilkan langkah detail: literatur -> diagram/gambar -> sintesis)
  function startProgressiveStatus(isAcademic: boolean, hasAttachments: boolean) {
    const steps = isAcademic
      ? [
          "Menghubungkan ke database jurnal terakreditasi (PubMed / NCBI)...",
          "Menelaah abstrak & rujukan uji klinis farmasi...",
          "Menganalisis metodologi & mencari potongan grafik/tabel...",
          "Merumuskan sintesis bukti ilmiah...",
        ]
      : hasAttachments
      ? [
          "Membaca dan membedah dokumen lampiran...",
          "Mengekstraksi diagram visual dan teks relevan...",
          "Menyelaraskan dengan korpus farmasi...",
          "Menyusun analisis penjelasan komprehensif...",
        ]
      : [
          "Menelusuri indeks & koleksi dokumen MyLibrary...",
          "Menganalisis bab, grafik, dan potongan visual dokumen...",
          "Memverifikasi rujukan halaman fisik...",
          "Menyusun penjelasan komprehensif...",
        ];

    setSendingStatusText(steps[0]);
    let stepIdx = 0;
    const timer = setInterval(() => {
      stepIdx++;
      if (stepIdx < steps.length) {
        setSendingStatusText(steps[stepIdx]);
      }
    }, 1100);

    return () => clearInterval(timer);
  }

  // Efek Mengetik Kata demi Kata (Streaming Typewriter Effect ala Claude)
  function streamAssistantReply(
    fullText: string,
    citations: CitationItem[] = [],
    figures: FigureSnippet[] = [],
    onComplete?: () => void
  ) {
    const msgId = (Date.now() + 1).toString();
    const initialMsg: Message = {
      id: msgId,
      sender: "assistant",
      text: "",
      citations,
      figures,
      timestamp: getNow24Hour(),
    };

    setMessages((prev) => [...prev, initialMsg]);
    setIsSending(false);
    setIsTypingStream(true);
    setStreamingMsgId(msgId);

    // Tokenisasi per kata, spasi, atau baris baru agar ritme alami terjaga
    const tokens = fullText.match(/\S+\s*|\s+/g) || [fullText];
    let currentIndex = 0;
    let accumulatedText = "";

    // Adaptif: jika jawaban sangat panjang, percepat laju kata agar tidak memakan waktu lama
    const totalTokens = tokens.length;
    const tokensPerTick = totalTokens > 400 ? 3 : totalTokens > 180 ? 2 : 1;
    const tickInterval = 18; // 18ms per tick

    const intervalId = setInterval(() => {
      if (currentIndex >= tokens.length) {
        clearInterval(intervalId);
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, text: fullText } : m))
        );
        setIsTypingStream(false);
        setStreamingMsgId(null);
        if (onComplete) onComplete();
        return;
      }

      for (let k = 0; k < tokensPerTick && currentIndex < tokens.length; k++) {
        accumulatedText += tokens[currentIndex];
        currentIndex++;
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, text: accumulatedText } : m))
      );
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, tickInterval);
  }

  // Kirim Pertanyaan ke Asisten
  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return;
    const q = inputQuestion.trim();
    if (!q && attachedFiles.length === 0) return;
    const currentAttachments = [...attachedFiles];
    setInputQuestion("");
    setAttachedFiles([]);
    setIsSending(true);

    const stopStatus = startProgressiveStatus(
      groundingMode === "academic",
      currentAttachments.length > 0
    );

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: q,
      attachments: currentAttachments.map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type,
        dataUrl: f.dataUrl,
      })),
      timestamp: getNow24Hour(),
    };
    setMessages((prev) => [...prev, userMsg]);

    let activeSession = currentSessionId;
    if (!activeSession) {
      try {
        const sessRes = await fetch(`${API_BASE}/api/v1/chats`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-Id": currentUser.token
          },
          body: JSON.stringify({ title: "Percakapan Baru" })
        });
        if (sessRes.ok) {
          const sData = await sessRes.json();
          activeSession = sData.id;
          setCurrentSessionId(sData.id);
          setChatSessions((prev) => [sData, ...prev]);
        }
      } catch (err) {}
    }

    try {
      const fallbackPrompt = currentAttachments.some((f) =>
        f.type.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].some((ext) => f.name.toLowerCase().endsWith(ext))
      )
        ? "Tolong jelaskan dan analisa gambar yang dilampirkan ini."
        : "Tolong rangkum dan jelaskan dokumen yang dilampirkan ini.";

      const res = await fetch(`${API_BASE}/api/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": currentUser.token,
        },
        body: JSON.stringify({
          question: q || fallbackPrompt,
          grounding_mode: groundingMode,
          focused_document_id: null,
          session_id: activeSession,
          attachments: currentAttachments.map((f) => ({
            filename: f.name,
            file_type: f.type,
            file_size: f.size,
            data_base64: f.base64 || (f.dataUrl && f.dataUrl.includes(";base64,") ? f.dataUrl.split(";base64,")[1] : null),
          })),
        }),
      });

      if (!res.ok) {
        throw new Error("Gagal mendapatkan respon asisten");
      }

      const data = await res.json();
      stopStatus();

      // Perbarui judul sesi langsung di sidebar saat respon pertama selesai diterima
      if (data.session_title && activeSession) {
        setChatSessions((prev) =>
          prev.map((s) => (s.id === activeSession ? { ...s, title: data.session_title } : s))
        );
      }

      if (data.figures && data.figures.length > 0) {
        setSendingStatusText("Menyiapkan potongan visual & diagram terkait...");
      }

      streamAssistantReply(data.answer, data.citations || [], data.figures || [], () => {
        fetchChatSessions();
      });
    } catch (err: any) {
      stopStatus();
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        text: "Maaf, terjadi kendala saat menghubungkan ke asisten.",
        timestamp: getNow24Hour(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  }

  // Salin teks pesan ke clipboard
  async function handleCopyMessage(msgId: string, text: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(msgId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error("Gagal menyalin teks:", err);
    }
  }

  // Ulangi / Regenerate pesan pengguna (kirim ulang prompt ke asisten)
  async function handleRetryUserMessage(userMsg: Message) {
    if (!currentUser || isSending) return;
    setIsSending(true);

    const stopStatus = startProgressiveStatus(
      groundingMode === "academic",
      Boolean(userMsg.attachments && userMsg.attachments.length > 0)
    );

    let activeSession = currentSessionId;
    try {
      const res = await fetch(`${API_BASE}/api/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": currentUser.token,
        },
        body: JSON.stringify({
          question: userMsg.text,
          grounding_mode: groundingMode,
          focused_document_id: null,
          session_id: activeSession,
          attachments: (userMsg.attachments || []).map((f) => ({
            filename: f.name,
            file_type: f.type,
            file_size: f.size,
            data_base64: f.dataUrl && f.dataUrl.includes(";base64,") ? f.dataUrl.split(";base64,")[1] : null,
          })),
        }),
      });

      if (!res.ok) throw new Error("Gagal mengulangi respon");

      const data = await res.json();
      stopStatus();
      streamAssistantReply(data.answer, data.citations || [], data.figures || []);
    } catch (err) {
      stopStatus();
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        text: "Maaf, terjadi kendala saat menghubungkan ke asisten.",
        timestamp: getNow24Hour(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  }

  // Simpan hasil edit pesan dan minta jawaban baru (Edit & Resubmit ala Claude)
  async function handleSaveEditedMessage(msgId: string) {
    const trimmed = editingMessageText.trim();
    if (!trimmed || !currentUser || isSending) return;

    // Perbarui teks pesan pengguna di state
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, text: trimmed } : m))
    );
    setEditingMessageId(null);
    setIsSending(true);

    const stopStatus = startProgressiveStatus(groundingMode === "academic", false);

    let activeSession = currentSessionId;
    try {
      const res = await fetch(`${API_BASE}/api/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": currentUser.token,
        },
        body: JSON.stringify({
          question: trimmed,
          grounding_mode: groundingMode,
          focused_document_id: null,
          session_id: activeSession,
          attachments: [],
        }),
      });

      if (!res.ok) throw new Error("Gagal mengirim hasil edit");

      const data = await res.json();
      stopStatus();
      streamAssistantReply(data.answer, data.citations || [], data.figures || []);
    } catch (err) {
      stopStatus();
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        text: "Maaf, terjadi kendala saat menghubungkan ke asisten.",
        timestamp: getNow24Hour(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  }

  // Input Suara (Voice to Text via Browser Web Speech API - Continuous Mode)
  function toggleVoiceInput() {
    if (isRecording) {
      shouldStopRecordingRef.current = true;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      setIsRecording(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      showAlert(
        "Fitur Suara Tidak Didukung",
        "Browser Anda belum mendukung Web Speech Recognition. Gunakan Google Chrome atau Microsoft Edge untuk menggunakan input suara.",
        "warning"
      );
      return;
    }

    try {
      shouldStopRecordingRef.current = false;
      speechBaseTextRef.current = inputQuestion.trim();
      const recognition = new SpeechRecognition();
      recognition.lang = "id-ID";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        let accumulatedSpeech = "";
        for (let i = 0; i < event.results.length; i++) {
          accumulatedSpeech += event.results[i][0].transcript;
        }

        const base = speechBaseTextRef.current;
        if (accumulatedSpeech) {
          setInputQuestion(base ? `${base} ${accumulatedSpeech.trim()}` : accumulatedSpeech.trim());
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === "no-speech") {
          // Abaikan jeda hening sejenak agar mic tidak langsung mati
          return;
        }
        console.error("Speech Recognition Error:", event.error);
        if (event.error === "not-allowed") {
          setIsRecording(false);
          shouldStopRecordingRef.current = true;
          showAlert("Izin Mikrofon Ditolak", "Mohon berikan izin akses mikrofon di browser Anda.", "warning");
        }
      };

      recognition.onend = () => {
        // Jika pengguna belum menekan tombol stop, otomatis lanjutkan mendengarkan suara
        if (!shouldStopRecordingRef.current) {
          try {
            recognition.start();
            return;
          } catch (err) {}
        }
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Gagal memulai perekaman:", err);
      setIsRecording(false);
    }
  }

  function handleCitationClick(citation: CitationItem) {
    if (citation.source_type === "academic_web" || citation.doi || citation.journal_name) {
      // Buka Panel Bukti Ilmiah Web Akademik (Perplexity / Consensus style)
      setActiveAcademicCitation(citation);
      setHighlightQuote(citation.exact_quote);
      setIsPdfPanelOpen(true);
    } else {
      // Buka Mode Dokumen Fisik Lokal MyLibrary 1:1
      setActiveAcademicCitation(null);
      const doc = documents.find((d) => d.id === citation.document_id);
      if (doc) {
        setActiveDoc(doc);
      }
      setTargetPage(citation.page_number || 1);
      setHighlightQuote(citation.exact_quote);
      setIsPdfPanelOpen(true);
    }
    if (currentNav !== "workspace") {
      setCurrentNav("workspace");
    }
  }

  // Menyisipkan gambar/diagram langsung di tengah-tengah penjelasan ala paper ilmiah
  function injectFiguresIntoContent(text: string, figures?: FigureSnippet[]): string {
    if (!text || !figures || figures.length === 0) return text || "";
    // Pisahkan paragraf demi paragraf (\n\n)
    const paragraphs = text.split(/\n\n+/);
    if (paragraphs.length <= 1) {
      // Jika hanya 1 paragraf, tempatkan figure di bawahnya
      const figBlocks = figures.map((_, i) => `\n\n![FIG-${i}](#fig-${i})\n\n`).join("");
      return text + figBlocks;
    }

    // Sisipkan potongan gambar secara tersebar proporsional di tengah-tengah paragraf
    const result: string[] = [];
    const step = Math.max(1, Math.floor(paragraphs.length / (figures.length + 1)));
    let figIdx = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      result.push(paragraphs[i]);
      if ((i + 1) % step === 0 && figIdx < figures.length) {
        result.push(`![FIG-${figIdx}](#fig-${figIdx})`);
        figIdx++;
      }
    }

    // Jika masih ada figure tersisa yang belum disisipkan
    while (figIdx < figures.length) {
      result.push(`![FIG-${figIdx}](#fig-${figIdx})`);
      figIdx++;
    }

    return result.join("\n\n");
  }

  function formatInlineCitations(text: string): string {
    if (!text) return "";
    return text.replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (match, nums) => {
      const list = nums.split(",").map((n: string) => n.trim());
      return list.map((n: string) => `[${n}](#cite-${n})`).join(" ");
    });
  }

  // --- TAMPILAN JIKA BELUM LOGIN (AUTH SCREEN) ---
  if (!currentUser) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-200 font-claude-sans ${
        theme === "dark" ? "bg-[#12161A] text-[#E6EDF2]" : "bg-[#F7F9FA] text-[#12202B]"
      }`}>
        <div className={`w-full max-w-md rounded-2xl shadow-2xl p-6 sm:p-8 border transition-all ${
          theme === "dark"
            ? "bg-[#1B2127] border-[#2A333B] text-[#E6EDF2]"
            : "bg-[#FFFFFF] border-[#DCE3E8] text-[#12202B]"
        }`}>
          <div className="text-center mb-6">
            <div className={`inline-flex w-12 h-12 rounded-xl items-center justify-center font-extrabold text-2xl shadow-md mb-3 ${
              theme === "dark" ? "bg-[#34D3BE] text-[#12161A]" : "bg-[#0F766E] text-white"
            }`}>
              E
            </div>
            <h1 className={`text-2xl font-black tracking-tight font-claude-serif ${
              theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
            }`}>EPIONA</h1>
            <p className={`text-xs mt-1 ${
              theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
            }`}>
              Academic Literature Assistant & Dual-Pane Workspace
            </p>
          </div>

          {/* DUAL TAB SWITCHER */}
          <div className={`flex border-b mb-6 text-sm font-semibold ${
            theme === "dark" ? "border-[#2A333B]" : "border-[#DCE3E8]"
          }`}>
            <button
              onClick={() => {
                setAuthMode("login");
                setAuthError(null);
              }}
              className={`flex-1 pb-3 text-center transition border-b-2 cursor-pointer ${
                authMode === "login"
                  ? theme === "dark" ? "border-[#34D3BE] text-[#34D3BE] font-bold" : "border-[#0F766E] text-[#0F766E] font-bold"
                  : theme === "dark" ? "border-transparent text-[#9AA9B5] hover:text-[#E6EDF2]" : "border-transparent text-[#5B6B78] hover:text-[#12202B]"
              }`}
            >
              Masuk ke Sesi
            </button>
            <button
              onClick={() => {
                setAuthMode("register");
                setAuthError(null);
              }}
              className={`flex-1 pb-3 text-center transition border-b-2 cursor-pointer ${
                authMode === "register"
                  ? theme === "dark" ? "border-[#34D3BE] text-[#34D3BE] font-bold" : "border-[#0F766E] text-[#0F766E] font-bold"
                  : theme === "dark" ? "border-transparent text-[#9AA9B5] hover:text-[#E6EDF2]" : "border-transparent text-[#5B6B78] hover:text-[#12202B]"
              }`}
            >
              Daftar Akun Baru
            </button>
          </div>

          {authError && (
            <div className={`mb-4 p-3 border text-xs rounded-xl flex items-center gap-2 ${
              theme === "dark"
                ? "bg-rose-950/70 border-rose-800/80 text-rose-300"
                : "bg-rose-50 border-rose-200 text-rose-700"
            }`}>
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === "register" && (
              <div>
                <label className={`block text-xs font-bold mb-1 ${
                  theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
                }`}>Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={fullNameInput}
                  onChange={(e) => setFullNameInput(e.target.value)}
                  placeholder="Misal: Alin Pratama, S.Farm"
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-none transition ${
                    theme === "dark"
                      ? "bg-[#12161A] border-[#2A333B] text-[#E6EDF2] placeholder-[#9AA9B5]/60 focus:border-[#34D3BE]"
                      : "bg-[#F7F9FA] border-[#DCE3E8] text-[#12202B] placeholder-[#5B6B78]/60 focus:border-[#0F766E] focus:bg-white"
                  }`}
                />
              </div>
            )}

            <div>
              <label className={`block text-xs font-bold mb-1 ${
                theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
              }`}>Email Akademik</label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="nama@farmasi.ac.id"
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-none transition ${
                  theme === "dark"
                    ? "bg-[#12161A] border-[#2A333B] text-[#E6EDF2] placeholder-[#9AA9B5]/60 focus:border-[#34D3BE]"
                    : "bg-[#F7F9FA] border-[#DCE3E8] text-[#12202B] placeholder-[#5B6B78]/60 focus:border-[#0F766E] focus:bg-white"
                }`}
              />
            </div>

            <div>
              <label className={`block text-xs font-bold mb-1 ${
                theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
              }`}>Kata Sandi</label>
              <input
                type="password"
                required
                minLength={6}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Minimal 6 karakter"
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-none transition ${
                  theme === "dark"
                    ? "bg-[#12161A] border-[#2A333B] text-[#E6EDF2] placeholder-[#9AA9B5]/60 focus:border-[#34D3BE]"
                    : "bg-[#F7F9FA] border-[#DCE3E8] text-[#12202B] placeholder-[#5B6B78]/60 focus:border-[#0F766E] focus:bg-white"
                }`}
              />
            </div>

            <button
              type="submit"
              disabled={isAuthLoading}
              className={`w-full py-3 font-bold text-sm rounded-xl shadow-md transition disabled:opacity-50 mt-2 cursor-pointer ${
                theme === "dark"
                  ? "bg-[#34D3BE] text-[#12161A] hover:bg-[#34D3BE]/90"
                  : "bg-[#0F766E] text-white hover:bg-[#0F766E]/90"
              }`}
            >
              {isAuthLoading
                ? "Memproses..."
                : authMode === "login"
                ? "Masuk ke Dashboard"
                : "Daftar Akun Sekarang"}
            </button>
          </form>

          <div className={`mt-6 pt-5 border-t flex items-center justify-between text-xs ${
            theme === "dark" ? "border-[#2A333B] text-[#9AA9B5]" : "border-[#DCE3E8] text-[#5B6B78]"
          }`}>
            <span className="flex items-center gap-1">
              <ShieldCheck className={`w-4 h-4 ${theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"}`} />
              Isolasi Dokumen Multi-Tenant
            </span>
            <button
              onClick={() => {
                setEmailInput("guest@epiona.ac.id");
                setPasswordInput("guest123");
                setAuthMode("login");
              }}
              className={`hover:underline font-semibold cursor-pointer ${
                theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"
              }`}
            >
              Masuk Demo Tamu
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- TAMPILAN DASHBOARD UTAMA (SETELAH LOGIN) ---
  return (
    <div
      className={`flex h-screen font-claude-sans overflow-hidden transition-colors duration-200 ${
        theme === "dark"
          ? "bg-[#12161A] text-[#E6EDF2]"
          : "bg-[#F7F9FA] text-[#12202B]"
      }`}
    >
      {/* 1. SIDEBAR KIRI EPIONA (HANYA MUNCUL DI WORKSPACE CHAT) */}
      {currentNav === "workspace" && (
        <aside
          className={`${
            isLeftSidebarOpen ? "w-64" : "w-0"
          } ${
            theme === "dark"
              ? "bg-[#1B2127] border-[#2A333B] text-[#E6EDF2]"
              : "bg-[#FFFFFF] border-[#DCE3E8] text-[#12202B]"
          } border-r flex flex-col justify-between shrink-0 transition-all duration-200 overflow-hidden z-20 select-none`}
        >
          <div className="flex-1 flex flex-col min-h-0 w-64">
            {/* BRAND BAR & TOGGLE CLOSE */}
            <div className="px-3 pt-3 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-extrabold text-[11px] shadow-xs ${
                  theme === "dark" ? "bg-[#34D3BE] text-[#12161A]" : "bg-[#0F766E] text-white"
                }`}>
                  E
                </div>
                <span className={`font-bold text-xs tracking-tight font-claude-serif ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
                  Epiona Assistant
                </span>
              </div>
              <button
                onClick={() => setIsLeftSidebarOpen(false)}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  theme === "dark"
                    ? "text-[#9AA9B5] hover:text-[#E6EDF2] hover:bg-[#2A333B]"
                    : "text-[#5B6B78] hover:text-[#12202B] hover:bg-[#F7F9FA]"
                }`}
                title="Tutup sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>

            {/* NAVIGASI ATAS: PERCAKAPAN BARU, TELUSURI PERCAKAPAN, SEMUA NOTEBOOK */}
            <div className="px-2 py-1 space-y-0.5">
              {/* TOMBOL 1: PERCAKAPAN BARU */}
              <button
                onClick={handleNewChat}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                  theme === "dark"
                    ? "text-[#E6EDF2] hover:bg-[#2A333B]"
                    : "text-[#12202B] hover:bg-[#F7F9FA]"
                }`}
              >
                <SquarePen className={`w-4 h-4 shrink-0 ${theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"}`} />
                <span>Percakapan baru</span>
              </button>

              {/* TOMBOL 2: TELUSURI PERCAKAPAN */}
              <button
                onClick={() => setIsSearchingSessions(!isSearchingSessions)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                  isSearchingSessions
                    ? theme === "dark" ? "bg-[#2A333B] text-[#E6EDF2]" : "bg-[#F7F9FA] text-[#12202B]"
                    : theme === "dark" ? "text-[#9AA9B5] hover:bg-[#2A333B] hover:text-[#E6EDF2]" : "text-[#5B6B78] hover:bg-[#F7F9FA] hover:text-[#12202B]"
                }`}
              >
                <Search className={`w-4 h-4 shrink-0 ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`} />
                <span>Telusuri percakapan</span>
              </button>

              {/* INPUT SEARCH EXPANDABLE JIKA TELUSURI DIKLIK */}
              {isSearchingSessions && (
                <div className="px-1 pt-1 pb-1 animate-in fade-in duration-100">
                  <div className="relative">
                    <input
                      type="text"
                      autoFocus
                      value={sidebarSearchQuery}
                      onChange={(e) => setSidebarSearchQuery(e.target.value)}
                      placeholder="Ketik kata kunci percakapan..."
                      className={`w-full text-xs px-2.5 py-1.5 rounded-lg border focus:outline-none transition ${
                        theme === "dark"
                          ? "bg-[#12161A] border-[#2A333B] text-[#E6EDF2] placeholder-[#9AA9B5]/60 focus:border-[#34D3BE]"
                          : "bg-white border-[#DCE3E8] text-[#12202B] placeholder-[#5B6B78]/60 focus:border-[#0F766E]"
                      }`}
                    />
                    {sidebarSearchQuery && (
                      <button
                        onClick={() => setSidebarSearchQuery("")}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer ${
                          theme === "dark" ? "text-[#9AA9B5] hover:text-[#E6EDF2]" : "text-[#5B6B78] hover:text-[#12202B]"
                        }`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* TOMBOL 3: SEMUA NOTEBOOK (MYLIBRARY) */}
              <button
                onClick={() => setCurrentNav("library")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                  theme === "dark"
                    ? "text-[#9AA9B5] hover:bg-[#2A333B] hover:text-[#E6EDF2]"
                    : "text-[#5B6B78] hover:bg-[#F7F9FA] hover:text-[#12202B]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Folder className={`w-4 h-4 shrink-0 ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`} />
                  <span>Semua notebook</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                  theme === "dark" ? "bg-[#2A333B] text-[#9AA9B5]" : "bg-[#F7F9FA] text-[#5B6B78] border border-[#DCE3E8]"
                }`}>
                  {documents.length}
                </span>
              </button>

              {/* TOMBOL 4: KHUSUS ADMIN & DEVELOPER CONSOLE */}
              {currentUser?.role === "admin" && (
                <button
                  onClick={() => setCurrentNav("admin")}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    (currentNav as string) === "admin"
                      ? "bg-rose-500/15 text-rose-500 border border-rose-500/30 font-bold"
                      : theme === "dark"
                      ? "text-rose-400 hover:bg-[#2A333B] hover:text-rose-300"
                      : "text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-4 h-4 shrink-0 text-rose-500" />
                    <span>Admin &amp; Dev Center</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-bold tracking-wider">
                    ADMIN
                  </span>
                </button>
              )}
            </div>

            {/* DAFTAR RIWAYAT PERCAKAPAN (KATEGORI: TERBARU) */}
            <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-thin">
              <div className={`px-3 pt-3 pb-1.5 text-xs font-medium ${
                theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
              }`}>
                Terbaru
              </div>

              {chatSessions.length === 0 ? (
                <div className="px-3 py-8 text-center">
                  <MessageSquare className={`w-5 h-5 mx-auto mb-2 opacity-30 ${
                    theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                  }`} />
                  <p className={`text-xs ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>Belum ada percakapan</p>
                  <p className={`text-[10px] mt-1 ${theme === "dark" ? "text-[#9AA9B5]/80" : "text-[#5B6B78]/80"}`}>Mulai obrolan baru dengan asisten</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {chatSessions
                    .filter((s) => s.title.toLowerCase().includes(sidebarSearchQuery.toLowerCase()))
                    .map((sess) => {
                      const isActive = currentSessionId === sess.id;
                      const isEditing = editingSessionId === sess.id;

                      if (isEditing) {
                        return (
                          <div
                            key={sess.id}
                            className={`p-1.5 rounded-xl border ${
                              theme === "dark" ? "bg-[#12161A] border-[#34D3BE]" : "bg-white border-[#0F766E]"
                            }`}
                          >
                            <input
                              type="text"
                              autoFocus
                              value={editingSessionTitle}
                              onChange={(e) => setEditingSessionTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleRenameSession(sess.id, editingSessionTitle);
                                } else if (e.key === "Escape") {
                                  setEditingSessionId(null);
                                }
                              }}
                              className={`w-full text-xs px-2 py-1 rounded bg-transparent focus:outline-none ${
                                theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
                              }`}
                            />
                            <div className="flex items-center justify-end gap-1.5 mt-1 px-1">
                              <button
                                onClick={() => setEditingSessionId(null)}
                                className={`text-[10px] px-1.5 py-0.5 cursor-pointer ${
                                  theme === "dark" ? "text-[#9AA9B5] hover:text-[#E6EDF2]" : "text-[#5B6B78] hover:text-[#12202B]"
                                }`}
                              >
                                Batal
                              </button>
                              <button
                                onClick={() => handleRenameSession(sess.id, editingSessionTitle)}
                                className={`text-[10px] px-2 py-0.5 rounded font-bold cursor-pointer ${
                                  theme === "dark" ? "bg-[#34D3BE] text-[#12161A]" : "bg-[#0F766E] text-white"
                                }`}
                              >
                                Simpan
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={sess.id}
                          onClick={() => handleSelectSession(sess.id)}
                          className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition relative ${
                            isActive
                              ? theme === "dark"
                                ? "bg-[#2A333B] text-[#E6EDF2] font-semibold shadow-xs"
                                : "bg-[#F7F9FA] text-[#12202B] font-semibold border border-[#DCE3E8] shadow-xs"
                              : theme === "dark"
                              ? "text-[#9AA9B5] hover:bg-[#2A333B]/70 hover:text-[#E6EDF2]"
                              : "text-[#5B6B78] hover:bg-[#F7F9FA] hover:text-[#12202B]"
                          }`}
                        >
                          <span className="truncate flex-1 pr-1.5 text-xs tracking-tight" title={sess.title}>
                            {sess.title}
                          </span>

                          {/* TOMBOL TITIK 3 (MORE) */}
                          <div className="relative shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveSessionMenuId(activeSessionMenuId === sess.id ? null : sess.id);
                              }}
                              className={`p-1 rounded-md transition cursor-pointer ${
                                isActive
                                  ? theme === "dark" ? "opacity-100 text-[#E6EDF2] hover:bg-[#12161A]/60" : "opacity-100 text-[#12202B] hover:bg-white"
                                  : theme === "dark" ? "opacity-0 group-hover:opacity-100 text-[#9AA9B5] hover:text-[#E6EDF2] hover:bg-[#12161A]/60" : "opacity-0 group-hover:opacity-100 text-[#5B6B78] hover:text-[#12202B] hover:bg-white"
                              }`}
                              title="Opsi percakapan"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {/* POPUP MENU TITIK 3 */}
                            {activeSessionMenuId === sess.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className={`absolute right-0 top-full mt-1 w-36 rounded-xl shadow-xl z-30 py-1 text-xs border animate-in fade-in duration-100 ${
                                  theme === "dark"
                                    ? "bg-[#1B2127] border-[#2A333B] text-[#E6EDF2]"
                                    : "bg-white border-[#DCE3E8] text-[#12202B]"
                                }`}
                              >
                                <button
                                  onClick={() => {
                                    setActiveSessionMenuId(null);
                                    setEditingSessionId(sess.id);
                                    setEditingSessionTitle(sess.title);
                                  }}
                                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition font-medium cursor-pointer ${
                                    theme === "dark" ? "hover:bg-[#2A333B]" : "hover:bg-[#F7F9FA]"
                                  }`}
                                >
                                  <SquarePen className={`w-3.5 h-3.5 ${theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"}`} />
                                  <span>Ubah nama</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    setActiveSessionMenuId(null);
                                    handleDeleteSession(sess.id, e);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-rose-500 hover:bg-rose-500/10 transition font-medium cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                  <span>Hapus</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          {/* FOOTER PENGGUNA PERSIS SEPERTI SCREENSHOT */}
          <div className={`p-3 border-t ${
            theme === "dark"
              ? "border-[#2A333B] bg-[#12161A]"
              : "border-[#DCE3E8] bg-[#F7F9FA]"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 overflow-hidden flex-1 cursor-pointer" onClick={() => setCurrentNav("dashboard")}>
                {/* AVATAR BULAT */}
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                  {currentUser.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="overflow-hidden">
                  <p className={`text-xs font-semibold truncate leading-tight ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
                    {currentUser.full_name}
                  </p>
                  <span className={`text-[10px] font-semibold block ${
                    currentUser.role === "admin"
                      ? "text-rose-500 font-bold"
                      : theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                  }`}>
                    {currentUser.role === "admin" ? "Administrator & Dev" : "Pro"}
                  </span>
                </div>
              </div>

              {/* TOMBOL PENGATURAN (GEAR) */}
              <div className="flex items-center gap-1">
                <button
                  onClick={handleLogout}
                  title="Keluar / Pengaturan Akun"
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    theme === "dark"
                      ? "text-[#9AA9B5] hover:text-[#E6EDF2] hover:bg-[#2A333B]"
                      : "text-[#5B6B78] hover:text-[#12202B] hover:bg-[#FFFFFF]"
                  }`}
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* 2. AREA KONTEN (WORKSPACE ATAU MYLIBRARY) */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".pdf"
          multiple
          className="hidden"
        />

        {/* ======================================================== */}
        {/* TAMPILAN MENU DASHBOARD BERANDA (PILIHAN KARTU FITUR)     */}
        {/* ======================================================== */}
        {currentNav === "dashboard" && (
          <div className="flex-1 overflow-y-auto w-full h-full">
            {/* TOP HEADER NAVBAR (STICKY AT VERY TOP, FULL WIDTH) */}
            <div className={`border-b transition-colors ${
              theme === "dark" ? "bg-[#1B2127]/95 border-[#2A333B]" : "bg-white/95 border-[#E2E8F0]"
            } backdrop-blur-md sticky top-0 z-20`}>
              <div className="flex h-16 w-full items-center justify-between px-6 sm:px-10 lg:px-12">
                {/* Brand Logo - EPIONA PharmSimulator */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-xs ${
                    theme === "dark"
                      ? "bg-[#34D3BE] text-[#12161A]"
                      : "bg-gradient-to-tr from-[#0F766E] to-[#14B8A6] text-white"
                  }`}>
                    <Pill className="h-5 w-5 rotate-45" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-base sm:text-lg font-bold tracking-tight font-claude-serif ${
                        theme === "dark" ? "text-[#E6EDF2]" : "text-[#0F766E]"
                      }`}>
                        EPIONA
                      </span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        theme === "dark"
                          ? "bg-[#34D3BE]/15 text-[#34D3BE] border border-[#34D3BE]/30"
                          : "bg-[#CCFBF1] text-[#0F766E]"
                      }`}>
                        PharmSimulator
                      </span>
                    </div>
                    <p className={`hidden sm:block text-[10px] font-medium leading-none ${
                      theme === "dark" ? "text-[#9AA9B5]" : "text-[#71717A]"
                    }`}>
                      Laboratorium Farmasi Klinis AI
                    </p>
                  </div>
                </div>

                {/* Navigasi Menu Tengah (Tab Pintas) */}
                <nav className={`hidden md:flex items-center gap-6 text-xs font-semibold ${
                  theme === "dark" ? "text-[#9AA9B5]" : "text-[#52525B]"
                }`}>
                  <button
                    onClick={() => setCurrentNav("workspace")}
                    className={`transition hover:text-[#0F766E] cursor-pointer ${
                      theme === "dark" ? "hover:text-[#34D3BE]" : "hover:text-[#0F766E]"
                    }`}
                  >
                    AI Assistant
                  </button>
                  <button
                    onClick={() => setCurrentNav("library")}
                    className={`transition hover:text-[#0F766E] cursor-pointer ${
                      theme === "dark" ? "hover:text-[#34D3BE]" : "hover:text-[#0F766E]"
                    }`}
                  >
                    MyLibrary ({documents.length})
                  </button>
                  {currentUser?.role === "admin" && (
                    <button
                      onClick={() => setCurrentNav("admin")}
                      className={`flex items-center gap-1.5 transition cursor-pointer font-bold ${
                        (currentNav as string) === "admin"
                          ? "text-rose-500"
                          : theme === "dark" ? "text-rose-400 hover:text-rose-300" : "text-rose-600 hover:text-rose-700"
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />
                      <span>Admin &amp; Dev Center</span>
                    </button>
                  )}
                </nav>

                {/* Action Buttons Kanan (Theme & Tombol Profil Akun) */}
                <div className="flex items-center gap-2.5">
                  {/* Theme Switcher Button */}
                  <button
                    onClick={toggleTheme}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
                      theme === "dark"
                        ? "border-[#2A333B] bg-[#12161A] text-amber-300 hover:bg-[#2A333B]"
                        : "border-[#CBD5E1] bg-white text-[#12202B] hover:bg-[#F8FAFC]"
                    }`}
                    title={theme === "dark" ? "Mode Terang" : "Mode Gelap"}
                  >
                    {theme === "dark" ? (
                      <>
                        <Sun className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-[11px] hidden sm:inline text-[#E6EDF2]">Terang</span>
                      </>
                    ) : (
                      <>
                        <Moon className="w-3.5 h-3.5 text-[#5B6B78]" />
                        <span className="text-[11px] hidden sm:inline text-[#5B6B78]">Gelap</span>
                      </>
                    )}
                  </button>

                  {/* Tombol Profil Akun & Pengaturan (Menggantikan Buka Workspace) */}
                  <button
                    onClick={() => setIsProfileModalOpen(true)}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-1.5 text-xs font-semibold shadow-xs transition hover:shadow-sm cursor-pointer ${
                      theme === "dark"
                        ? "border-[#2A333B] bg-[#1B2127] hover:bg-[#2A333B] text-[#E6EDF2]"
                        : "border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-[#12202B]"
                    }`}
                    title="Buka Pengaturan Akun"
                  >
                    <div className="w-6 h-6 rounded-lg bg-teal-600 text-white font-bold flex items-center justify-center text-[11px] shadow-xs">
                      {currentUser.full_name ? currentUser.full_name.charAt(0).toUpperCase() : "U"}
                    </div>
                    <div className="text-left hidden sm:block">
                      <div className="leading-tight font-bold">{currentUser.full_name.split(" ")[0]}</div>
                      <div className={`text-[10px] font-normal leading-tight ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#71717A]"}`}>
                        Pengaturan Akun
                      </div>
                    </div>
                    <Settings className={`w-3.5 h-3.5 ml-0.5 ${theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* DASHBOARD CONTENT CONTAINER */}
            <div className="px-6 sm:px-10 lg:px-12 space-y-6 pt-6 pb-12">

            {/* DUA MODUL FITUR UTAMA (ASSISTANT & MYLIBRARY) */}
            <div className={`grid grid-cols-1 ${currentUser?.role === "admin" ? "md:grid-cols-3" : "md:grid-cols-2"} gap-4 sm:gap-6`}>
              {/* MODUL 1: WORKSPACE AI ASSISTANT */}
              <div
                onClick={() => {
                  setCurrentNav("workspace");
                  setIsPdfPanelOpen(false);
                }}
                className={`group border rounded-3xl p-6 sm:p-7 transition-all duration-200 shadow-2xs hover:shadow-lg cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                  theme === "dark"
                    ? "bg-[#1B2127] border-[#2A333B] hover:border-[#34D3BE]"
                    : "bg-white border-[#DCE3E8] hover:border-[#0F766E]"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3.5">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform ${
                        theme === "dark" ? "bg-[#34D3BE] text-[#12161A]" : "bg-gradient-to-tr from-[#0F766E] to-[#14B8A6] text-white"
                      }`}>
                        <MessageSquare className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className={`text-lg sm:text-xl font-bold tracking-tight font-claude-serif transition ${
                          theme === "dark" ? "text-[#E6EDF2] group-hover:text-[#34D3BE]" : "text-[#12202B] group-hover:text-[#0F766E]"
                        }`}>
                          Workspace AI Assistant
                        </h2>
                        <span className={`text-xs font-medium block ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                          {chatSessions.length} sesi dialog akademik aktif
                        </span>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                      theme === "dark" ? "bg-[#34D3BE]/15 text-[#34D3BE] border-[#34D3BE]/30" : "bg-[#0F766E]/10 text-[#0F766E] border-[#0F766E]/20"
                    }`}>
                      Riset & Sitasi
                    </span>
                  </div>

                  <p className={`text-xs sm:text-sm leading-relaxed mb-6 ${
                    theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                  }`}>
                    Tanya jawab literatur farmasi, interaksi obat, dan modul kuliah dengan verifikasi kutipan halaman fisik 1:1 serta integrasi pencarian jurnal akademik PubMed &amp; arXiv.
                  </p>
                </div>

                <div className={`flex items-center justify-between pt-4 border-t text-xs font-semibold ${
                  theme === "dark" ? "border-[#2A333B] text-[#34D3BE]" : "border-[#DCE3E8] text-[#0F766E]"
                }`}>
                  <span className="flex items-center gap-1.5">
                    <span>Mulai Percakapan Baru</span>
                  </span>
                  <div className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    <span>Buka Workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* MODUL 2: MYLIBRARY (PUSTAKA DOKUMEN & MODUL PRIBADI) */}
              <div
                onClick={() => setCurrentNav("library")}
                className={`group border rounded-3xl p-6 sm:p-7 transition-all duration-200 shadow-2xs hover:shadow-lg cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                  theme === "dark"
                    ? "bg-[#1B2127] border-[#2A333B] hover:border-[#34D3BE]"
                    : "bg-white border-[#DCE3E8] hover:border-[#0F766E]"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3.5">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform ${
                        theme === "dark" ? "bg-[#2A333B] text-[#34D3BE] border border-[#34D3BE]/30" : "bg-teal-50 text-[#0F766E] border border-teal-200"
                      }`}>
                        <Library className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className={`text-lg sm:text-xl font-bold tracking-tight font-claude-serif transition ${
                          theme === "dark" ? "text-[#E6EDF2] group-hover:text-[#34D3BE]" : "text-[#12202B] group-hover:text-[#0F766E]"
                        }`}>
                          MyLibrary
                        </h2>
                        <span className={`text-xs font-medium block ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                          {documents.length} dokumen tersimpan & terindeks
                        </span>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                      theme === "dark" ? "bg-[#2A333B] text-[#9AA9B5] border-[#2A333B]" : "bg-[#F7F9FA] text-[#5B6B78] border-[#DCE3E8]"
                    }`}>
                      Pustaka Digital
                    </span>
                  </div>

                  <p className={`text-xs sm:text-sm leading-relaxed mb-6 ${
                    theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                  }`}>
                    Kelola koleksi e-book, diktat kuliah, formularium obat, dan jurnal pribadi Anda dengan pratinjau lembaran instan dan kontrol penghapusan aman.
                  </p>
                </div>

                <div className={`flex items-center justify-between pt-4 border-t text-xs font-semibold ${
                  theme === "dark" ? "border-[#2A333B] text-[#34D3BE]" : "border-[#DCE3E8] text-[#0F766E]"
                }`}>
                  <span className="flex items-center gap-1.5">
                    <span>Kelola & Cari Dokumen</span>
                  </span>
                  <div className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    <span>Buka MyLibrary</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* MODUL 3: KHUSUS ADMIN & DEVELOPER CONSOLE */}
              {currentUser?.role === "admin" && (
                <div
                  onClick={() => setCurrentNav("admin")}
                  className={`group border rounded-3xl p-6 sm:p-7 transition-all duration-200 shadow-2xs hover:shadow-lg cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                    theme === "dark"
                      ? "bg-[#1B2127] border-[#2A333B] hover:border-rose-500"
                      : "bg-white border-[#DCE3E8] hover:border-rose-500"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform bg-gradient-to-tr from-rose-600 to-amber-500 text-white">
                          <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                          <h2 className={`text-lg sm:text-xl font-bold tracking-tight font-claude-serif transition ${
                            theme === "dark" ? "text-[#E6EDF2] group-hover:text-rose-400" : "text-[#12202B] group-hover:text-rose-600"
                          }`}>
                            Admin &amp; Dev Center
                          </h2>
                          <span className="text-xs font-medium text-rose-500 block">
                            Live User Monitor &amp; VPS
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border bg-rose-500/10 text-rose-500 border-rose-500/20">
                        Pusat Kendali
                      </span>
                    </div>

                    <p className={`text-xs sm:text-sm leading-relaxed mb-6 ${
                      theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                    }`}>
                      Pantau aktivitas user secara real-time (pertanyaan, upload, login), inspeksi riwayat chat setiap pengguna, kelola status akun, dan audit log VPS server.
                    </p>
                  </div>

                  <div className={`flex items-center justify-between pt-4 border-t text-xs font-semibold ${
                    theme === "dark" ? "border-[#2A333B] text-rose-400" : "border-[#DCE3E8] text-rose-600"
                  }`}>
                    <span className="flex items-center gap-1.5">
                      <span>Buka Panel Pengawasan</span>
                    </span>
                    <div className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      <span>Admin Console</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* DUA SEKSI UTAMA: DOKUMEN & SESI TERAKHIR */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* KOLOM 1 & 2: DOKUMEN TERBARU DI MYLIBRARY */}
              <div className={`lg:col-span-2 rounded-xl border p-5 shadow-2xs ${
                theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
              }`}>
                <div className={`flex items-center justify-between pb-3 mb-4 border-b ${
                  theme === "dark" ? "border-[#2A333B]" : "border-[#DCE3E8]"
                }`}>
                  <div className="flex items-center gap-2">
                    <FileText className={`w-4 h-4 ${theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"}`} />
                    <h2 className={`text-sm font-bold uppercase tracking-wider font-claude-sans ${
                      theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
                    }`}>
                      Dokumen Terkini
                    </h2>
                  </div>
                  <button
                    onClick={() => setCurrentNav("library")}
                    className={`text-xs font-semibold hover:underline cursor-pointer ${
                      theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"
                    }`}
                  >
                    Buka Pustaka ({documents.length})
                  </button>
                </div>

                {documents.length === 0 ? (
                  <div className={`py-12 text-center rounded-lg border border-dashed ${
                    theme === "dark" ? "border-[#2A333B] text-[#9AA9B5]" : "border-[#DCE3E8] text-[#5B6B78]"
                  }`}>
                    <p className="text-xs mb-3">Belum ada modul atau jurnal yang diunggah.</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg border cursor-pointer transition ${
                        theme === "dark"
                          ? "border-[#34D3BE] text-[#34D3BE] hover:bg-[#34D3BE]/10"
                          : "border-[#0F766E] text-[#0F766E] hover:bg-teal-50"
                      }`}
                    >
                      Unggah Dokumen PDF
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {documents.slice(0, 5).map((doc) => (
                      <div
                        key={doc.id}
                        onClick={() => openDocumentPreview(doc)}
                        className={`flex items-center justify-between p-3 rounded-lg border transition cursor-pointer group ${
                          theme === "dark"
                            ? "bg-[#12161A] border-[#2A333B] hover:border-[#34D3BE]"
                            : "bg-[#F7F9FA] border-[#DCE3E8] hover:border-[#0F766E]"
                        }`}
                      >
                        <div className="flex items-center gap-3 overflow-hidden flex-1 pr-3">
                          <FileFormatIcon filename={doc.filename || doc.title} size="md" />
                          <div className="overflow-hidden">
                            <p className={`text-xs font-semibold truncate transition ${
                              theme === "dark" ? "text-[#E6EDF2] group-hover:text-[#34D3BE]" : "text-[#12202B] group-hover:text-[#0F766E]"
                            }`} title={doc.title}>
                              {doc.title}
                            </p>
                            <span className={`text-[10px] block ${
                              theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                            }`}>
                              {doc.total_pages} Halaman • {(doc.file_size_bytes / 1024 / 1024).toFixed(1)} MB
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDoc(doc);
                              setTargetPage(1);
                              setHighlightQuote(null);
                              setIsPdfPanelOpen(true);
                              setCurrentNav("workspace");
                            }}
                            className={`p-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                              theme === "dark"
                                ? "bg-[#1B2127] text-[#34D3BE] border border-[#2A333B] hover:border-[#34D3BE]"
                                : "bg-white text-[#0F766E] border border-[#DCE3E8] hover:border-[#0F766E]"
                            }`}
                            title="Bahas dokumen ini di Workspace"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* KOLOM 3: PERCAKAPAN TERBARU & AKSES CEPAT */}
              <div className={`rounded-xl border p-5 shadow-2xs flex flex-col justify-between ${
                theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
              }`}>
                <div>
                  <div className={`flex items-center justify-between pb-3 mb-4 border-b ${
                    theme === "dark" ? "border-[#2A333B]" : "border-[#DCE3E8]"
                  }`}>
                    <div className="flex items-center gap-2">
                      <MessageSquare className={`w-4 h-4 ${theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"}`} />
                      <h2 className={`text-sm font-bold uppercase tracking-wider font-claude-sans ${
                        theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
                      }`}>
                        Sesi Terbaru
                      </h2>
                    </div>
                    <button
                      onClick={handleNewChat}
                      className={`text-xs font-bold hover:underline cursor-pointer ${
                        theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"
                      }`}
                    >
                      + Sesi Baru
                    </button>
                  </div>

                  {chatSessions.length === 0 ? (
                    <div className={`py-8 text-center text-xs ${
                      theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                    }`}>
                      Belum ada sesi riset tersimpan.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {chatSessions.slice(0, 4).map((s) => (
                        <div
                          key={s.id}
                          onClick={() => {
                            handleSelectSession(s.id);
                            setCurrentNav("workspace");
                          }}
                          className={`p-2.5 rounded-lg border transition cursor-pointer text-xs group ${
                            theme === "dark"
                              ? "bg-[#12161A] border-[#2A333B] hover:border-[#34D3BE]"
                              : "bg-[#F7F9FA] border-[#DCE3E8] hover:border-[#0F766E]"
                          }`}
                        >
                          <p className={`font-semibold truncate transition ${
                            theme === "dark" ? "text-[#E6EDF2] group-hover:text-[#34D3BE]" : "text-[#12202B] group-hover:text-[#0F766E]"
                          }`}>
                            {s.title}
                          </p>
                          <span className={`text-[10px] block mt-0.5 ${
                            theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                          }`}>
                            {new Date(s.updated_at || s.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className={`pt-4 mt-6 border-t text-[11px] text-center ${
                  theme === "dark" ? "border-[#2A333B] text-[#9AA9B5]/80" : "border-[#DCE3E8] text-[#5B6B78]"
                }`}>
                  EPIONA Pharmacy Research Platform
                </div>
              </div>
            </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAMPILAN MENU MYLIBRARY (PENGELOLAAN DOKUMEN PRIBADI)   */}
        {/* ======================================================== */}
        {currentNav === "library" && (
          <div className="flex-1 overflow-y-auto w-full h-full px-6 sm:px-10 lg:px-16 py-8">
            <div className={`flex items-center justify-between mb-6 pb-4 border-b ${
              theme === "dark" ? "border-[#2A333B]" : "border-[#DCE3E8]"
            }`}>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentNav("dashboard")}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition shadow-xs cursor-pointer ${
                    theme === "dark"
                      ? "border-[#2A333B] bg-[#1B2127] hover:bg-[#2A333B] text-[#E6EDF2]"
                      : "border-[#DCE3E8] bg-white hover:bg-[#F7F9FA] text-[#12202B]"
                  }`}
                  title="Kembali ke Beranda Dashboard"
                >
                  <ArrowLeft className={`w-4 h-4 ${theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"}`} />
                  <span>Kembali ke Beranda</span>
                </button>
                <div>
                  <h2 className={`text-xl font-bold font-claude-serif ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
                    Perpustakaan Saya (MyLibrary)
                  </h2>
                  <p className={`text-xs mt-0.5 ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                    Materi e-book, diktat, dan slide yang terisolasi khusus untuk akun Anda.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Theme Switcher Button */}
                <button
                  onClick={toggleTheme}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition cursor-pointer ${
                    theme === "dark"
                      ? "border-[#2A333B] bg-[#1B2127] text-amber-300 hover:bg-[#2A333B]"
                      : "border-[#DCE3E8] bg-white text-[#12202B] hover:bg-[#F7F9FA]"
                  }`}
                  title={theme === "dark" ? "Ganti ke Mode Terang (Light)" : "Ganti ke Mode Gelap (Dark)"}
                >
                  {theme === "dark" ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[11px] hidden sm:inline text-[#E6EDF2]">Terang</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 text-[#5B6B78]" />
                      <span className="text-[11px] hidden sm:inline text-[#5B6B78]">Gelap</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setCurrentNav("workspace");
                    setIsPdfPanelOpen(false);
                  }}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition cursor-pointer ${
                    theme === "dark"
                      ? "bg-[#2A333B] hover:bg-[#2A333B]/80 text-[#E6EDF2] border border-[#2A333B]"
                      : "bg-[#12202B] hover:bg-[#12202B]/90 text-white"
                  }`}
                >
                  <MessageSquare className={`w-3.5 h-3.5 ${theme === "dark" ? "text-[#34D3BE]" : "text-teal-400"}`} />
                  <span>Masuk Workspace AI</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className={`flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer ${
                    theme === "dark"
                      ? "bg-[#34D3BE] text-[#12161A] hover:bg-[#34D3BE]/90"
                      : "bg-[#0F766E] text-white hover:bg-[#0F766E]/90"
                  }`}
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>{isUploading ? "Mengindeks..." : "Unggah Buku / Modul"}</span>
                </button>
              </div>
            </div>

            {uploadNotice && (
              <div className={`mb-6 p-4 rounded-xl text-xs flex items-center gap-3 shadow-sm border ${
                theme === "dark"
                  ? "bg-[#34D3BE]/10 border-[#34D3BE]/30 text-[#34D3BE]"
                  : "bg-teal-50 border-teal-200 text-[#0F766E]"
              }`}>
                <CheckCircle2 className={`w-5 h-5 shrink-0 ${theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"}`} />
                <span className="font-medium">{uploadNotice}</span>
              </div>
            )}

            {/* JIKA MYLIBRARY KOSONG */}
            {documents.length === 0 ? (
              <div className={`border-2 border-dashed rounded-2xl p-12 text-center shadow-sm flex flex-col items-center justify-center my-8 ${
                theme === "dark"
                  ? "bg-[#1B2127] border-[#2A333B] text-[#E6EDF2]"
                  : "bg-white border-[#DCE3E8] text-[#12202B]"
              }`}>
                <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center mb-4 ${
                  theme === "dark"
                    ? "bg-[#34D3BE]/10 border-[#34D3BE]/30 text-[#34D3BE]"
                    : "bg-teal-50 border-teal-200 text-[#0F766E]"
                }`}>
                  <BookOpen className="w-8 h-8" />
                </div>
                <h3 className={`font-bold text-base font-claude-serif ${
                  theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
                }`}>
                  MyLibrary Anda Masih Kosong
                </h3>
                <p className={`text-xs max-w-md mt-1 mb-6 ${
                  theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                }`}>
                  Anda belum mengunggah e-book atau modul farmasi apa pun. Unggah dokumen PDF pertama Anda untuk mulai belajar dan bertanya ke asisten.
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className={`flex items-center gap-2 text-xs font-bold px-5 py-3 rounded-xl shadow-md transition cursor-pointer ${
                    theme === "dark"
                      ? "bg-[#34D3BE] text-[#12161A] hover:bg-[#34D3BE]/90"
                      : "bg-[#0F766E] text-white hover:bg-[#0F766E]/90"
                  }`}
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Unggah PDF Pertama Sekarang</span>
                </button>
              </div>
            ) : (
              <div>
                {/* SEARCH FILTER DOKUMEN MYLIBRARY */}
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${
                      theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                    }`} />
                    <input
                      type="text"
                      value={librarySearch}
                      onChange={(e) => setLibrarySearch(e.target.value)}
                      placeholder="Cari buku atau modul farmasi..."
                      className={`w-full border rounded-xl pl-9 pr-8 py-2 text-xs font-medium focus:outline-none transition shadow-xs ${
                        theme === "dark"
                          ? "bg-[#1B2127] border-[#2A333B] text-[#E6EDF2] placeholder-[#9AA9B5]/60 focus:border-[#34D3BE]"
                          : "bg-white border-[#DCE3E8] text-[#12202B] placeholder-[#5B6B78]/60 focus:border-[#0F766E]"
                      }`}
                    />
                    {librarySearch && (
                      <button
                        onClick={() => setLibrarySearch("")}
                        className={`absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer ${
                          theme === "dark" ? "text-[#9AA9B5] hover:text-[#E6EDF2]" : "text-[#5B6B78] hover:text-[#12202B]"
                        }`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className={`text-xs font-medium hidden sm:block ${
                    theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                  }`}>
                    Menampilkan {documents.filter((d) => d.title.toLowerCase().includes(librarySearch.toLowerCase())).length} dari {documents.length} dokumen
                  </div>
                </div>

                {documents.filter((d) => d.title.toLowerCase().includes(librarySearch.toLowerCase())).length === 0 ? (
                  <div className={`p-8 text-center rounded-2xl border text-xs my-4 ${
                    theme === "dark" ? "bg-[#1B2127] border-[#2A333B] text-[#9AA9B5]" : "bg-white border-[#DCE3E8] text-[#5B6B78]"
                  }`}>
                    Tidak ditemukan dokumen dengan judul "{librarySearch}".
                  </div>
                ) : (
                  /* GRID DOKUMEN YANG DIMILIKI (TAMPILAN KARTU KOMPAK & IKON RESMI OTENTIK) */
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
                    {documents
                      .filter((d) => d.title.toLowerCase().includes(librarySearch.toLowerCase()))
                      .map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => openDocumentPreview(doc)}
                    className={`group border rounded-xl p-2.5 transition flex flex-col justify-between shadow-2xs hover:shadow-md cursor-pointer relative ${
                      theme === "dark"
                        ? "bg-[#1B2127] hover:bg-[#2A333B]/60 border-[#2A333B] hover:border-[#34D3BE]"
                        : "bg-white hover:bg-[#F7F9FA] border-[#DCE3E8] hover:border-[#0F766E]"
                    }`}
                  >
                    <div>
                      {/* HEADER KARTU: IKON OTENTIK FORMAT DOKUMEN + JUDUL + MENU TITIK 3 */}
                      <div className="flex items-center justify-between gap-1.5 mb-2 px-0.5">
                        <div className="flex items-center gap-2 overflow-hidden flex-1">
                          {/* IKON VEKTOR RESMI OTENTIK (PDF / WORD / EXCEL / PPT / TEXT) */}
                          <FileFormatIcon filename={doc.filename || doc.title} size="sm" />
                          <h4
                            className={`font-semibold text-xs transition truncate ${
                              theme === "dark" ? "text-[#E6EDF2] group-hover:text-[#34D3BE]" : "text-[#12202B] group-hover:text-[#0F766E]"
                            }`}
                            title={doc.title}
                          >
                            {doc.title}
                          </h4>
                        </div>

                        {/* MENU TITIK 3: OPSI UNDUH & HAPUS */}
                        <div className="relative shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuDocId(activeMenuDocId === doc.id ? null : doc.id);
                            }}
                            className={`p-1 rounded-md transition cursor-pointer ${
                              theme === "dark"
                                ? "text-[#9AA9B5] hover:text-[#E6EDF2] hover:bg-[#2A333B]"
                                : "text-[#5B6B78] hover:text-[#12202B] hover:bg-[#F7F9FA]"
                            }`}
                            title="Menu opsi dokumen"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>

                          {activeMenuDocId === doc.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className={`absolute right-0 top-full mt-1 w-44 rounded-xl shadow-xl z-30 py-1 text-xs border ${
                                theme === "dark"
                                  ? "bg-[#1B2127] border-[#2A333B] text-[#E6EDF2]"
                                  : "bg-white border-[#DCE3E8] text-[#12202B]"
                              }`}
                            >
                              <a
                                href={`${API_BASE}/api/v1/documents/${doc.id}/pdf?download=1&token=${currentUser.token}`}
                                download={doc.filename}
                                onClick={() => setActiveMenuDocId(null)}
                                className={`flex items-center gap-2.5 px-3 py-2 transition font-medium ${
                                  theme === "dark"
                                    ? "text-[#E6EDF2] hover:bg-[#2A333B] hover:text-[#34D3BE]"
                                    : "text-[#12202B] hover:bg-[#F7F9FA] hover:text-[#0F766E]"
                                }`}
                              >
                                <Download className="w-3.5 h-3.5 text-[#9AA9B5]" />
                                <span>Unduh Dokumen</span>
                              </a>
                              <button
                                onClick={(e) => {
                                  setActiveMenuDocId(null);
                                  handleDeleteDocument(doc.id, doc.title, e);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-500 hover:bg-rose-500/10 transition font-medium text-left cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                <span>Hapus Referensi</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* BADAN KARTU: THUMBNAIL PREVIEW HALAMAN 1 (UKURAN KOMPAK & SEIMBANG) */}
                      <div className={`rounded-lg border overflow-hidden shadow-inner aspect-[4/3] max-h-36 sm:max-h-40 flex flex-col items-center justify-center relative p-1 transition ${
                        theme === "dark"
                          ? "bg-[#12161A] border-[#2A333B] group-hover:border-[#34D3BE]"
                          : "bg-white border-[#DCE3E8] group-hover:border-[#0F766E]"
                      }`}>
                        {doc.thumbnail_url ? (
                          <img
                            src={`${API_BASE}${doc.thumbnail_url}`}
                            alt={`Sampul ${doc.title}`}
                            className={`w-full h-full object-contain object-top rounded-md ${
                              theme === "dark" ? "bg-[#12161A]" : "bg-white"
                            }`}
                            loading="lazy"
                          />
                        ) : (
                          /* FALLBACK MOCKUP DOKUMEN */
                          <div className={`w-full h-full p-2.5 text-[9.5px] overflow-hidden flex flex-col justify-between leading-snug ${
                            theme === "dark" ? "bg-[#12161A] text-[#9AA9B5]" : "bg-white text-[#5B6B78]"
                          }`}>
                            <div className={`border-b pb-1 font-bold truncate ${
                              theme === "dark" ? "border-[#2A333B] text-[#E6EDF2]" : "border-[#DCE3E8] text-[#12202B]"
                            }`}>
                              {doc.title}
                            </div>
                            <p className={`line-clamp-4 italic text-[9px] ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                              "{doc.preview_snippet || "Pratinjau konten dokumen akademik farmasi."}"
                            </p>
                            <div className={`text-[8.5px] font-semibold text-right ${
                              theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"
                            }`}>
                              {doc.total_pages} Hlm
                            </div>
                          </div>
                        )}

                        {/* OVERLAY TOMBOL PREVIEW SAAT HOVER */}
                        <div className="absolute inset-0 bg-[#12161A]/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px] rounded-lg">
                          <span className={`font-bold text-[11px] px-2.5 py-1 rounded-md shadow-lg flex items-center gap-1.5 transform translate-y-1 group-hover:translate-y-0 transition-transform ${
                            theme === "dark" ? "bg-[#34D3BE] text-[#12161A]" : "bg-white text-[#0F766E]"
                          }`}>
                            <BookOpen className="w-3 h-3" />
                            <span>Buka</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* FOOTER KARTU: INFO HALAMAN & UKURAN */}
                    <div className={`mt-2 pt-1.5 border-t flex items-center justify-between text-[10px] px-0.5 ${
                      theme === "dark" ? "border-[#2A333B] text-[#9AA9B5]" : "border-[#DCE3E8] text-[#5B6B78]"
                    }`}>
                      <span className="font-semibold">{doc.total_pages} Halaman</span>
                      <span>{(doc.file_size_bytes / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                  </div>
                ))}
                </div>
              )}
            </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAMPILAN ADMIN & DEVELOPER CONSOLE (PUSAT MONITORING VPS) */}
        {/* ======================================================== */}
        {currentNav === "admin" && (
          <div className="flex-1 overflow-y-auto w-full h-full px-4 sm:px-8 lg:px-12 py-6 sm:py-8">
            {/* HEADER ADMIN CONSOLE */}
            <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-5 border-b ${
              theme === "dark" ? "border-[#2A333B]" : "border-[#DCE3E8]"
            }`}>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentNav("dashboard")}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition shadow-xs cursor-pointer ${
                    theme === "dark"
                      ? "border-[#2A333B] bg-[#1B2127] hover:bg-[#2A333B] text-[#E6EDF2]"
                      : "border-[#DCE3E8] bg-white hover:bg-[#F7F9FA] text-[#12202B]"
                  }`}
                  title="Kembali ke Beranda Dashboard"
                >
                  <ArrowLeft className="w-4 h-4 text-rose-500" />
                  <span>Kembali ke Beranda</span>
                </button>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className={`text-xl sm:text-2xl font-bold font-claude-serif tracking-tight ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
                      Admin &amp; Developer Console
                    </h2>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-500 border border-rose-500/30">
                      SUPER ADMIN
                    </span>
                  </div>
                  <p className={`text-xs mt-0.5 ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                    Pengawasan real-time aktivitas pengguna, audit dialog chat, manajemen pengguna, dan kesehatan server VPS.
                  </p>
                </div>
              </div>

              {/* ACTION TOOLBAR KANAN */}
              <div className="flex items-center flex-wrap gap-2">
                {/* Status Server Badge */}
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                  theme === "dark" ? "bg-[#12161A] border-[#2A333B] text-emerald-400" : "bg-white border-[#DCE3E8] text-emerald-600"
                }`}>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[11px]">Server VPS Aktif</span>
                </div>

                {/* Auto Refresh Toggle */}
                <button
                  onClick={() => setAdminAutoRefresh(!adminAutoRefresh)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer ${
                    adminAutoRefresh
                      ? "border-teal-500/40 bg-teal-500/10 text-teal-400 font-semibold"
                      : theme === "dark" ? "border-[#2A333B] bg-[#1B2127] text-[#9AA9B5]" : "border-[#DCE3E8] bg-white text-[#5B6B78]"
                  }`}
                  title="Toggle pembaruan data live otomatis setiap 7 detik"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-[11px] hidden sm:inline">Auto-refresh ({adminAutoRefresh ? "ON" : "OFF"})</span>
                </button>

                {/* Tombol Manual Refresh */}
                <button
                  onClick={() => {
                    fetchAdminStatsAndActivities();
                    fetchAdminTabContent(adminActiveTab);
                  }}
                  disabled={isAdminLoading}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer disabled:opacity-50 ${
                    theme === "dark"
                      ? "border-[#2A333B] bg-[#1B2127] hover:bg-[#2A333B] text-[#E6EDF2]"
                      : "border-[#DCE3E8] bg-white hover:bg-[#F7F9FA] text-[#12202B]"
                  }`}
                  title="Segarkan data saat ini"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isAdminLoading ? "animate-spin text-rose-500" : ""}`} />
                  <span className="text-[11px] hidden sm:inline">{isAdminLoading ? "Memuat..." : "Refresh"}</span>
                </button>

                {/* Theme Switcher Button */}
                <button
                  onClick={toggleTheme}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
                    theme === "dark"
                      ? "border-[#2A333B] bg-[#1B2127] text-amber-300 hover:bg-[#2A333B]"
                      : "border-[#DCE3E8] bg-white text-[#12202B] hover:bg-[#F7F9FA]"
                  }`}
                  title={theme === "dark" ? "Mode Terang" : "Mode Gelap"}
                >
                  {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5 text-[#5B6B78]" />}
                </button>

                {/* Buka Workspace AI */}
                <button
                  onClick={() => setCurrentNav("workspace")}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-xs transition cursor-pointer ${
                    theme === "dark"
                      ? "bg-[#2A333B] hover:bg-[#2A333B]/80 text-[#E6EDF2] border border-[#2A333B]"
                      : "bg-[#12202B] hover:bg-[#12202B]/90 text-white"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-rose-400" />
                  <span>Workspace AI</span>
                </button>
              </div>
            </div>

            {/* TAB NAVIGASI INTERNAL ADMIN CONSOLE */}
            <div className={`flex items-center gap-2 border-b mb-6 overflow-x-auto scrollbar-none pb-1 ${
              theme === "dark" ? "border-[#2A333B]" : "border-[#DCE3E8]"
            }`}>
              <button
                onClick={() => setAdminActiveTab("activity")}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition cursor-pointer border-b-2 whitespace-nowrap ${
                  adminActiveTab === "activity"
                    ? "border-rose-500 text-rose-500 bg-rose-500/5 font-extrabold"
                    : theme === "dark"
                    ? "border-transparent text-[#9AA9B5] hover:text-[#E6EDF2]"
                    : "border-transparent text-[#5B6B78] hover:text-[#12202B]"
                }`}
              >
                <Activity className="w-4 h-4" />
                <span>Live Activity &amp; User Monitor</span>
                {adminActivities.length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    adminActiveTab === "activity" ? "bg-rose-500 text-white" : "bg-[#2A333B] text-[#9AA9B5]"
                  }`}>
                    {adminActivities.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setAdminActiveTab("users")}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition cursor-pointer border-b-2 whitespace-nowrap ${
                  adminActiveTab === "users"
                    ? "border-rose-500 text-rose-500 bg-rose-500/5 font-extrabold"
                    : theme === "dark"
                    ? "border-transparent text-[#9AA9B5] hover:text-[#E6EDF2]"
                    : "border-transparent text-[#5B6B78] hover:text-[#12202B]"
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Direktori Pengguna &amp; Chat Inspector</span>
                {adminStats?.total_users ? (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    adminActiveTab === "users" ? "bg-rose-500 text-white" : "bg-[#2A333B] text-[#9AA9B5]"
                  }`}>
                    {adminStats.total_users}
                  </span>
                ) : null}
              </button>

              <button
                onClick={() => setAdminActiveTab("documents")}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition cursor-pointer border-b-2 whitespace-nowrap ${
                  adminActiveTab === "documents"
                    ? "border-rose-500 text-rose-500 bg-rose-500/5 font-extrabold"
                    : theme === "dark"
                    ? "border-transparent text-[#9AA9B5] hover:text-[#E6EDF2]"
                    : "border-transparent text-[#5B6B78] hover:text-[#12202B]"
                }`}
              >
                <Database className="w-4 h-4" />
                <span>Master Dokumen &amp; Kapasitas VPS</span>
                {adminStats?.total_documents ? (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    adminActiveTab === "documents" ? "bg-rose-500 text-white" : "bg-[#2A333B] text-[#9AA9B5]"
                  }`}>
                    {adminStats.total_documents}
                  </span>
                ) : null}
              </button>

              <button
                onClick={() => setAdminActiveTab("server")}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition cursor-pointer border-b-2 whitespace-nowrap ${
                  adminActiveTab === "server"
                    ? "border-rose-500 text-rose-500 bg-rose-500/5 font-extrabold"
                    : theme === "dark"
                    ? "border-transparent text-[#9AA9B5] hover:text-[#E6EDF2]"
                    : "border-transparent text-[#5B6B78] hover:text-[#12202B]"
                }`}
              >
                <Server className="w-4 h-4" />
                <span>Server VPS &amp; Developer Logs</span>
              </button>
            </div>

            {/* =================================================== */}
            {/* TAB 1: LIVE ACTIVITY & USER MONITOR                */}
            {/* =================================================== */}
            {adminActiveTab === "activity" && (
              <div className="space-y-6">
                {/* 4 KARTU METRIK STATISTIK UTAMA */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Kartu 1: Total Users */}
                  <div className={`p-4 rounded-2xl border shadow-xs ${
                    theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-medium ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>Total Pengguna</span>
                      <Users className="w-4 h-4 text-rose-500" />
                    </div>
                    <div className={`text-2xl font-bold mt-2 ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
                      {adminStats?.total_users ?? 0}
                    </div>
                    <span className="text-[11px] text-emerald-500 font-semibold mt-1 block">
                      Akun mahasiswa &amp; peneliti
                    </span>
                  </div>

                  {/* Kartu 2: Total Chat Messages */}
                  <div className={`p-4 rounded-2xl border shadow-xs ${
                    theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-medium ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>Aktivitas Dialog Chat</span>
                      <MessageSquare className="w-4 h-4 text-teal-500" />
                    </div>
                    <div className={`text-2xl font-bold mt-2 ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
                      {adminStats?.total_messages ?? 0}
                    </div>
                    <span className={`text-[11px] font-medium mt-1 block ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                      Dari {adminStats?.total_sessions ?? 0} sesi riset akademik
                    </span>
                  </div>

                  {/* Kartu 3: Total Dokumen */}
                  <div className={`p-4 rounded-2xl border shadow-xs ${
                    theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-medium ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>Dokumen &amp; Modul</span>
                      <BookOpen className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className={`text-2xl font-bold mt-2 ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
                      {adminStats?.total_documents ?? 0}
                    </div>
                    <span className={`text-[11px] font-medium mt-1 block ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                      Total {adminStats?.total_pages ?? 0} halaman diekstraksi
                    </span>
                  </div>

                  {/* Kartu 4: Storage VPS */}
                  <div className={`p-4 rounded-2xl border shadow-xs ${
                    theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-medium ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>Penyimpanan VPS</span>
                      <HardDrive className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className={`text-2xl font-bold mt-2 ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
                      {adminStats?.storage_mb ?? 0} MB
                    </div>
                    <span className="text-[11px] text-teal-500 font-semibold mt-1 block">
                      Deduplikasi SHA-256 aktif
                    </span>
                  </div>
                </div>

                {/* TIMELINE FEED AKTIVITAS PENGGUNA */}
                <div className={`rounded-2xl border shadow-xs overflow-hidden ${
                  theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
                }`}>
                  <div className={`p-4 border-b flex items-center justify-between ${
                    theme === "dark" ? "border-[#2A333B] bg-[#12161A]/50" : "border-[#DCE3E8] bg-[#F7F9FA]"
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <Activity className="w-4 h-4 text-rose-500" />
                      <h3 className={`text-sm font-bold ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
                        Linimasa Aktivitas Terkini (Apa yang Sedang Dikerjakan User)
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                        {adminActivities.length} peristiwa terekam
                      </span>
                    </div>
                  </div>

                  {adminActivities.length === 0 ? (
                    <div className="p-12 text-center">
                      <Activity className={`w-8 h-8 mx-auto mb-2 opacity-30 ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`} />
                      <p className={`text-xs ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                        Belum ada aktivitas user yang dicatat hari ini. Aktivitas seperti chat prompt, upload berkas, dan login akan muncul di sini secara real-time.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#2A333B]/40 max-h-[600px] overflow-y-auto">
                      {adminActivities.map((act) => {
                        const isChat = act.action_type === "chat_prompt";
                        const isUpload = act.action_type === "upload_document";
                        const isLogin = act.action_type === "login";
                        const isDelete = act.action_type === "delete_document";

                        return (
                          <div
                            key={act.id}
                            className={`p-4 transition flex items-start gap-3.5 hover:bg-black/5 dark:hover:bg-white/5 ${
                              isChat ? "bg-blue-500/5" : ""
                            }`}
                          >
                            {/* Icon Aksi */}
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-xs ${
                              isChat
                                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                : isUpload
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : isLogin
                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                : isDelete
                                ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                : "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                            }`}>
                              {isChat && <MessageSquare className="w-4 h-4" />}
                              {isUpload && <UploadCloud className="w-4 h-4" />}
                              {isLogin && <User className="w-4 h-4" />}
                              {isDelete && <Trash2 className="w-4 h-4" />}
                              {!isChat && !isUpload && !isLogin && !isDelete && <Activity className="w-4 h-4" />}
                            </div>

                            {/* Konten Aktivitas */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-xs font-bold ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
                                    {act.user_name}
                                  </span>
                                  <span className={`text-[11px] font-mono ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                                    &lt;{act.user_email}&gt;
                                  </span>
                                  <span className={`text-[9.5px] font-bold px-2 py-0.2 rounded-full uppercase tracking-wider ${
                                    isChat
                                      ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                                      : isUpload
                                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                      : isLogin
                                      ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                                      : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                                  }`}>
                                    {act.action_type.replace("_", " ")}
                                  </span>
                                </div>
                                <span className={`text-[10px] shrink-0 font-mono ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                                  {new Date(act.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                </span>
                              </div>

                              <p className={`text-xs mt-1.5 leading-relaxed font-claude-sans ${
                                isChat
                                  ? theme === "dark" ? "text-cyan-200" : "text-cyan-900 font-semibold"
                                  : theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
                              }`}>
                                {act.description}
                              </p>

                              {/* Action Footer: Tombol Inspeksi Chat Cepat */}
                              <div className="flex items-center justify-between mt-2 pt-1">
                                <span className={`text-[10px] font-mono ${theme === "dark" ? "text-[#9AA9B5]/70" : "text-[#5B6B78]/70"}`}>
                                  IP: {act.ip_address} • {new Date(act.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                                </span>

                                <button
                                  onClick={() => handleInspectUser({ id: act.user_id, email: act.user_email, full_name: act.user_name })}
                                  className={`text-[11px] font-bold flex items-center gap-1 cursor-pointer transition ${
                                    theme === "dark" ? "text-rose-400 hover:text-rose-300" : "text-rose-600 hover:text-rose-700"
                                  }`}
                                  title="Inspeksi seluruh riwayat percakapan user ini"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Inspeksi Dialog User</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* =================================================== */}
            {/* TAB 2: DIREKTORI PENGGUNA & CHAT INSPECTOR        */}
            {/* =================================================== */}
            {adminActiveTab === "users" && (
              <div className="space-y-6">
                {/* Search & Header */}
                <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs ${
                  theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
                }`}>
                  <div className="relative w-full sm:max-w-md">
                    <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${
                      theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                    }`} />
                    <input
                      type="text"
                      value={adminSearchFilter}
                      onChange={(e) => setAdminSearchFilter(e.target.value)}
                      placeholder="Cari pengguna berdasarkan nama atau email..."
                      className={`w-full text-xs pl-9 pr-3 py-2 rounded-xl border focus:outline-none transition ${
                        theme === "dark"
                          ? "bg-[#12161A] border-[#2A333B] text-[#E6EDF2] focus:border-rose-500 placeholder-[#9AA9B5]/60"
                          : "bg-white border-[#DCE3E8] text-[#12202B] focus:border-rose-500 placeholder-[#5B6B78]/60"
                      }`}
                    />
                  </div>
                  <div className={`text-xs font-medium ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                    Total {adminUsers.length} pengguna terdaftar
                  </div>
                </div>

                {/* TABEL PENGGUNA */}
                <div className={`rounded-2xl border shadow-xs overflow-hidden ${
                  theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
                }`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className={`border-b text-[11px] font-bold uppercase tracking-wider ${
                        theme === "dark" ? "bg-[#12161A] border-[#2A333B] text-[#9AA9B5]" : "bg-[#F7F9FA] border-[#DCE3E8] text-[#5B6B78]"
                      }`}>
                        <tr>
                          <th className="px-4 py-3.5">Pengguna</th>
                          <th className="px-4 py-3.5">Peran (Role)</th>
                          <th className="px-4 py-3.5">Status Akun</th>
                          <th className="px-4 py-3.5">Terakhir Aktif</th>
                          <th className="px-4 py-3.5">Penggunaan (Doc / Chat)</th>
                          <th className="px-4 py-3.5 text-right">Aksi &amp; Audit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2A333B]/40">
                        {adminUsers
                          .filter((u) =>
                            !adminSearchFilter ||
                            u.full_name.toLowerCase().includes(adminSearchFilter.toLowerCase()) ||
                            u.email.toLowerCase().includes(adminSearchFilter.toLowerCase())
                          )
                          .map((u) => {
                            const isSuperAdmin = u.email === "admin@epiona.my.id";
                            return (
                              <tr key={u.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition">
                                <td className="px-4 py-3.5">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
                                      {u.full_name ? u.full_name.charAt(0).toUpperCase() : "U"}
                                    </div>
                                    <div>
                                      <p className={`font-bold ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
                                        {u.full_name}
                                      </p>
                                      <span className={`text-[11px] font-mono ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                                        {u.email}
                                      </span>
                                    </div>
                                  </div>
                                </td>

                                <td className="px-4 py-3.5">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                    u.role === "admin"
                                      ? "bg-rose-500/15 text-rose-500 border border-rose-500/30"
                                      : "bg-teal-500/15 text-teal-400 border border-teal-500/30"
                                  }`}>
                                    {u.role || "user"}
                                  </span>
                                </td>

                                <td className="px-4 py-3.5">
                                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    u.is_active
                                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                      : "bg-rose-500/15 text-rose-500 border border-rose-500/30"
                                  }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? "bg-emerald-500" : "bg-rose-500"}`}></span>
                                    <span>{u.is_active ? "Aktif" : "Diblokir"}</span>
                                  </span>
                                </td>

                                <td className="px-4 py-3.5">
                                  <span className={`text-[11px] font-mono ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                                    {u.last_active_at ? new Date(u.last_active_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }) : "-"}
                                  </span>
                                </td>

                                <td className="px-4 py-3.5">
                                  <div className="flex items-center gap-3">
                                    <span className="flex items-center gap-1 text-[11px]" title="Total Dokumen di Library">
                                      <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                                      <span>{u.total_documents ?? 0} dok</span>
                                    </span>
                                    <span className="flex items-center gap-1 text-[11px]" title="Total Pesan Chat">
                                      <MessageSquare className="w-3.5 h-3.5 text-teal-400" />
                                      <span>{u.total_messages ?? 0} prompt</span>
                                    </span>
                                  </div>
                                </td>

                                <td className="px-4 py-3.5 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {/* Tombol Inspeksi Dialog Chat */}
                                    <button
                                      onClick={() => handleInspectUser(u)}
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500 hover:text-white transition text-[11px] font-bold cursor-pointer"
                                      title="Buka seluruh transkrip percakapan pengguna ini"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>Inspeksi Chat</span>
                                    </button>

                                    {/* Tombol Blokir / Aktifkan */}
                                    {!isSuperAdmin && (
                                      <button
                                        onClick={() => handleToggleUserStatus(u.id, u.is_active)}
                                        className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                          u.is_active
                                            ? "border-rose-500/30 text-rose-400 hover:bg-rose-500 hover:text-white"
                                            : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-white"
                                        }`}
                                        title={u.is_active ? "Blokir akun pengguna ini" : "Aktifkan kembali akun ini"}
                                      >
                                        {u.is_active ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* =================================================== */}
            {/* TAB 3: MASTER DOKUMEN & KAPASITAS VPS               */}
            {/* =================================================== */}
            {adminActiveTab === "documents" && (
              <div className="space-y-6">
                <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-xs ${
                  theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
                }`}>
                  <div>
                    <h3 className={`text-sm font-bold ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
                      Master Berkas PDF di Server VPS
                    </h3>
                    <p className={`text-xs mt-0.5 ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                      Seluruh dokumen yang tersimpan fisik di direktori server dengan dukungan deduplikasi reference-counting.
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-rose-500">{adminDocuments.length} Dokumen</span>
                    <span className={`block text-[11px] ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                      Kapasitas Total: {adminStats?.storage_mb ?? 0} MB
                    </span>
                  </div>
                </div>

                <div className={`rounded-2xl border shadow-xs overflow-hidden ${
                  theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
                }`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className={`border-b text-[11px] font-bold uppercase tracking-wider ${
                        theme === "dark" ? "bg-[#12161A] border-[#2A333B] text-[#9AA9B5]" : "bg-[#F7F9FA] border-[#DCE3E8] text-[#5B6B78]"
                      }`}>
                        <tr>
                          <th className="px-4 py-3.5">Dokumen</th>
                          <th className="px-4 py-3.5">Pemilik (Akses User)</th>
                          <th className="px-4 py-3.5">Halaman</th>
                          <th className="px-4 py-3.5">Ukuran</th>
                          <th className="px-4 py-3.5">Checksum Hash</th>
                          <th className="px-4 py-3.5 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2A333B]/40">
                        {adminDocuments.map((doc) => (
                          <tr key={doc.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition">
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <FileText className="w-5 h-5 text-rose-500 shrink-0" />
                                <div>
                                  <p className={`font-bold ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
                                    {doc.title}
                                  </p>
                                  <span className={`text-[10px] font-mono ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                                    {doc.filename}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-3.5">
                              <div className="flex flex-col gap-1">
                                {doc.owners && doc.owners.length > 0 ? (
                                  doc.owners.map((ow: any) => (
                                    <span key={ow.id} className={`text-[11px] font-mono ${theme === "dark" ? "text-cyan-300" : "text-cyan-800 font-semibold"}`}>
                                      • {ow.full_name} ({ow.email})
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[11px] text-amber-500">Global System File</span>
                                )}
                              </div>
                            </td>

                            <td className="px-4 py-3.5 font-bold">
                              {doc.total_pages} Hlm
                            </td>

                            <td className="px-4 py-3.5 font-mono">
                              {doc.file_size_mb} MB
                            </td>

                            <td className="px-4 py-3.5 font-mono text-[10px] text-slate-400 truncate max-w-xs" title={doc.file_hash}>
                              {doc.file_hash ? `${doc.file_hash.substring(0, 16)}...` : "-"}
                            </td>

                            <td className="px-4 py-3.5 text-right">
                              <a
                                href={`${API_BASE}/api/v1/documents/${doc.id}/pdf?token=${currentUser?.token}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/30 hover:bg-teal-500 hover:text-white transition text-[11px] font-bold"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Buka PDF</span>
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* =================================================== */}
            {/* TAB 4: SERVER VPS & DEVELOPER LOGS                 */}
            {/* =================================================== */}
            {adminActiveTab === "server" && (
              <div className="space-y-6">
                {/* 4 Card Spesifikasi Server */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className={`p-4 rounded-2xl border shadow-xs ${
                    theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
                  }`}>
                    <span className={`text-[11px] font-medium ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>Sistem Operasi Host</span>
                    <p className={`text-sm font-bold mt-1.5 truncate ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
                      {adminSystemStatus?.platform || "Windows / Linux VPS"}
                    </p>
                  </div>

                  <div className={`p-4 rounded-2xl border shadow-xs ${
                    theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
                  }`}>
                    <span className={`text-[11px] font-medium ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>Database Engine</span>
                    <p className={`text-sm font-bold mt-1.5 text-emerald-500`}>
                      {adminSystemStatus?.database_type || "MYSQL"} (Terhubung)
                    </p>
                  </div>

                  <div className={`p-4 rounded-2xl border shadow-xs ${
                    theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
                  }`}>
                    <span className={`text-[11px] font-medium ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>AI Engine Provider</span>
                    <p className={`text-sm font-bold mt-1.5 text-cyan-400`}>
                      {adminSystemStatus?.ai_service?.active_provider || "Gemini / Groq Hybrid"}
                    </p>
                  </div>

                  <div className={`p-4 rounded-2xl border shadow-xs ${
                    theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
                  }`}>
                    <span className={`text-[11px] font-medium ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>Process ID (PID)</span>
                    <p className={`text-sm font-bold mt-1.5 font-mono text-amber-400`}>
                      PID: {adminSystemStatus?.process_id || "Active"}
                    </p>
                  </div>
                </div>

                {/* TERMINAL AUDIT LOGS VIEWER */}
                <div className="rounded-2xl border border-slate-800 bg-[#0d1117] text-slate-200 shadow-xl overflow-hidden font-mono text-xs">
                  {/* Top Bar Terminal */}
                  <div className="bg-[#161b22] px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                        <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                        <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-400 ml-2">
                        bash - epiona-vps-audit.log (Live Developer Console)
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-bold">
                      STREAM LIVE
                    </span>
                  </div>

                  {/* Terminal Log Lines */}
                  <div className="p-4 space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin">
                    {adminLogs.length === 0 ? (
                      <div className="text-slate-500 py-6 text-center">
                        Memuat baris log backend...
                      </div>
                    ) : (
                      adminLogs.map((log, idx) => (
                        <div key={idx} className="flex items-start gap-2 leading-relaxed hover:bg-white/5 p-1 rounded">
                          <span className="text-slate-500 shrink-0 select-none">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${
                            log.source.includes("CHAT") ? "bg-blue-900/60 text-blue-300" :
                            log.source.includes("UPLOAD") ? "bg-emerald-900/60 text-emerald-300" :
                            log.source.includes("LOGIN") ? "bg-amber-900/60 text-amber-300" :
                            "bg-purple-900/60 text-purple-300"
                          }`}>
                            {log.source}
                          </span>
                          <span className="text-cyan-400 shrink-0">{log.user}:</span>
                          <span className="text-slate-200 break-words">{log.message}</span>
                          <span className="text-slate-600 ml-auto shrink-0 text-[10px]">({log.ip})</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL USER CHAT INSPECTOR (AUDIT PERCAKAPAN LANGSUNG)    */}
        {/* ======================================================== */}
        {inspectingUser && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
            <div className={`w-full max-w-5xl h-[88vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden ${
              theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
            }`}>
              {/* MODAL HEADER */}
              <div className={`p-4 border-b flex items-center justify-between ${
                theme === "dark" ? "border-[#2A333B] bg-[#12161A]" : "border-[#DCE3E8] bg-[#F7F9FA]"
              }`}>
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

              {/* MODAL BODY (KIRI: SESI PERCAKAPAN, KANAN: PESAN DIALOG) */}
              <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
                {/* SISI KIRI: DAFTAR SESI OBROLAN USER */}
                <div className={`w-full sm:w-72 border-b sm:border-b-0 sm:border-r flex flex-col overflow-hidden shrink-0 ${
                  theme === "dark" ? "border-[#2A333B] bg-[#12161A]/40" : "border-[#DCE3E8] bg-[#F7F9FA]/40"
                }`}>
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
                            <span className={`text-[10px] block mt-0.5 opacity-80`}>
                              {new Date(s.updated_at || s.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* SISI KANAN: TRANSKRIP PESAN DIALOG ANTARA USER DAN ASISTEN */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className={`p-3 border-b text-xs font-bold flex items-center justify-between ${
                    theme === "dark" ? "border-[#2A333B]" : "border-[#DCE3E8]"
                  }`}>
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
                          <div
                            key={m.id}
                            className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                          >
                            <span className={`text-[10px] font-bold mb-1 ${
                              isUser ? "text-cyan-500" : "text-rose-500"
                            }`}>
                              {isUser ? `Pertanyaan ${inspectingUser.full_name}` : "Respons EPIONA AI"}
                            </span>

                            <div className={`p-4 rounded-2xl max-w-2xl text-xs leading-relaxed ${
                              isUser
                                ? theme === "dark" ? "bg-[#2A333B] text-[#E6EDF2]" : "bg-teal-50 text-[#12202B] border border-teal-200"
                                : theme === "dark" ? "bg-[#12161A] text-[#E6EDF2] border border-[#2A333B]" : "bg-white text-[#12202B] border border-[#DCE3E8] shadow-xs"
                            }`}>
                              <p className="whitespace-pre-wrap">{m.text}</p>

                              {/* Sitasi Jika Ada */}
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
        )}

            {/* ======================================================== */}
            {/* MODAL PRATINJAU DOKUMEN (CLEAN DEFAULT BROWSER PDF VIEWER) */}
            {/* ======================================================== */}
            {previewDoc && (
              <div
                className="fixed inset-0 z-50 bg-[#121212] flex flex-col select-none animate-in fade-in duration-150"
                tabIndex={-1}
              >
                {/* TOP HEADER RINGKAS & BERSIH (TANPA TOOLBAR TUMPANG TINDIH) */}
                <div className="h-14 bg-[#1f1f1f] border-b border-[#3c4043] px-3 sm:px-4 flex items-center justify-between text-white shrink-0 z-20">
                  <div className="flex items-center gap-3 overflow-hidden max-w-xl">
                    <button
                      onClick={() => setPreviewDoc(null)}
                      className="p-1.5 sm:p-2 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition"
                      title="Tutup pratinjau"
                    >
                      <X className="w-5 h-5" />
                    </button>

                    <div className="w-7 h-7 rounded bg-[#ea4335] flex items-center justify-center text-white font-bold text-[10px] tracking-tight shrink-0 shadow-sm">
                      PDF
                    </div>

                    <div className="flex flex-col overflow-hidden">
                      <h3 className="font-medium text-xs sm:text-sm text-white truncate" title={previewDoc.title}>
                        {previewDoc.title.endsWith(".pdf") ? previewDoc.title : `${previewDoc.title}.pdf`}
                      </h3>
                      <span className="text-[10px] text-slate-400">
                        {previewDoc.total_pages} Halaman • {(previewDoc.file_size_bytes / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                  </div>

                  {/* KANAN: TOMBOL BUKA DI WORKSPACE & UNDUH */}
                  <div className="flex items-center gap-2 sm:gap-2.5">
                    <button
                      onClick={() => {
                        setActiveDoc(previewDoc);
                        setTargetPage(1);
                        setHighlightQuote(null);
                        setIsPdfPanelOpen(true);
                        setCurrentNav("workspace");
                        setPreviewDoc(null);
                      }}
                      className="flex items-center gap-1.5 text-xs font-semibold bg-[#1a73e8] hover:bg-[#1557b0] text-white px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full shadow transition"
                      title="Buka dokumen ini di Workspace untuk tanya jawab asisten AI"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Buka di Workspace & Tanya AI</span>
                    </button>

                    <a
                      href={`${API_BASE}/api/v1/documents/${previewDoc.id}/pdf?download=1&token=${currentUser?.token}`}
                      download={previewDoc.filename}
                      className="p-2 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition"
                      title="Unduh PDF"
                    >
                      <Download className="w-4 h-4" />
                    </a>

                    <a
                      href={`${API_BASE}/api/v1/documents/${previewDoc.id}/pdf?token=${currentUser?.token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition"
                      title="Buka di tab browser baru"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* AREA PDF VIEWER DEFAULT BROWSER: FULL HEIGHT & WIDTH, NO OVERLAP */}
                <div className="flex-1 w-full h-full bg-[#525659] overflow-hidden">
                  <iframe
                    key={previewDoc.id}
                    src={`${API_BASE}/api/v1/documents/${previewDoc.id}/pdf?token=${currentUser?.token}`}
                    className="w-full h-full border-0"
                    title={`Pratinjau ${previewDoc.title}`}
                  />
                </div>
              </div>
            )}

        {/* ======================================================== */}
        {/* TAMPILAN MENU WORKSPACE (EPIONA CHAT WITH DARK / LIGHT MODE) */}
        {/* ======================================================== */}
        {currentNav === "workspace" && (
          <div
            className={`flex-1 flex overflow-hidden ${
              theme === "dark" ? "bg-[#12161A]" : "bg-[#F7F9FA]"
            }`}
          >
            {/* PANEL ASISTEN CHAT */}
            <div
              className={`${
                isPdfPanelOpen
                  ? theme === "dark"
                    ? "w-full md:w-[48%] border-r border-[#2A333B]"
                    : "w-full md:w-[48%] border-r border-[#DCE3E8]"
                  : "w-full"
              } flex flex-col h-full transition-all duration-200 font-claude-sans ${
                theme === "dark" ? "bg-[#12161A]" : "bg-[#F7F9FA]"
              }`}
            >
              {/* TOP HEADER WORKSPACE */}
              <div
                className={`h-12 border-b px-4 flex items-center justify-between shrink-0 transition-colors ${
                  theme === "dark"
                    ? "bg-[#1B2127] border-[#2A333B]"
                    : "bg-white border-[#DCE3E8]"
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  {/* TOMBOL BUKA SIDEBAR KIRI (HANYA MUNCUL KETIKA SIDEBAR TERTUTUP) */}
                  {!isLeftSidebarOpen && (
                    <button
                      onClick={() => setIsLeftSidebarOpen(true)}
                      className={`p-1.5 rounded-lg transition cursor-pointer ${
                        theme === "dark"
                          ? "hover:bg-[#2A333B] text-[#9AA9B5] hover:text-[#E6EDF2]"
                          : "hover:bg-[#F7F9FA] text-[#5B6B78] hover:text-[#12202B]"
                      }`}
                      title="Buka riwayat percakapan"
                    >
                      <PanelLeftOpen className="w-4 h-4" />
                    </button>
                  )}

                  {/* TOMBOL KEMBALI KE BERANDA / DASHBOARD */}
                  <button
                    onClick={() => setCurrentNav("dashboard")}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                      theme === "dark"
                        ? "border-[#2A333B] bg-[#12161A] text-[#9AA9B5] hover:text-[#E6EDF2] hover:bg-[#2A333B]"
                        : "border-[#DCE3E8] bg-white text-[#5B6B78] hover:text-[#0F766E] hover:bg-[#F7F9FA]"
                    }`}
                    title="Kembali ke Beranda"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Keluar</span>
                  </button>

                  {/* IDENTITAS EPIONA & STATUS GROUNDING */}
                  <div className="flex items-center gap-2 pl-1">
                    <span className={`w-2 h-2 rounded-full ${theme === "dark" ? "bg-[#34D3BE]" : "bg-[#0F766E]"}`} />
                    <span
                      className={`text-xs font-bold tracking-tight truncate max-w-[160px] sm:max-w-xs font-claude-serif ${
                        theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
                      }`}
                    >
                      EPIONA Assistant
                    </span>
                    {groundingMode === "academic" ? (
                      <span className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        theme === "dark"
                          ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                          : "bg-cyan-50 text-cyan-700 border-cyan-200"
                      }`}>
                        Web Akademik Terakreditasi (NCBI PubMed)
                      </span>
                    ) : (
                      <span className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        theme === "dark"
                          ? "bg-[#34D3BE]/15 text-[#34D3BE] border-[#34D3BE]/30"
                          : "bg-[#0F766E]/10 text-[#0F766E] border-[#0F766E]/20"
                      }`}>
                        Grounding MyLibrary Aktif
                      </span>
                    )}
                  </div>
                </div>

                {/* BAGIAN KANAN: THEME SWITCHER & SOURCES */}
                <div className="flex items-center gap-2">
                  {/* TOMBOL TOGGLE THEME (DARK / LIGHT MODE) */}
                  <button
                    onClick={toggleTheme}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
                      theme === "dark"
                        ? "border-[#2A333B] bg-[#12161A] text-amber-300 hover:bg-[#2A333B]"
                        : "border-[#DCE3E8] bg-white text-[#5B6B78] hover:bg-[#F7F9FA]"
                    }`}
                    title={theme === "dark" ? "Ganti ke Mode Terang (Light)" : "Ganti ke Mode Gelap (Dark)"}
                  >
                    {theme === "dark" ? (
                      <>
                        <Sun className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-[11px] hidden sm:inline text-[#E6EDF2]">Terang</span>
                      </>
                    ) : (
                      <>
                        <Moon className="w-3.5 h-3.5 text-[#5B6B78]" />
                        <span className="text-[11px] hidden sm:inline text-[#5B6B78]">Gelap</span>
                      </>
                    )}
                  </button>

                  {/* TOMBOL SOURCES */}
                  <div className="relative" ref={sourcesRef}>
                    <button
                      onClick={() => setIsSourcesOpen(!isSourcesOpen)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        theme === "dark"
                          ? "border-[#2A333B] bg-[#12161A] text-[#9AA9B5] hover:text-[#34D3BE] hover:bg-[#2A333B]"
                          : "border-[#DCE3E8] bg-white text-[#5B6B78] hover:text-[#0F766E] hover:bg-[#F7F9FA]"
                      }`}
                      title="Lihat sumber referensi MyLibrary"
                    >
                      <Layers className={`w-3.5 h-3.5 ${theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"}`} />
                      <span>Sources</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        theme === "dark" ? "bg-[#34D3BE] text-[#12161A]" : "bg-[#0F766E] text-white"
                      }`}>
                        {sessionCitations.length}
                      </span>
                    </button>

                    {/* POPUP CARD SOURCES ALA PERPLEXITY (ACCORDION WEB & FILES) */}
                    {isSourcesOpen && (
                      <div
                        className={`absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl shadow-2xl z-40 p-3 border animate-in fade-in zoom-in-95 duration-150 ${
                          theme === "dark"
                            ? "bg-[#1B2127] border-[#2A333B] text-[#E6EDF2]"
                            : "bg-white border-[#DCE3E8] text-[#12202B]"
                        }`}
                      >
                        {/* HEADER POPOVER */}
                        <div
                          className={`flex items-center justify-between pb-2.5 mb-2.5 border-b ${
                            theme === "dark" ? "border-[#2A333B]" : "border-[#DCE3E8]"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold font-claude-serif">Sources</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                              theme === "dark" ? "bg-[#34D3BE]/15 text-[#34D3BE]" : "bg-[#0F766E]/10 text-[#0F766E]"
                            }`}>
                              {sessionCitations.length} total
                            </span>
                          </div>
                          <button
                            onClick={() => setIsSourcesOpen(false)}
                            className={`p-1 rounded-lg transition cursor-pointer ${
                              theme === "dark" ? "text-[#9AA9B5] hover:text-[#E6EDF2]" : "text-[#5B6B78] hover:text-[#12202B]"
                            }`}
                            title="Tutup menu sources"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>

                        {/* LIST ACCORDION SECTION */}
                        <div className="space-y-2">
                          {/* ======================================================== */}
                          {/* 1. SECTION ACCORDION WEB (NCBI PUBMED / PMC / JURNAL)   */}
                          {/* ======================================================== */}
                          <div className={`rounded-xl border transition-all ${
                            theme === "dark" ? "border-[#2A333B] bg-[#12161A]/60" : "border-[#DCE3E8] bg-[#F7F9FA]"
                          }`}>
                            <button
                              type="button"
                              onClick={() => setSourcesAccordionOpen(sourcesAccordionOpen === "web" ? null : "web")}
                              className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold transition cursor-pointer ${
                                theme === "dark" ? "hover:text-[#34D3BE]" : "hover:text-[#0F766E]"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Globe className={`w-4 h-4 ${theme === "dark" ? "text-cyan-400" : "text-cyan-600"}`} />
                                <span>Web (Jurnal Akademik)</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${
                                  theme === "dark" ? "bg-[#2A333B] text-[#9AA9B5]" : "bg-[#E6EDF2] text-[#5B6B78]"
                                }`}>
                                  {totalWebCount}
                                </span>
                                {sourcesAccordionOpen === "web" ? (
                                  <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                                )}
                              </div>
                            </button>

                            {/* KONTEN EXPANDED ACCORDION WEB */}
                            {sourcesAccordionOpen === "web" && (
                              <div className={`px-2.5 pb-2.5 pt-1 border-t max-h-72 overflow-y-auto space-y-3 scrollbar-thin ${
                                theme === "dark" ? "border-[#2A333B]" : "border-[#DCE3E8]"
                              }`}>
                                {webCitationsGrouped.length === 0 ? (
                                  <div className={`py-4 text-center text-xs ${
                                    theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                                  }`}>
                                    Belum ada rujukan Web Akademik pada percakapan ini.
                                  </div>
                                ) : (
                                  webCitationsGrouped.map((group, gIdx) => (
                                    <div key={gIdx} className="space-y-1.5">
                                      {/* LABEL PERTANYAAN APA YANG DIJAWAB */}
                                      <div className={`text-[11px] font-semibold italic flex items-center gap-1 ${
                                        theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"
                                      }`}>
                                        <span className="truncate">Results for "{group.question.slice(0, 42)}{group.question.length > 42 ? '...' : ''}"</span>
                                      </div>

                                      {/* KARTU RUJUKAN DALAM PERTANYAAN INI */}
                                      <div className="space-y-1.5">
                                        {group.items.map((cit, cIdx) => (
                                          <div
                                            key={cIdx}
                                            onClick={() => {
                                              handleCitationClick(cit);
                                              setIsSourcesOpen(false);
                                            }}
                                            className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                                              theme === "dark"
                                                ? "bg-[#1B2127] hover:bg-[#2A333B] border-[#2A333B] hover:border-cyan-500/50"
                                                : "bg-white hover:bg-cyan-50/50 border-[#DCE3E8] hover:border-cyan-500/40"
                                            }`}
                                          >
                                            <div className="flex items-center gap-1.5 mb-1 text-[10px]">
                                              <Globe className="w-3 h-3 text-cyan-500 shrink-0" />
                                              <span className="font-bold text-cyan-600 dark:text-cyan-400 truncate">
                                                {cit.journal_name || "PubMed / NCBI"}
                                              </span>
                                              <span className="opacity-50">({cit.publication_year || "2025"})</span>
                                            </div>
                                            <h5 className={`text-xs font-bold line-clamp-2 leading-tight ${
                                              theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
                                            }`}>
                                              {cit.document_title}
                                            </h5>
                                            {cit.abstract_snippet && (
                                              <p className={`text-[10px] line-clamp-2 mt-1 leading-snug ${
                                                theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                                              }`}>
                                                {cit.abstract_snippet}
                                              </p>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>

                          {/* ======================================================== */}
                          {/* 2. SECTION ACCORDION FILES (MYLIBRARY BUKU TEKS & MODUL) */}
                          {/* ======================================================== */}
                          <div className={`rounded-xl border transition-all ${
                            theme === "dark" ? "border-[#2A333B] bg-[#12161A]/60" : "border-[#DCE3E8] bg-[#F7F9FA]"
                          }`}>
                            <button
                              type="button"
                              onClick={() => setSourcesAccordionOpen(sourcesAccordionOpen === "files" ? null : "files")}
                              className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold transition cursor-pointer ${
                                theme === "dark" ? "hover:text-[#34D3BE]" : "hover:text-[#0F766E]"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <FileText className={`w-4 h-4 ${theme === "dark" ? "text-amber-400" : "text-amber-600"}`} />
                                <span>Files (MyLibrary)</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${
                                  theme === "dark" ? "bg-[#2A333B] text-[#9AA9B5]" : "bg-[#E6EDF2] text-[#5B6B78]"
                                }`}>
                                  {totalFileCount}
                                </span>
                                {sourcesAccordionOpen === "files" ? (
                                  <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                                )}
                              </div>
                            </button>

                            {/* KONTEN EXPANDED ACCORDION FILES */}
                            {sourcesAccordionOpen === "files" && (
                              <div className={`px-2.5 pb-2.5 pt-1 border-t max-h-72 overflow-y-auto space-y-3 scrollbar-thin ${
                                theme === "dark" ? "border-[#2A333B]" : "border-[#DCE3E8]"
                              }`}>
                                {fileCitationsGrouped.length === 0 ? (
                                  <div className={`py-4 text-center text-xs ${
                                    theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                                  }`}>
                                    Belum ada rujukan modul file MyLibrary pada percakapan ini.
                                  </div>
                                ) : (
                                  fileCitationsGrouped.map((group, fIdx) => (
                                    <div key={fIdx} className="space-y-1.5">
                                      {/* LABEL DOKUMEN & HALAMAN FISIK */}
                                      <div className={`text-[11px] font-bold flex items-center justify-between ${
                                        theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
                                      }`}>
                                        <div className="flex items-center gap-1.5 truncate">
                                          <BookOpen className="w-3 h-3 text-amber-500 shrink-0" />
                                          <span className="truncate">{group.docTitle}</span>
                                        </div>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded border shrink-0 ${
                                          theme === "dark"
                                            ? "bg-[#34D3BE]/15 text-[#34D3BE] border-[#34D3BE]/30"
                                            : "bg-[#0F766E]/10 text-[#0F766E] border-[#0F766E]/20"
                                        }`}>
                                          Hlm {group.page}
                                        </span>
                                      </div>

                                      {/* KUTIPAN KUTIPAN DAN PERTANYAAN YANG DIJAWAB */}
                                      <div className="space-y-1.5">
                                        {group.items.map((item, iIdx) => (
                                          <div
                                            key={iIdx}
                                            onClick={() => {
                                              handleCitationClick(item.rawCit);
                                              setIsSourcesOpen(false);
                                            }}
                                            className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                                              theme === "dark"
                                                ? "bg-[#1B2127] hover:bg-[#2A333B] border-[#2A333B] hover:border-amber-500/50"
                                                : "bg-white hover:bg-amber-50/50 border-[#DCE3E8] hover:border-amber-500/40"
                                            }`}
                                          >
                                            <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mb-1 truncate">
                                              Menjawab: "{item.question.slice(0, 38)}{item.question.length > 38 ? '...' : ''}"
                                            </div>
                                            <p className={`text-[10.5px] italic line-clamp-2 leading-snug ${
                                              theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                                            }`}>
                                              "{item.quote}"
                                            </p>
                                            <div className={`mt-1.5 flex items-center gap-1 text-[9.5px] font-semibold ${
                                              theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"
                                            }`}>
                                              <span>Buka halaman fisik {group.page}</span>
                                              <ExternalLink className="w-2.5 h-2.5" />
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* FOOTER POPOVER */}
                        <div
                          className={`pt-2 mt-2 border-t flex items-center justify-between text-[10px] ${
                            theme === "dark" ? "border-[#2A333B] text-[#9AA9B5]" : "border-[#DCE3E8] text-[#5B6B78]"
                          }`}
                        >
                          <span className="flex items-center gap-1">
                            <ShieldCheck className={`w-3 h-3 ${theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"}`} />
                            Evidence-Based Medicine
                          </span>
                          <span>{uniqueDocsCount} Dokumen Aktif</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* TOMBOL TUTUP PANEL LEMBARAN PDF JIKA SEDANG TERBUKA */}
                  {isPdfPanelOpen && (
                    <button
                      onClick={() => setIsPdfPanelOpen(false)}
                      className={`p-1.5 rounded-lg transition cursor-pointer ${
                        theme === "dark"
                          ? "hover:bg-[#2A333B] text-[#9AA9B5] hover:text-[#E6EDF2]"
                          : "hover:bg-[#F7F9FA] text-[#5B6B78] hover:text-[#12202B]"
                      }`}
                      title="Tutup lembaran dokumen fisik"
                    >
                      <PanelRightClose className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* GRADASI HALUS DI BAWAH HEADER (FADE MASK ATAS AGAR PESAN MEMUDAR ELEGAN KE ATAS) */}
              <div
                className={`pointer-events-none absolute top-12 left-0 right-0 h-8 sm:h-10 z-10 bg-gradient-to-b ${
                  theme === "dark"
                    ? "from-[#12161A] to-transparent"
                    : "from-[#F7F9FA] to-transparent"
                }`}
              />

              {/* MESSAGE STREAM (CLAUDE-STYLE FULLSCREEN CLEAN STREAM WITH EPIONA THEME) */}
              <div
                className={`flex-1 overflow-y-auto px-4 sm:px-6 md:px-12 py-8 space-y-7 transition-colors ${
                  theme === "dark" ? "bg-[#12161A]" : "bg-[#F7F9FA]"
                }`}
              >
                {documents.length === 0 && (
                  <div
                    className={`max-w-2xl mx-auto p-3.5 rounded-2xl text-xs border flex items-center justify-between gap-3 ${
                      theme === "dark"
                        ? "bg-[#1B2127] border-[#2A333B] text-[#E6EDF2]"
                        : "bg-white border-[#DCE3E8] text-[#12202B]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className={`w-4 h-4 shrink-0 ${theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"}`} />
                      <span>
                        <b>Mode Pengetahuan Umum Aktif:</b> Anda dapat mengobrol & berdiskusi langsung. Unggah modul di <b>MyLibrary</b> jika ingin grounding sitasi fisik 1:1.
                      </span>
                    </div>
                    <button
                      onClick={() => setCurrentNav("library")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition cursor-pointer ${
                        theme === "dark"
                          ? "bg-[#34D3BE] text-[#12161A] hover:bg-[#34D3BE]/90"
                          : "bg-[#0F766E] text-white hover:bg-[#0F766E]/90"
                      }`}
                    >
                      Unggah PDF
                    </button>
                  </div>
                )}

                {messages.filter((m) => m.id !== "welcome").length === 0 ? (
                  <div className="py-8 sm:py-14 px-4 flex flex-col items-center text-center max-w-3xl mx-auto w-full animate-in fade-in duration-300">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-xs mb-4 border ${
                        theme === "dark"
                          ? "bg-[#1B2127] border-[#2A333B] text-[#34D3BE]"
                          : "bg-white border-[#DCE3E8] text-[#0F766E]"
                      }`}
                    >
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <h2
                      className={`text-3xl sm:text-4xl font-bold tracking-tight mb-2.5 font-claude-serif ${
                        theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
                      }`}
                    >
                      EPIONA Research Assistant
                    </h2>
                    <p
                      className={`text-sm sm:text-[15px] max-w-lg mb-8 leading-relaxed ${
                        theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                      }`}
                    >
                      Asisten riset literatur akademik. Tanyakan mekanisme obat, analisis dokumen MyLibrary, atau telusuri jurnal PubMed.
                    </p>

                    {/* HERO CENTERED CHAT INPUT BOX (CLAUDE STYLE) */}
                    <div className="w-full text-left">
                      {/* PREVIEW ATTACHED FILES CHIPS DI TENGAH */}
                      {attachedFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2 px-1">
                          {attachedFiles.map((f) => {
                            const badge = getFileBadgeInfo(f.name, f.type);
                            return (
                              <div
                                key={f.id}
                                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium border animate-in fade-in duration-150 shadow-2xs ${
                                  theme === "dark"
                                    ? "bg-[#1B2127] border-[#2A333B] text-[#E6EDF2]"
                                    : "bg-white border-[#DCE3E8] text-[#12202B]"
                                }`}
                              >
                                {badge.category === "image" && f.dataUrl ? (
                                  <img
                                    src={f.dataUrl}
                                    alt={f.name}
                                    className="w-7 h-7 rounded-md object-cover border border-[#34D3BE]/30 cursor-pointer hover:scale-105 transition shrink-0"
                                    onClick={() => f.dataUrl && setLightboxImage({ src: f.dataUrl, title: f.name })}
                                  />
                                ) : (
                                  <FileFormatIcon filename={f.name} fileType={f.type} size="sm" />
                                )}
                                <span className="truncate max-w-[150px]" title={f.name}>{f.name}</span>
                                <span className={`text-[10px] ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                                  ({(f.size / 1024).toFixed(0)} KB)
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setAttachedFiles((prev) => prev.filter((item) => item.id !== f.id))}
                                  className={`p-0.5 rounded hover:text-rose-400 cursor-pointer ${
                                    theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                                  }`}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* MAIN INPUT CONTAINER DI TENGAH HERO */}
                      <form
                        onSubmit={handleSendMessage}
                        className={`border rounded-2xl p-3.5 sm:p-4 shadow-sm transition-all duration-300 ${
                          isRecording
                            ? theme === "dark"
                              ? "bg-[#1B2127] border-[#34D3BE] ring-2 ring-[#34D3BE]/60 shadow-[0_0_24px_rgba(52,211,190,0.45)] animate-pulse"
                              : "bg-white border-[#0F766E] ring-2 ring-[#0F766E]/50 shadow-[0_0_24px_rgba(15,118,110,0.35)] animate-pulse"
                            : theme === "dark"
                            ? "bg-[#1B2127] border-[#2A333B] focus-within:border-[#34D3BE] focus-within:ring-2 focus-within:ring-[#34D3BE]/30"
                            : "bg-white border-[#DCE3E8] focus-within:border-[#0F766E] focus-within:ring-2 focus-within:ring-[#0F766E]/20"
                        }`}
                      >
                        <div className="flex items-end gap-3">
                          <textarea
                            ref={chatTextareaRef}
                            value={inputQuestion}
                            onChange={(e) => {
                              setInputQuestion(e.target.value);
                              adjustTextareaHeight();
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage(e);
                              }
                            }}
                            placeholder={
                              isRecording
                                ? "🎙️ Sedang mendengarkan... Kata-kata langsung muncul di sini..."
                                : groundingMode === "academic"
                                ? "Bagaimana saya dapat membantu riset jurnal atau formulasi farmasi Anda hari ini?"
                                : "Bagaimana saya dapat membantu analisis dokumen atau formulasi farmasi Anda hari ini?"
                            }
                            disabled={isSending}
                            className={`w-full bg-transparent text-sm sm:text-[15px] focus:outline-none resize-none max-h-[340px] overflow-y-hidden disabled:opacity-50 leading-relaxed px-1 scrollbar-thin transition-all duration-75 ${
                              theme === "dark"
                                ? "text-[#E6EDF2] placeholder-[#9AA9B5]/70"
                                : "text-[#12202B] placeholder-[#5B6B78]/70"
                            }`}
                            style={{ minHeight: "56px" }}
                          />

                          {/* Tombol Kirim Pesan di Pojok Kanan Bawah Kotak Input */}
                          <button
                            type="submit"
                            disabled={isSending || (!inputQuestion.trim() && attachedFiles.length === 0)}
                            className={`p-2 rounded-xl transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer shrink-0 mb-0.5 ${
                              theme === "dark"
                                ? "bg-[#34D3BE] text-[#12161A] hover:bg-[#34D3BE]/90 disabled:bg-[#2A333B] disabled:text-[#9AA9B5]"
                                : "bg-[#0F766E] text-white hover:bg-[#0F766E]/90 disabled:bg-[#E2E8F0] disabled:text-[#94A3B8]"
                            }`}
                            title="Kirim Pesan (Enter)"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                      </form>

                      {/* SUB-BARIS BAWAH TEXTBOX HERO */}
                      <div className="flex items-center justify-between gap-2 mt-2.5 px-1 select-none">
                        {/* KIRI: Tombol + Lampiran & Tombol Mic Suara */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => chatAttachmentInputRef.current?.click()}
                            className={`p-1.5 rounded-lg border transition cursor-pointer flex items-center justify-center ${
                              theme === "dark"
                                ? "border-[#2A333B] text-[#9AA9B5] hover:text-[#E6EDF2] hover:bg-[#2A333B]"
                                : "border-[#DCE3E8] text-[#5B6B78] hover:text-[#12202B] hover:bg-[#F7F9FA]"
                            }`}
                            title="Lampirkan dokumen atau gambar (+)"
                          >
                            <Plus className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={toggleVoiceInput}
                            className={`p-1.5 rounded-lg transition cursor-pointer border flex items-center justify-center ${
                              isRecording
                                ? theme === "dark"
                                  ? "bg-[#34D3BE] text-[#12161A] border-[#34D3BE] ring-2 ring-[#34D3BE]/60 shadow-[0_0_16px_rgba(52,211,190,0.5)] animate-pulse"
                                  : "bg-[#0F766E] text-white border-[#0F766E] ring-2 ring-[#0F766E]/50 shadow-[0_0_16px_rgba(15,118,110,0.4)] animate-pulse"
                                : theme === "dark"
                                ? "bg-transparent border-[#2A333B] text-[#9AA9B5] hover:text-[#34D3BE] hover:border-[#34D3BE]"
                                : "bg-transparent border-[#DCE3E8] text-[#5B6B78] hover:text-[#0F766E] hover:border-[#0F766E]"
                            }`}
                            title={isRecording ? "Mendengarkan suara... Klik untuk berhenti" : "Gunakan Suara (Voice to Text)"}
                          >
                            {isRecording ? <MicOff className="w-4 h-4 text-rose-500" /> : <Mic className="w-4 h-4" />}
                          </button>
                        </div>

                        {/* TENGAH: Disclaimer Minimalis */}
                        <span className={`text-[11px] truncate text-center max-w-[200px] sm:max-w-none ${
                          theme === "dark" ? "text-[#9AA9B5]/75" : "text-[#5B6B78]/80"
                        }`}>
                          Epiona is AI and can make mistakes.
                        </span>

                        {/* KANAN: Toggle Mode Grounding */}
                        <div className={`flex items-center p-0.5 rounded-lg border shrink-0 text-xs ${
                          theme === "dark" ? "bg-[#12161A] border-[#2A333B]" : "bg-[#F7F9FA] border-[#DCE3E8]"
                        }`}>
                          <button
                            type="button"
                            onClick={() => setGroundingMode("library")}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10.5px] font-semibold transition cursor-pointer ${
                              groundingMode === "library"
                                ? theme === "dark"
                                  ? "bg-[#34D3BE] text-[#12161A] shadow-2xs"
                                  : "bg-[#0F766E] text-white shadow-2xs"
                                : theme === "dark"
                                ? "text-[#9AA9B5] hover:text-[#E6EDF2]"
                                : "text-[#5B6B78] hover:text-[#12202B]"
                            }`}
                            title="Riset terisolasi berbasis koleksi MyLibrary Anda"
                          >
                            <Library className="w-3 h-3" />
                            <span>Library</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setGroundingMode("academic")}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10.5px] font-semibold transition cursor-pointer ${
                              groundingMode === "academic"
                                ? theme === "dark"
                                  ? "bg-[#34D3BE] text-[#12161A] shadow-2xs"
                                  : "bg-[#0F766E] text-white shadow-2xs"
                                : theme === "dark"
                                ? "text-[#9AA9B5] hover:text-[#E6EDF2]"
                                : "text-[#5B6B78] hover:text-[#12202B]"
                            }`}
                            title="Riset literatur terbuka (PubMed, arXiv, jurnal farmasi)"
                          >
                            <Globe className="w-3 h-3" />
                            <span>Web</span>
                          </button>
                        </div>
                      </div>

                      {/* QUICK PROMPT CHIPS DI BAWAH KOTAK INPUT HERO */}
                      <div className="flex flex-wrap items-center justify-center gap-2 mt-6 select-none">
                        {[
                          { text: "Analisis mekanisme obat...", prompt: "Jelaskan mekanisme kerja dan farmakokinetik obat parasetamol dan ibuprofen." },
                          { text: "Rangkum modul MyLibrary...", prompt: "Berikan rangkuman komprehensif dari dokumen literatur yang telah saya unggah di MyLibrary." },
                          { text: "Cari jurnal akademik...", prompt: "Telusuri literatur jurnal terbaru mengenai interaksi obat dan stabilitas formulasi farmasi." },
                        ].map((chip, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setInputQuestion(chip.prompt);
                              if (chatTextareaRef.current) {
                                chatTextareaRef.current.focus();
                              }
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer shadow-2xs ${
                              theme === "dark"
                                ? "bg-[#1B2127] border-[#2A333B] text-[#9AA9B5] hover:text-[#E6EDF2] hover:border-[#34D3BE]/60 hover:bg-[#2A333B]"
                                : "bg-white border-[#DCE3E8] text-[#5B6B78] hover:text-[#12202B] hover:border-[#0F766E]/50 hover:bg-teal-50/40"
                            }`}
                          >
                            {chip.text}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-3xl mx-auto space-y-7 w-full">
                    {messages.filter((m) => m.id !== "welcome").map((m) => (
                      <div
                        key={m.id}
                        className={`group/msg flex flex-col ${
                          m.sender === "user" ? "items-end" : "items-start"
                        } animate-in fade-in duration-150 space-y-1`}
                      >
                        {/* BODY PESAN */}
                        {m.sender === "user" ? (
                          <>
                            {/* PESAN USER DI KANAN: GELEMBUNG SUBTLE ALA CLAUDE SESUAI TEMA BESERTA THUMBNAIL LAMPIRAN */}
                            <div
                            className={`group relative max-w-[85%] rounded-2xl px-4 py-2.5 text-sm md:text-[15px] leading-relaxed rounded-tr-xs shadow-2xs ${
                              theme === "dark"
                                ? "bg-[#1B2127] text-[#E6EDF2] border border-[#2A333B]"
                                : "bg-[#0F766E] text-white shadow-xs"
                            }`}
                          >
                            {/* DAFTAR LAMPIRAN GAMBAR & DOKUMEN */}
                            {m.attachments && m.attachments.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-2 pt-0.5">
                                {m.attachments.map((att, attIdx) => {
                                  const badge = getFileBadgeInfo(att.name, att.type);
                                  if (badge.category === "image" && att.dataUrl) {
                                    return (
                                      <div
                                        key={attIdx}
                                        className={`group relative rounded-xl overflow-hidden border shadow-sm transition cursor-pointer ${
                                          theme === "dark"
                                            ? "border-[#2A333B] bg-[#12161A] hover:border-[#34D3BE]"
                                            : "border-teal-700/60 bg-teal-800/60 hover:border-white"
                                        }`}
                                        onClick={() => setLightboxImage({ src: att.dataUrl!, title: att.name })}
                                      >
                                        <img
                                          src={att.dataUrl}
                                          alt={att.name}
                                          className="max-h-48 max-w-xs object-cover group-hover:scale-102 transition duration-200 rounded-lg"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1.5 text-white text-xs font-semibold backdrop-blur-[1px]">
                                          <ZoomIn className="w-4 h-4" />
                                          <span>Perbesar</span>
                                        </div>
                                        <div className="absolute bottom-1 left-1 right-1 px-1.5 py-0.5 rounded bg-black/75 text-[10px] text-zinc-200 truncate backdrop-blur-xs">
                                          {att.name}
                                        </div>
                                      </div>
                                    );
                                  }

                                  // Format Dokumen (PDF, Word, Sheet, TXT)
                                  return (
                                    <div
                                      key={attIdx}
                                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border shadow-2xs ${
                                        theme === "dark"
                                          ? "bg-[#12161A] border-[#2A333B] text-[#E6EDF2]"
                                          : "bg-teal-800/80 border-teal-600 text-white"
                                      }`}
                                    >
                                      <FileFormatIcon filename={att.name} fileType={att.type} size="sm" />
                                      <span className="truncate max-w-[160px] font-medium" title={att.name}>
                                        {att.name}
                                      </span>
                                      <span className="text-[10px] opacity-75">
                                        ({(att.size / 1024).toFixed(0)} KB)
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* KONTEN TEKS USER ATAU EDITOR INLINE */}
                            {editingMessageId === m.id ? (
                              <div className="w-full min-w-[280px] sm:min-w-[420px] pt-1">
                                <textarea
                                  value={editingMessageText}
                                  onChange={(e) => setEditingMessageText(e.target.value)}
                                  className={`w-full p-2.5 text-sm rounded-xl border outline-none resize-y min-h-[90px] ${
                                    theme === "dark"
                                      ? "bg-[#12161A] text-[#E6EDF2] border-[#34D3BE]/60 focus:border-[#34D3BE]"
                                      : "bg-white text-zinc-900 border-teal-300 focus:border-teal-500"
                                  }`}
                                  placeholder="Sunting pesan Anda..."
                                />
                                <div className="flex items-center justify-end gap-2 mt-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingMessageId(null)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer border ${
                                      theme === "dark"
                                        ? "bg-transparent text-[#9AA9B5] border-[#2A333B] hover:text-white"
                                        : "bg-transparent text-zinc-700 border-zinc-200 hover:bg-zinc-100"
                                    }`}
                                  >
                                    Batal
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditedMessage(m.id)}
                                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-teal-500 hover:bg-teal-600 text-white transition cursor-pointer shadow-xs"
                                  >
                                    Kirim Ulang
                                  </button>
                                </div>
                              </div>
                            ) : (
                              m.text && <div className="whitespace-pre-wrap">{m.text}</div>
                            )}
                          </div>

                          {/* ACTION BAR DI BAWAH PESAN USER (TOMBOL AKSI HANYA MUNCUL SAAT DI-HOVER, JAM DI KANAN FORMAT 24-JAM) */}
                          {editingMessageId !== m.id && (
                            <div className="flex items-center justify-end gap-2.5 mt-1.5 px-1 text-xs select-none">
                              {/* Tombol Regenerate, Edit, Copy HANYA MUNCUL KETIKA DI-HOVER */}
                              <div className="flex items-center gap-2 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-150">
                                <button
                                  type="button"
                                  onClick={() => handleRetryUserMessage(m)}
                                  className={`p-1 rounded-md transition cursor-pointer hover:scale-105 ${
                                    theme === "dark" ? "hover:text-[#34D3BE] text-[#9AA9B5]" : "hover:text-[#0F766E] text-zinc-500"
                                  }`}
                                  title="Generate ulang pertanyaan ini"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingMessageId(m.id);
                                    setEditingMessageText(m.text);
                                  }}
                                  className={`p-1 rounded-md transition cursor-pointer hover:scale-105 ${
                                    theme === "dark" ? "hover:text-[#34D3BE] text-[#9AA9B5]" : "hover:text-[#0F766E] text-zinc-500"
                                  }`}
                                  title="Edit pesan ini"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCopyMessage(m.id, m.text)}
                                  className={`p-1 rounded-md transition cursor-pointer hover:scale-105 ${
                                    theme === "dark" ? "hover:text-[#34D3BE] text-[#9AA9B5]" : "hover:text-[#0F766E] text-zinc-500"
                                  }`}
                                  title="Salin pesan"
                                >
                                  {copiedMessageId === m.id ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>

                              {/* Penanda Waktu User: Berada di Paling Kanan, Format 24-Jam Eksplisit */}
                              <span className="text-[11px] font-mono text-[#9AA9B5] opacity-75">
                                {format24HourDisplay(m.timestamp)}
                              </span>
                            </div>
                          )}
                        </>
                        ) : (
                          /* PESAN ASISTEN DI KIRI: CLEAN BORDERLESS STREAM ALA CLAUDE TANPA KOTAK KARTU/LABEL */
                          <div
                            className={`group relative w-full text-sm md:text-[15px] leading-relaxed pt-1 ${
                              theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
                            }`}
                          >
                            {/* TEKS JAWABAN ASISTEN DENGAN MARKDOWN CLEAN, GAMBAR INLINE & CITATION PILLS */}
                            <div className="leading-relaxed selection:bg-teal-500/20">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  img: ({ src, alt }: any) => {
                                    if (src && typeof src === "string" && src.startsWith("#fig-")) {
                                      const figIdx = parseInt(src.replace("#fig-", ""), 10);
                                      const fig = m.figures && m.figures[figIdx];
                                      if (!fig) return null;
                                      const linkedDoc = documents.find((d) => d.id === fig.document_id);
                                      const docTitle = linkedDoc?.title || "Dokumen Referensi";

                                      const triggerOpenPdf = (e: React.MouseEvent) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleCitationClick({
                                          document_id: fig.document_id,
                                          document_title: docTitle,
                                          page_number: fig.page_number,
                                          exact_quote: fig.caption || `Gambar Halaman ${fig.page_number}`,
                                          source_type: "local_pdf"
                                        });
                                      };

                                      return (
                                        <figure className="my-5 flex flex-col items-center justify-center select-none max-w-lg mx-auto">
                                          {/* GAMBAR POTONGAN MURNI BERSIH TANPA OVERLAY HOVER & TANPA ZOOM BUTTON */}
                                          <div
                                            className={`rounded-xl overflow-hidden border shadow-2xs ${
                                              theme === "dark"
                                                ? "bg-[#181E24] border-[#2A333B]"
                                                : "bg-white border-[#E2E8F0]"
                                            }`}
                                          >
                                            <img
                                              src={`${API_BASE}${fig.image_url}`}
                                              alt={fig.caption || `Gambar ${figIdx + 1}`}
                                              className="max-h-72 sm:max-h-80 w-auto object-contain block"
                                              loading="lazy"
                                            />
                                          </div>

                                          {/* CAPTION & SUMBER REFERENSI ALA PAPER ILMIAH (KLIK DI SINI MEMBUKA PDF HALAMAN ASAL) */}
                                          <figcaption
                                            onClick={triggerOpenPdf}
                                            className="mt-2 text-center cursor-pointer transition max-w-md group/cap"
                                            title={`Klik referensi untuk membuka ${docTitle} pada Halaman ${fig.page_number}`}
                                          >
                                            <div className={`text-xs font-semibold ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
                                              <span className={`font-bold mr-1 ${theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"}`}>
                                                Gambar {figIdx + 1}.
                                              </span>
                                              <span>{fig.caption || `Ilustrasi pada halaman ${fig.page_number}`}</span>
                                            </div>
                                            <div className={`text-[11px] mt-0.5 flex items-center justify-center gap-1 group-hover/cap:underline ${
                                              theme === "dark" ? "text-[#9AA9B5] group-hover/cap:text-[#34D3BE]" : "text-[#5B6B78] group-hover/cap:text-[#0F766E]"
                                            }`}>
                                              <span>Sumber: {docTitle}, Halaman {fig.page_number}</span>
                                              <ExternalLink className="w-2.5 h-2.5" />
                                            </div>
                                          </figcaption>
                                        </figure>
                                      );
                                    }
                                    return <img src={src} alt={alt} className="rounded-lg my-2 max-w-full" />;
                                  },
                                  strong: ({ node, ...props }) => (
                                    <strong
                                      className={`font-semibold ${
                                        theme === "dark" ? "text-white" : "text-[#12202B]"
                                      }`}
                                      {...props}
                                    />
                                  ),
                                  b: ({ node, ...props }) => (
                                    <b
                                      className={`font-semibold ${
                                        theme === "dark" ? "text-white" : "text-[#12202B]"
                                      }`}
                                      {...props}
                                    />
                                  ),
                                  em: ({ node, ...props }) => (
                                    <em
                                      className={`italic ${
                                        theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"
                                      }`}
                                      {...props}
                                    />
                                  ),
                                  h1: ({ node, ...props }) => (
                                    <h1
                                      className={`text-xl font-bold mt-4 mb-2 tracking-tight font-claude-serif ${
                                        theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
                                      }`}
                                      {...props}
                                    />
                                  ),
                                  h2: ({ node, ...props }) => (
                                    <h2
                                      className={`text-lg font-bold mt-3.5 mb-2 tracking-tight font-claude-serif ${
                                        theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
                                      }`}
                                      {...props}
                                    />
                                  ),
                                  h3: ({ node, ...props }) => (
                                    <h3
                                      className={`text-base font-bold mt-3 mb-1.5 font-claude-serif ${
                                        theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
                                      }`}
                                      {...props}
                                    />
                                  ),
                                  p: ({ node, ...props }) => (
                                    <p
                                      className={`my-2 leading-relaxed ${
                                        theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
                                      }`}
                                      {...props}
                                    />
                                  ),
                                  ul: ({ node, ...props }) => (
                                    <ul
                                      className={`list-disc list-outside ml-5 my-2 space-y-1 ${
                                        theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
                                      }`}
                                      {...props}
                                    />
                                  ),
                                  ol: ({ node, ...props }) => (
                                    <ol
                                      className={`list-decimal list-outside ml-5 my-2 space-y-1.5 ${
                                        theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
                                      }`}
                                      {...props}
                                    />
                                  ),
                                  li: ({ node, ...props }) => (
                                    <li className="leading-relaxed pl-1 marker:text-teal-500" {...props} />
                                  ),
                                  pre: ({ node, ...props }) => (
                                    <pre
                                      className={`border rounded-xl p-3.5 my-3 overflow-x-auto font-mono text-xs ${
                                        theme === "dark"
                                          ? "bg-[#12161A] border-[#2A333B] text-[#E6EDF2]"
                                          : "bg-slate-900 border-slate-800 text-slate-100"
                                      }`}
                                      {...props}
                                    />
                                  ),
                                  code: ({ node, className, children, ...props }: any) => {
                                    const isInline = !className && typeof children === "string" && !children.includes("\n");
                                    if (isInline) {
                                      return (
                                        <code
                                          className={`font-mono text-[13px] px-1.5 py-0.5 rounded border ${
                                            theme === "dark"
                                              ? "bg-[#1B2127] text-[#34D3BE] border-[#2A333B]"
                                              : "bg-teal-50 text-[#0F766E] border-teal-200"
                                          }`}
                                          {...props}
                                        >
                                          {children}
                                        </code>
                                      );
                                    }
                                    return <code className={className} {...props}>{children}</code>;
                                  },
                                  blockquote: ({ node, ...props }) => (
                                    <blockquote
                                      className={`border-l-2 border-[#0F766E] pl-3.5 my-2 italic ${
                                        theme === "dark" ? "text-[#9AA9B5] border-[#34D3BE]" : "text-[#5B6B78] border-[#0F766E]"
                                      }`}
                                      {...props}
                                    />
                                  ),
                                  table: ({ node, ...props }) => (
                                    <div
                                      className={`overflow-x-auto my-3 rounded-lg border ${
                                        theme === "dark" ? "border-[#2A333B]" : "border-[#DCE3E8]"
                                      }`}
                                    >
                                      <table className="w-full text-xs text-left border-collapse" {...props} />
                                    </div>
                                  ),
                                  th: ({ node, ...props }) => (
                                    <th
                                      className={`border-b px-3 py-2 font-bold ${
                                        theme === "dark"
                                          ? "border-[#2A333B] bg-[#1B2127] text-[#E6EDF2]"
                                          : "border-[#DCE3E8] bg-[#F7F9FA] text-[#12202B]"
                                      }`}
                                      {...props}
                                    />
                                  ),
                                  td: ({ node, ...props }) => (
                                    <td
                                      className={`border-b px-3 py-2 ${
                                        theme === "dark" ? "border-[#2A333B]" : "border-[#DCE3E8]"
                                      }`}
                                      {...props}
                                    />
                                  ),
                                  a: ({ href, children, ...props }: any) => {
                                    if (href && typeof href === "string" && href.startsWith("#cite-")) {
                                      const citeNum = parseInt(href.replace("#cite-", ""), 10);
                                      const citeIdx = citeNum - 1;
                                      const citation = m.citations && m.citations[citeIdx];
                                      const cleanDocTitle = citation?.document_title
                                        ? citation.document_title.replace(/\.pdf$/i, "").replace(/[-_]/g, " ").slice(0, 24)
                                        : "";
                                      const isAcademic = citation?.source_type === "academic_web" || Boolean(citation?.journal_name);
                                      const labelText = isAcademic
                                        ? `${citation?.journal_name || "Jurnal"} (${citation?.publication_year || "2024"})`
                                        : cleanDocTitle;
                                      return (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (citation) {
                                              handleCitationClick(citation);
                                            }
                                          }}
                                          title={
                                            citation
                                              ? isAcademic
                                                ? `JURNAL: ${citation.document_title}\nPublikasi: ${citation.journal_name} (${citation.publication_year})\nDOI: ${citation.doi || '-'}\n\nKutipan Bukti Empiris:\n"${citation.exact_quote}"`
                                                : `Dokumen: ${citation.document_title}\nHalaman: ${citation.page_number}\n\nKutipan:\n"${citation.exact_quote}"`
                                              : `Rujukan [${citeNum}]`
                                          }
                                          className={`inline-flex items-center gap-1.5 max-w-[260px] h-[21px] px-2 mx-1 text-[11px] font-semibold rounded-md border transition-all cursor-pointer align-baseline select-none -translate-y-0.5 shadow-2xs group ${
                                            theme === "dark"
                                              ? "bg-[#1B2127] text-[#E6EDF2] border-[#2A333B] hover:bg-[#34D3BE] hover:text-[#12161A] hover:border-[#34D3BE]"
                                              : "bg-teal-50/80 text-teal-900 border-teal-200 hover:bg-[#0F766E] hover:text-white hover:border-[#0F766E]"
                                          }`}
                                        >
                                          <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                                            theme === "dark" ? "bg-[#34D3BE] text-[#12161A] group-hover:bg-[#12161A] group-hover:text-[#34D3BE]" : "bg-[#0F766E] text-white group-hover:bg-white group-hover:text-[#0F766E]"
                                          }`}>
                                            {citeNum}
                                          </span>
                                          {labelText && (
                                            <span className={`truncate text-[10.5px] ${theme === "dark" ? "text-[#9AA9B5] group-hover:text-[#12161A]" : "text-teal-800 group-hover:text-white"}`}>
                                              {labelText}
                                            </span>
                                          )}
                                          {!isAcademic && citation && (
                                            <span className={`text-[10px] font-bold shrink-0 ${theme === "dark" ? "text-[#34D3BE] group-hover:text-[#12161A]" : "text-[#0F766E] group-hover:text-white"}`}>
                                              hlm.{citation.page_number}
                                            </span>
                                          )}
                                          {isAcademic && (
                                            <span className={`text-[9px] font-bold px-1 py-0.2 rounded shrink-0 ${
                                              theme === "dark" ? "bg-[#34D3BE]/20 text-[#34D3BE] group-hover:bg-[#12161A] group-hover:text-[#34D3BE]" : "bg-teal-200/80 text-teal-900 group-hover:bg-white group-hover:text-[#0F766E]"
                                            }`}>
                                              Jurnal
                                            </span>
                                          )}
                                        </button>
                                      );
                                    }
                                    return (
                                      <a
                                        href={href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={theme === "dark" ? "text-[#34D3BE] hover:underline font-semibold" : "text-[#0F766E] hover:underline font-semibold"}
                                        {...props}
                                      >
                                        {children}
                                      </a>
                                    );
                                  }
                                }}
                              >
                                {formatInlineCitations(injectFiguresIntoContent(m.text, m.figures))}
                              </ReactMarkdown>
                              {isTypingStream && streamingMsgId === m.id && (
                                <span className={`inline-block w-1.5 h-4 ml-1 rounded-xs animate-pulse align-middle ${
                                  theme === "dark" ? "bg-[#34D3BE]" : "bg-[#0F766E]"
                                }`} />
                              )}
                            </div>

                            {/* FOOTER ACTION BAR DI BAWAH PESAN ASISTEN: SALIN & JAM TAMPIL TERUS (JAM DI KANAN 24-JAM) */}
                            <div className="flex items-center justify-between w-full mt-3 pt-1 text-xs select-none">
                              {/* Tombol Salin di Kiri (Tampil Terus) */}
                              <button
                                type="button"
                                onClick={() => handleCopyMessage(m.id, m.text)}
                                className={`p-1 rounded-md transition cursor-pointer hover:scale-105 flex items-center gap-1.5 ${
                                  theme === "dark" ? "hover:text-[#34D3BE] text-[#9AA9B5]" : "hover:text-[#0F766E] text-zinc-500"
                                }`}
                                title="Salin respon asisten"
                              >
                                {copiedMessageId === m.id ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-[11px] text-emerald-500 font-semibold">Tersalin</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span className="text-[11px]">Salin</span>
                                  </>
                                )}
                              </button>

                              {/* Jam Asisten di Kanan (Tampil Terus, Format 24-Jam Eksplisit 23.00) */}
                              <span className="text-[11px] font-mono text-[#9AA9B5] opacity-80 ml-auto">
                                {format24HourDisplay(m.timestamp)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* CLAUDE-STYLE "Thinking..." STATUS INDICATOR */}
                    {isSending && (
                      <div className="flex items-center py-2.5 animate-in fade-in duration-200">
                        <div
                          className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border text-xs shadow-xs transition-all ${
                            theme === "dark"
                              ? "bg-[#181D22] border-[#2A333B] text-[#DCE3E8]"
                              : "bg-white border-[#E2E8F0] text-[#1E293B]"
                          }`}
                        >
                          {/* Sparkle Icon Berkedip Lembut ala Claude */}
                          <Sparkles
                            className={`w-3.5 h-3.5 animate-spin [animation-duration:3s] ${
                              theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"
                            }`}
                          />
                          <div className="flex items-center gap-1.5 font-medium text-xs">
                            <span className={theme === "dark" ? "text-white font-semibold" : "text-[#0F172A] font-semibold"}>
                              Thinking
                            </span>
                            <span className="flex items-center tracking-widest text-[#9AA9B5] animate-pulse">
                              ...
                            </span>
                            <span className={`text-[11px] font-normal pl-1 border-l ${
                              theme === "dark" ? "border-[#2A333B] text-[#9AA9B5]" : "border-[#E2E8F0] text-[#64748B]"
                            }`}>
                              {sendingStatusText}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* CHAT INPUT FORM (CLAUDE/PERPLEXITY MODERN PRODUCTIVITY BAR - HANYA MUNCUL DI BAWAH KETIKA SUDAH ADA PESAN) */}
              {messages.filter((m) => m.id !== "welcome").length > 0 && (
                <div
                  className={`p-4 sm:p-5 pt-1 transition-colors relative ${
                    theme === "dark"
                      ? "bg-[#12161A]"
                      : "bg-[#F7F9FA]"
                  }`}
                >
                  {/* GRADASI HALUS DI ATAS TEXTBOX INPUT (FADE MASK BAWAH AGAR PESAN MEMUDAR ELEGAN KE AREA INPUT) */}
                  <div
                    className={`pointer-events-none absolute -top-8 sm:-top-10 left-0 right-0 h-8 sm:h-10 z-10 bg-gradient-to-t ${
                      theme === "dark"
                        ? "from-[#12161A] to-transparent"
                        : "from-[#F7F9FA] to-transparent"
                    }`}
                  />

                  <div className="max-w-3xl mx-auto">
                    {/* Hidden File Input for Attachments */}
                    <input
                      type="file"
                      ref={chatAttachmentInputRef}
                      onChange={(e) => {
                        const files = e.target.files;
                        if (!files || files.length === 0) return;
                        Array.from(files).forEach((file) => {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const dataUrl = ev.target?.result as string;
                            const base64 = dataUrl && dataUrl.includes(";base64,") ? dataUrl.split(";base64,")[1] : "";
                            setAttachedFiles((prev) => [
                              ...prev,
                              {
                                id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                                name: file.name,
                                size: file.size,
                                type: file.type || "application/octet-stream",
                                dataUrl,
                                base64,
                              },
                            ]);
                          };
                          reader.readAsDataURL(file);
                        });
                        e.target.value = "";
                      }}
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv"
                      multiple
                      className="hidden"
                    />

                    {/* PREVIEW ATTACHED FILES CHIPS */}
                    {attachedFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2 px-1">
                        {attachedFiles.map((f) => {
                          const badge = getFileBadgeInfo(f.name, f.type);
                          return (
                            <div
                              key={f.id}
                              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium border animate-in fade-in duration-150 shadow-2xs ${
                                theme === "dark"
                                  ? "bg-[#1B2127] border-[#2A333B] text-[#E6EDF2]"
                                  : "bg-white border-[#DCE3E8] text-[#12202B]"
                              }`}
                            >
                              {badge.category === "image" && f.dataUrl ? (
                                <img
                                  src={f.dataUrl}
                                  alt={f.name}
                                  className="w-7 h-7 rounded-md object-cover border border-[#34D3BE]/30 cursor-pointer hover:scale-105 transition shrink-0"
                                  onClick={() => f.dataUrl && setLightboxImage({ src: f.dataUrl, title: f.name })}
                                />
                              ) : (
                                <FileFormatIcon filename={f.name} fileType={f.type} size="sm" />
                              )}
                              <span className="truncate max-w-[150px]" title={f.name}>{f.name}</span>
                              <span className={`text-[10px] ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                                ({(f.size / 1024).toFixed(0)} KB)
                              </span>
                              <button
                                type="button"
                                onClick={() => setAttachedFiles((prev) => prev.filter((item) => item.id !== f.id))}
                                className={`p-0.5 rounded hover:text-rose-400 cursor-pointer ${
                                  theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                                }`}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* MAIN INPUT CONTAINER (KOMPAK & BERSIH ALA CLAUDE, GLOW PULSING SAAT MIC AKTIF) */}
                    <form
                      onSubmit={handleSendMessage}
                      className={`border rounded-2xl p-2.5 sm:p-3 shadow-xs transition-all duration-300 ${
                        isRecording
                          ? theme === "dark"
                            ? "bg-[#1B2127] border-[#34D3BE] ring-2 ring-[#34D3BE]/60 shadow-[0_0_24px_rgba(52,211,190,0.45)] animate-pulse"
                            : "bg-white border-[#0F766E] ring-2 ring-[#0F766E]/50 shadow-[0_0_24px_rgba(15,118,110,0.35)] animate-pulse"
                          : theme === "dark"
                          ? "bg-[#1B2127] border-[#2A333B] focus-within:border-[#34D3BE] focus-within:ring-1 focus-within:ring-[#34D3BE]/30"
                          : "bg-white border-[#DCE3E8] focus-within:border-[#0F766E] focus-within:ring-1 focus-within:ring-[#0F766E]/20"
                      }`}
                    >
                      <div className="flex items-end gap-2">
                        <textarea
                          ref={chatTextareaRef}
                          value={inputQuestion}
                          onChange={(e) => {
                            setInputQuestion(e.target.value);
                            adjustTextareaHeight();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage(e);
                            }
                          }}
                          placeholder={
                            isRecording
                              ? "🎙️ Sedang mendengarkan... Kata-kata langsung muncul di sini..."
                              : groundingMode === "academic"
                              ? "Ajukan pertanyaan riset jurnal akademik..."
                              : "Tanyakan topik farmasi atau analisis dokumen MyLibrary..."
                          }
                          disabled={isSending}
                          className={`w-full bg-transparent text-sm focus:outline-none resize-none max-h-[340px] overflow-y-hidden disabled:opacity-50 leading-relaxed px-1.5 scrollbar-thin transition-all duration-75 ${
                            theme === "dark"
                              ? "text-[#E6EDF2] placeholder-[#9AA9B5]/60"
                              : "text-[#12202B] placeholder-[#5B6B78]/60"
                          }`}
                          style={{ minHeight: "40px" }}
                        />

                        {/* Tombol Kirim Pesan di Pojok Kanan Bawah Kotak Input */}
                        <button
                          type="submit"
                          disabled={isSending || (!inputQuestion.trim() && attachedFiles.length === 0)}
                          className={`p-1.5 rounded-xl transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer shrink-0 mb-0.5 ${
                            theme === "dark"
                              ? "bg-[#34D3BE] text-[#12161A] hover:bg-[#34D3BE]/90 disabled:bg-[#2A333B] disabled:text-[#9AA9B5]"
                              : "bg-[#0F766E] text-white hover:bg-[#0F766E]/90 disabled:bg-[#E2E8F0] disabled:text-[#94A3B8]"
                          }`}
                          title="Kirim Pesan (Enter)"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </form>

                    {/* SUB-BARIS BAWAH TEXTBOX (KIRI: + & MIC, TENGAH: DISCLAIMER, KANAN: TOGGLE KOMPAK) */}
                    <div className="flex items-center justify-between gap-2 mt-2 px-1 select-none">
                      {/* KIRI: Tombol + Lampiran & Tombol Mic Suara */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => chatAttachmentInputRef.current?.click()}
                          className={`p-1.5 rounded-lg border transition cursor-pointer flex items-center justify-center ${
                            theme === "dark"
                              ? "border-[#2A333B] text-[#9AA9B5] hover:text-[#E6EDF2] hover:bg-[#2A333B]"
                              : "border-[#DCE3E8] text-[#5B6B78] hover:text-[#12202B] hover:bg-[#F7F9FA]"
                          }`}
                          title="Lampirkan dokumen atau gambar (+)"
                        >
                          <Plus className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={toggleVoiceInput}
                          className={`p-1.5 rounded-lg transition cursor-pointer border flex items-center justify-center ${
                            isRecording
                              ? theme === "dark"
                                ? "bg-[#34D3BE] text-[#12161A] border-[#34D3BE] ring-2 ring-[#34D3BE]/60 shadow-[0_0_16px_rgba(52,211,190,0.5)] animate-pulse"
                                : "bg-[#0F766E] text-white border-[#0F766E] ring-2 ring-[#0F766E]/50 shadow-[0_0_16px_rgba(15,118,110,0.4)] animate-pulse"
                              : theme === "dark"
                              ? "bg-transparent border-[#2A333B] text-[#9AA9B5] hover:text-[#34D3BE] hover:border-[#34D3BE]"
                              : "bg-transparent border-[#DCE3E8] text-[#5B6B78] hover:text-[#0F766E] hover:border-[#0F766E]"
                          }`}
                          title={isRecording ? "Mendengarkan suara... Klik untuk berhenti" : "Gunakan Suara (Voice to Text)"}
                        >
                          {isRecording ? <MicOff className="w-4 h-4 text-rose-500" /> : <Mic className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* TENGAH: Disclaimer Minimalis Tanpa Bertabrakan */}
                      <span className={`text-[11px] truncate text-center max-w-[200px] sm:max-w-none ${
                        theme === "dark" ? "text-[#9AA9B5]/75" : "text-[#5B6B78]/80"
                      }`}>
                        Epiona is AI and can make mistakes.
                      </span>

                      {/* KANAN: Toggle Mode Grounding Kompak & Hemat Ruang */}
                      <div className={`flex items-center p-0.5 rounded-lg border shrink-0 text-xs ${
                        theme === "dark" ? "bg-[#12161A] border-[#2A333B]" : "bg-[#F7F9FA] border-[#DCE3E8]"
                      }`}>
                        <button
                          type="button"
                          onClick={() => setGroundingMode("library")}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold transition cursor-pointer ${
                            groundingMode === "library"
                              ? theme === "dark"
                                ? "bg-[#34D3BE] text-[#12161A] shadow-2xs"
                                : "bg-[#0F766E] text-white shadow-2xs"
                              : theme === "dark"
                              ? "text-[#9AA9B5] hover:text-[#E6EDF2]"
                              : "text-[#5B6B78] hover:text-[#12202B]"
                          }`}
                          title="Riset terisolasi berbasis koleksi MyLibrary Anda"
                        >
                          <Library className="w-3 h-3" />
                          <span>Library</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setGroundingMode("academic")}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold transition cursor-pointer ${
                            groundingMode === "academic"
                              ? theme === "dark"
                                ? "bg-[#34D3BE] text-[#12161A] shadow-2xs"
                                : "bg-[#0F766E] text-white shadow-2xs"
                              : theme === "dark"
                              ? "text-[#9AA9B5] hover:text-[#E6EDF2]"
                              : "text-[#5B6B78] hover:text-[#12202B]"
                          }`}
                          title="Riset literatur terbuka (PubMed, arXiv, jurnal farmasi)"
                        >
                          <Globe className="w-3 h-3" />
                          <span>Web</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* PANEL KANAN: DUAL-PANE VIEWER (LEMBARAN PDF LOKAL ATAU ACADEMIC EVIDENCE VIEWER ALA PERPLEXITY) */}
            {isPdfPanelOpen && (
              <div className={`flex flex-1 flex-col overflow-hidden h-full ${
                theme === "dark" ? "bg-[#12161A] border-l border-[#2A333B]" : "bg-[#F7F9FA] border-l border-[#DCE3E8]"
              }`}>
                {activeAcademicCitation ? (
                  /* ======================================================== */
                  /* ACADEMIC EVIDENCE VIEWER (ALA PERPLEXITY & CONSENSUS)    */
                  /* ======================================================== */
                  <div className="flex-1 flex flex-col h-full overflow-hidden animate-in fade-in duration-150">
                    {/* TOP HEADER ACADEMIC VIEWER */}
                    <div className={`h-12 px-4 flex items-center justify-between text-xs shrink-0 border-b shadow-xs z-10 ${
                      theme === "dark" ? "bg-[#1B2127] border-[#2A333B] text-[#E6EDF2]" : "bg-white border-[#DCE3E8] text-[#12202B]"
                    }`}>
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-[10px] shrink-0 ${
                          theme === "dark" ? "bg-[#34D3BE] text-[#12161A]" : "bg-[#0F766E] text-white"
                        }`}>
                          <Globe className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <span className={`font-bold text-xs truncate ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
                            {activeAcademicCitation.journal_name || "Jurnal Akademik"}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0 border ${
                            theme === "dark" ? "bg-[#34D3BE]/15 text-[#34D3BE] border-[#34D3BE]/30" : "bg-[#CCFBF1] text-[#0F766E] border-teal-200"
                          }`}>
                            {activeAcademicCitation.publication_year || "2024"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {activeAcademicCitation.url && (
                          <a
                            href={activeAcademicCitation.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                              theme === "dark"
                                ? "border-[#2A333B] bg-[#12161A] text-[#34D3BE] hover:bg-[#2A333B]"
                                : "border-[#DCE3E8] bg-white text-[#0F766E] hover:bg-[#F7F9FA]"
                            }`}
                            title="Buka naskah resmi di situs jurnal / penerbit"
                          >
                            <span>Buka Jurnal</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}

                        <button
                          onClick={() => {
                            setActiveAcademicCitation(null);
                            setIsPdfPanelOpen(false);
                          }}
                          className={`p-1.5 rounded-lg transition cursor-pointer ${
                            theme === "dark" ? "text-[#9AA9B5] hover:text-rose-400 hover:bg-rose-950/40" : "text-[#5B6B78] hover:text-rose-600 hover:bg-rose-50"
                          }`}
                          title="Tutup panel bukti"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* CONTENT BUKTI ILMIAH EMPIRIS */}
                    <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
                      {/* BADGE PEER REVIEW & REPOSITORY */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                          theme === "dark" ? "bg-teal-950/60 text-[#34D3BE] border-teal-800/80" : "bg-teal-50 text-[#0F766E] border-teal-200"
                        }`}>
                          <ShieldCheck className="w-3 h-3" />
                          Peer-Reviewed / Indexed Literature
                        </span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                          theme === "dark" ? "border-[#2A333B] text-[#9AA9B5]" : "border-[#DCE3E8] text-[#5B6B78]"
                        }`}>
                          DOI: {activeAcademicCitation.doi || "Tersedia Online"}
                        </span>
                      </div>

                      {/* JUDUL ARTIKEL JURNAL */}
                      <div>
                        <h2 className={`text-base sm:text-lg font-bold leading-snug tracking-tight font-claude-serif ${
                          theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
                        }`}>
                          {activeAcademicCitation.document_title}
                        </h2>
                        {activeAcademicCitation.authors && activeAcademicCitation.authors.length > 0 && (
                          <p className={`text-xs mt-1.5 font-medium ${
                            theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                          }`}>
                            Penulis: {activeAcademicCitation.authors.join(", ")}
                          </p>
                        )}
                      </div>

                      {/* SOROTAN BUKTI KUNCI (KEY EMPIRICAL EVIDENCE SNIPPET) */}
                      <div className={`p-4 rounded-2xl border shadow-2xs ${
                        theme === "dark"
                          ? "bg-amber-950/30 border-amber-800/60 text-amber-200"
                          : "bg-amber-50/80 border-amber-200 text-amber-950"
                      }`}>
                        <div className="flex items-center gap-2 mb-1.5 font-bold text-xs">
                          <BookmarkCheck className={`w-4 h-4 ${theme === "dark" ? "text-amber-400" : "text-amber-700"}`} />
                          <span>Temuan Bukti Empiris Kunci yang Dirujuk:</span>
                        </div>
                        <p className="text-xs sm:text-sm italic leading-relaxed font-medium">
                          "{activeAcademicCitation.exact_quote}"
                        </p>
                      </div>

                      {/* ABSTRAK LENGKAP & METODOLOGI */}
                      {activeAcademicCitation.abstract_snippet && (
                        <div className={`p-4 rounded-2xl border ${
                          theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
                        }`}>
                          <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${
                            theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"
                          }`}>
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Abstrak &amp; Metodologi Penelitian</span>
                          </h3>
                          <p className={`text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
                            theme === "dark" ? "text-[#E6EDF2]/90" : "text-[#12202B]/90"
                          }`}>
                            {activeAcademicCitation.abstract_snippet}
                          </p>
                        </div>
                      )}

                      {/* EMBED FULL-TEXT PDF / WEB IFRAME JIKA TERSEDIA OPEN ACCESS */}
                      {activeAcademicCitation.pdf_url && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-bold ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
                              Naskah Lengkap Open-Access (PDF)
                            </span>
                            <a
                              href={activeAcademicCitation.pdf_url}
                              target="_blank"
                              rel="noreferrer"
                              className={`text-[11px] font-semibold underline ${theme === "dark" ? "text-[#34D3BE]" : "text-[#0F766E]"}`}
                            >
                              Buka di Tab Terpisah &rarr;
                            </a>
                          </div>
                          <div className="w-full h-96 rounded-xl border overflow-hidden border-inherit bg-slate-900">
                            <iframe
                              src={activeAcademicCitation.pdf_url}
                              className="w-full h-full border-0"
                              title="Pratinjau PDF Jurnal"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : activeDoc ? (
                  <div className="flex-1 flex flex-col h-full overflow-hidden">
                    {/* MINIMALIST HEADER BAR DOKUMEN */}
                    <div className={`h-12 px-3 sm:px-4 flex items-center justify-between text-xs shrink-0 shadow-xs z-10 border-b ${
                      theme === "dark"
                        ? "bg-[#1B2127] border-[#2A333B] text-[#E6EDF2]"
                        : "bg-white border-[#DCE3E8] text-[#12202B]"
                    }`}>
                      {/* Kiri: Judul Dokumen & Badge Merah PDF */}
                      <div className="flex items-center gap-2 overflow-hidden max-w-xs md:max-w-sm">
                        <div className="w-6 h-6 rounded bg-[#E8684A] flex items-center justify-center text-white font-black text-[9px] shrink-0 shadow-xs">
                          PDF
                        </div>
                        <span className={`font-bold truncate text-xs ${
                          theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
                        }`} title={activeDoc.title}>
                          {activeDoc.title}
                        </span>
                      </div>

                      {/* Tengah & Kanan: Kontrol Halaman, Unduh, Popout, Tutup */}
                      <div className="flex items-center gap-2">
                        {/* Paginasi / Lompat Halaman Cepat */}
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border ${
                          theme === "dark"
                            ? "bg-[#12161A] border-[#2A333B] text-[#E6EDF2]"
                            : "bg-[#F7F9FA] border-[#DCE3E8] text-[#12202B]"
                        }`}>
                          <button
                            onClick={() => setTargetPage((p) => Math.max(1, p - 1))}
                            disabled={targetPage <= 1}
                            className={`p-0.5 rounded disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer ${
                              theme === "dark" ? "hover:bg-[#2A333B]" : "hover:bg-white"
                            }`}
                            title="Halaman sebelumnya"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <span>Hlm:</span>
                          <input
                            type="number"
                            min={1}
                            max={activeDoc.total_pages}
                            value={targetPage}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (val >= 1 && val <= activeDoc.total_pages) {
                                setTargetPage(val);
                              }
                            }}
                            className={`w-10 text-center rounded py-0.5 font-bold outline-none border ${
                              theme === "dark"
                                ? "bg-[#1B2127] border-[#2A333B] text-[#E6EDF2]"
                                : "bg-white border-[#DCE3E8] text-[#12202B]"
                            }`}
                          />
                          <span className={`font-medium ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>/ {activeDoc.total_pages}</span>
                          <button
                            onClick={() => setTargetPage((p) => Math.min(activeDoc.total_pages, p + 1))}
                            disabled={targetPage >= activeDoc.total_pages}
                            className={`p-0.5 rounded disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer ${
                              theme === "dark" ? "hover:bg-[#2A333B]" : "hover:bg-white"
                            }`}
                            title="Halaman berikutnya"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Unduh & Popout Tab */}
                        <a
                          href={`${API_BASE}/api/v1/documents/${activeDoc.id}/pdf?download=1&token=${currentUser.token}`}
                          download={activeDoc.filename}
                          className={`p-1.5 rounded-lg transition cursor-pointer ${
                            theme === "dark"
                              ? "text-[#9AA9B5] hover:text-[#E6EDF2] hover:bg-[#2A333B]"
                              : "text-[#5B6B78] hover:text-[#12202B] hover:bg-[#F7F9FA]"
                          }`}
                          title="Unduh file PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>

                        <a
                          href={`${API_BASE}/api/v1/documents/${activeDoc.id}/pdf?token=${currentUser.token}`}
                          target="_blank"
                          rel="noreferrer"
                          className={`p-1.5 rounded-lg transition cursor-pointer ${
                            theme === "dark"
                              ? "text-[#9AA9B5] hover:text-[#E6EDF2] hover:bg-[#2A333B]"
                              : "text-[#5B6B78] hover:text-[#12202B] hover:bg-[#F7F9FA]"
                          }`}
                          title="Buka di tab browser baru"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>

                        {/* Tombol Tutup Panel */}
                        <button
                          onClick={() => setIsPdfPanelOpen(false)}
                          className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg border transition cursor-pointer ${
                            theme === "dark"
                              ? "text-[#9AA9B5] hover:text-rose-400 hover:bg-rose-950/40 border-[#2A333B]"
                              : "text-[#5B6B78] hover:text-rose-600 hover:bg-rose-50 border-[#DCE3E8]"
                          }`}
                          title="Tutup panel dokumen"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Tutup</span>
                        </button>
                      </div>
                    </div>

                    {/* BANNER SOROTAN BUKTI KUTIPAN (KETIKA SITASI DIKLIK) */}
                    {highlightQuote && (
                      <div className={`px-4 py-2 text-xs flex items-center justify-between shadow-xs shrink-0 border-b ${
                        theme === "dark"
                          ? "bg-amber-950/70 border-amber-800/80 text-amber-200"
                          : "bg-amber-100 border-amber-300 text-amber-950"
                      }`}>
                        <div className="flex items-center gap-2 overflow-hidden">
                          <BookmarkCheck className={`w-4 h-4 shrink-0 font-bold ${
                            theme === "dark" ? "text-amber-400" : "text-amber-700"
                          }`} />
                          <span className={`font-bold shrink-0 ${
                            theme === "dark" ? "text-amber-300" : "text-amber-900"
                          }`}>Bukti Halaman {targetPage}:</span>
                          <span className="italic truncate font-medium">"{highlightQuote}"</span>
                        </div>
                        <button
                          onClick={() => setHighlightQuote(null)}
                          className={`text-[11px] underline font-bold shrink-0 ml-3 cursor-pointer ${
                            theme === "dark" ? "text-amber-300 hover:text-amber-100" : "text-amber-800 hover:text-amber-950"
                          }`}
                        >
                          Tutup
                        </button>
                      </div>
                    )}

                    {/* DOKUMEN VIEWER BISA DI-SCROLL LANCAR KONTINU ALA CLAUDE */}
                    <div className="flex-1 w-full h-full bg-[#12161A] overflow-hidden relative">
                      <iframe
                        key={`${activeDoc.id}-p${targetPage}`}
                        src={`${API_BASE}/api/v1/documents/${activeDoc.id}/pdf?token=${currentUser.token}#page=${targetPage}&view=FitH`}
                        className="w-full h-full border-0 bg-white"
                        title={activeDoc.title}
                      />
                    </div>
                  </div>
                ) : (
                  <div className={`flex-1 flex flex-col items-center justify-center p-8 text-center ${
                    theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"
                  }`}>
                    <BookOpen className="w-16 h-16 text-[#9AA9B5] mb-4 stroke-1 opacity-50" />
                    <h3 className={`font-bold text-base font-claude-serif ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
                      Belum Ada Dokumen Terpilih
                    </h3>
                    <p className={`text-xs max-w-sm mt-1 ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
                      Klik sitasi pada jawaban asisten atau pilih dokumen di atas untuk langsung melihat lembaran aslinya di sini.
                    </p>
                    <button
                      onClick={() => setIsPdfPanelOpen(false)}
                      className={`mt-4 text-xs underline cursor-pointer ${
                        theme === "dark" ? "text-[#9AA9B5] hover:text-[#E6EDF2]" : "text-[#5B6B78] hover:text-[#12202B]"
                      }`}
                    >
                      Tutup panel ini
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL KONFIRMASI BAWAAN PLATFORM */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className={`rounded-2xl max-w-sm w-full p-5 shadow-2xl border transform scale-100 transition-all font-claude-sans ${
            theme === "dark"
              ? "bg-[#1B2127] border-[#2A333B] text-[#E6EDF2]"
              : "bg-white border-[#DCE3E8] text-[#12202B]"
          }`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                confirmModal.isDestructive
                  ? theme === "dark" ? "bg-rose-950/80 text-rose-400 border border-rose-800/60" : "bg-rose-100 text-rose-600"
                  : theme === "dark" ? "bg-[#34D3BE]/15 text-[#34D3BE] border border-[#34D3BE]/30" : "bg-teal-50 text-[#0F766E]"
              }`}>
                {confirmModal.isDestructive ? <Trash2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              </div>
              <h3 className={`text-base font-bold font-claude-serif ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>{confirmModal.title}</h3>
            </div>
            <p className={`text-sm leading-relaxed mb-6 ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
              {confirmModal.message}
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
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
                    : theme === "dark" ? "bg-[#34D3BE] text-[#12161A] hover:bg-[#34D3BE]/90" : "bg-[#0F766E] text-white hover:bg-[#0F766E]/90"
                }`}
              >
                {confirmModal.confirmText || "Konfirmasi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOTIFIKASI / ALERT BAWAAN PLATFORM */}
      {alertModal && alertModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className={`rounded-2xl max-w-sm w-full p-5 shadow-2xl border transform scale-100 transition-all font-claude-sans ${
            theme === "dark"
              ? "bg-[#1B2127] border-[#2A333B] text-[#E6EDF2]"
              : "bg-white border-[#DCE3E8] text-[#12202B]"
          }`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                alertModal.type === 'error'
                  ? theme === "dark" ? "bg-rose-950/80 text-rose-400 border border-rose-800/60" : "bg-rose-100 text-rose-600"
                  : alertModal.type === 'warning'
                  ? theme === "dark" ? "bg-amber-950/80 text-amber-400 border border-amber-800/60" : "bg-amber-100 text-amber-600"
                  : theme === "dark" ? "bg-[#34D3BE]/15 text-[#34D3BE] border border-[#34D3BE]/30" : "bg-teal-50 text-[#0F766E]"
              }`}>
                {alertModal.type === 'error' ? (
                  <AlertCircle className="w-5 h-5" />
                ) : alertModal.type === 'warning' ? (
                  <AlertCircle className="w-5 h-5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
              </div>
              <h3 className={`text-base font-bold font-claude-serif ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>{alertModal.title}</h3>
            </div>
            <p className={`text-sm leading-relaxed mb-6 ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#5B6B78]"}`}>
              {alertModal.message}
            </p>
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setAlertModal(null)}
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
      )}
      {/* MODAL PENGATURAN AKUN & PROFIL (STANDAR PLATFORM) */}
      {isProfileModalOpen && currentUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className={`rounded-2xl max-w-md w-full shadow-2xl border overflow-hidden transform scale-100 transition-all font-claude-sans ${
            theme === "dark"
              ? "bg-[#1B2127] border-[#2A333B] text-[#E6EDF2]"
              : "bg-white border-[#DCE3E8] text-[#12202B]"
          }`}>
            {/* HEADER MODAL */}
            <div className={`p-5 border-b flex items-center justify-between ${
              theme === "dark" ? "border-[#2A333B] bg-[#12161A]/50" : "border-[#DCE3E8] bg-[#F7F9FA]"
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  theme === "dark" ? "bg-[#34D3BE]/15 text-[#34D3BE]" : "bg-teal-50 text-[#0F766E]"
                }`}>
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
                onClick={() => setIsProfileModalOpen(false)}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  theme === "dark" ? "text-[#9AA9B5] hover:text-[#E6EDF2] hover:bg-[#2A333B]" : "text-[#5B6B78] hover:text-[#12202B] hover:bg-[#E6EDF2]"
                }`}
                title="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* BODY MODAL */}
            <div className="p-5 space-y-5 text-xs max-h-[80vh] overflow-y-auto">
              {/* KARTU IDENTITAS PENGGUNA */}
              <div className={`p-4 rounded-xl border flex items-center gap-3.5 ${
                theme === "dark" ? "bg-[#12161A] border-[#2A333B]" : "bg-[#F8FAFC] border-[#E2E8F0]"
              }`}>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0F766E] to-[#34D3BE] text-white font-black text-lg flex items-center justify-center shrink-0 shadow-md">
                  {currentUser.full_name ? currentUser.full_name.charAt(0).toUpperCase() : "U"}
                </div>
                <div className="flex-1 overflow-hidden">
                  <h4 className="font-bold text-sm truncate">{currentUser.full_name}</h4>
                  <p className={`text-xs truncate ${theme === "dark" ? "text-[#9AA9B5]" : "text-[#64748B]"}`}>
                    {currentUser.email}
                  </p>
                  <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    theme === "dark"
                      ? "bg-[#34D3BE]/15 text-[#34D3BE] border-[#34D3BE]/30"
                      : "bg-teal-50 text-[#0F766E] border-teal-200"
                  }`}>
                    Akun Mahasiswa Farmasi Aktif
                  </span>
                </div>
              </div>

              {/* SECTION: PREFERENSI TAMPILAN */}
              <div className="space-y-2">
                <label className={`text-[11px] font-bold uppercase tracking-wider block ${
                  theme === "dark" ? "text-[#9AA9B5]" : "text-[#64748B]"
                }`}>
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
                <label className={`text-[11px] font-bold uppercase tracking-wider block ${
                  theme === "dark" ? "text-[#9AA9B5]" : "text-[#64748B]"
                }`}>
                  Ringkasan Data Akademik
                </label>
                <div className={`p-3 rounded-xl border divide-y ${
                  theme === "dark" ? "bg-[#12161A] border-[#2A333B] divide-[#2A333B]" : "bg-[#F8FAFC] border-[#E2E8F0] divide-[#E2E8F0]"
                }`}>
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
                    setIsProfileModalOpen(false);
                    handleLogout();
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
            <div className={`p-4 border-t flex items-center justify-between text-[11px] ${
              theme === "dark" ? "border-[#2A333B] bg-[#12161A]/50 text-[#9AA9B5]" : "border-[#DCE3E8] bg-[#F8FAFC] text-[#64748B]"
            }`}>
              <span>EPIONA Platform v1.1.0</span>
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className={`px-4 py-1.5 rounded-lg border font-semibold transition cursor-pointer ${
                  theme === "dark" ? "border-[#2A333B] bg-[#1B2127] text-[#E6EDF2] hover:bg-[#2A333B]" : "border-[#CBD5E1] bg-white text-[#12202B] hover:bg-[#F1F5F9]"
                }`}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LIGHTBOX / PRATINJAU GAMBAR PENUH */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className={`relative max-w-4xl max-h-[90vh] flex flex-col items-center p-3 rounded-2xl border shadow-2xl ${
              theme === "dark" ? "bg-[#1B2127] border-[#2A333B]" : "bg-white border-[#DCE3E8]"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`w-full flex items-center justify-between pb-2 mb-2 border-b ${
              theme === "dark" ? "border-[#2A333B]" : "border-[#DCE3E8]"
            }`}>
              <span className={`text-xs font-bold truncate max-w-md ${
                theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"
              }`}>
                {lightboxImage.title}
              </span>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className={`p-1 rounded-lg transition cursor-pointer ${
                  theme === "dark" ? "text-[#9AA9B5] hover:text-white hover:bg-[#2A333B]" : "text-[#5B6B78] hover:text-[#12202B] hover:bg-[#F7F9FA]"
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={lightboxImage.src}
              alt={lightboxImage.title}
              className="max-h-[75vh] max-w-full rounded-xl object-contain shadow-inner"
            />
          </div>
        </div>
      )}
    </div>
  );
}
