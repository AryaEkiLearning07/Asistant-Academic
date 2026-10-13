"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  UserProfile,
  DocumentItem,
  CitationItem,
  FigureSnippet,
  Message,
  ChatSessionItem,
  AttachedFileItem,
  LightboxImageItem,
  ModalConfirmState,
  ModalAlertState,
  ModelPreference,
} from "../types";

// Modular UI Components
import { AuthScreen } from "../components/auth/AuthScreen";
import { LeftSidebar } from "../components/sidebar/LeftSidebar";
import { DashboardView } from "../components/dashboard/DashboardView";
import { LibraryView } from "../components/library/LibraryView";
import { AdminConsoleView } from "../components/admin/AdminConsoleView";
import { WorkspaceView } from "../components/workspace/WorkspaceView";
import { DocumentPreviewModal } from "../components/modals/DocumentPreviewModal";
import { UserChatInspectorModal } from "../components/modals/UserChatInspectorModal";
import { ProfileSettingsModal } from "../components/modals/ProfileSettingsModal";
import { SubscriptionModal } from "../components/modals/SubscriptionModal";
import { ConfirmDialogModal, AlertDialogModal } from "../components/modals/ConfirmDialogModal";
import { X } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8005";

/**
 * EPIONA Research Assistant - Root Orchestrator
 * Mengorkestrasi state global, hooks API backend, dan rendering view modular.
 */
export default function AppRoot() {
  // Navigation & User State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [currentNav, setCurrentNav] = useState<"dashboard" | "workspace" | "library" | "admin">("dashboard");
  const [theme, setTheme] = useState<"dark" | "light">("light");

  // Auth Form State
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [fullNameInput, setFullNameInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Documents & Library State
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [activeDoc, setActiveDoc] = useState<DocumentItem | null>(null);
  const [targetPage, setTargetPage] = useState<number>(1);
  const [highlightQuote, setHighlightQuote] = useState<string | null>(null);
  const [activeAcademicCitation, setActiveAcademicCitation] = useState<CitationItem | null>(null);
  const [isPdfPanelOpen, setIsPdfPanelOpen] = useState<boolean>(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [activeMenuDocId, setActiveMenuDocId] = useState<string | null>(null);
  const [librarySearch, setLibrarySearch] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  // Workspace & Chat State
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState<boolean>(true);
  const [chatSessions, setChatSessions] = useState<ChatSessionItem[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputQuestion, setInputQuestion] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendingStatusText, setSendingStatusText] = useState<string>("EPIONA sedang membaca literatur...");
  const [isTypingStream, setIsTypingStream] = useState<boolean>(false);
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [groundingMode, setGroundingMode] = useState<"library" | "academic">("library");
  const [modelPreference, setModelPreference] = useState<ModelPreference>("gemini-2.0-flash");
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState("");
  const [isSearchingSessions, setIsSearchingSessions] = useState(false);
  const [activeSessionMenuId, setActiveSessionMenuId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionTitle, setEditingSessionTitle] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState<string>("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFileItem[]>([]);
  const [lightboxImage, setLightboxImage] = useState<LightboxImageItem | null>(null);

  // Voice Input State
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const shouldStopRecordingRef = useRef<boolean>(false);
  const speechBaseTextRef = useRef<string>("");

  // Sources Accordion State
  const [isSourcesOpen, setIsSourcesOpen] = useState<boolean>(false);
  const [sourcesAccordionOpen, setSourcesAccordionOpen] = useState<"web" | "files" | null>("web");

  // Admin Console State
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

  // User Chat Inspector State
  const [inspectingUser, setInspectingUser] = useState<any | null>(null);
  const [inspectingSessions, setInspectingSessions] = useState<any[]>([]);
  const [inspectingActiveSessionId, setInspectingActiveSessionId] = useState<string | null>(null);
  const [inspectingMessages, setInspectingMessages] = useState<any[]>([]);
  const [isInspectingLoading, setIsInspectingLoading] = useState<boolean>(false);

  // Modals & UI Controls State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ModalConfirmState | null>(null);
  const [alertModal, setAlertModal] = useState<ModalAlertState | null>(null);

  // DOM Refs
  const sourcesRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);
  const chatAttachmentInputRef = useRef<HTMLInputElement>(null);

  function showAlert(title: string, message: string, type: "info" | "warning" | "error" = "info") {
    setAlertModal({ isOpen: true, title, message, type });
  }

  function getNow24Hour(): string {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}.${String(now.getMinutes()).padStart(2, "0")}`;
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
      return `${String(hours).padStart(2, "0")}.${minutes}`;
    }
    const parsed = new Date(timeStr);
    if (!isNaN(parsed.getTime())) {
      return `${String(parsed.getHours()).padStart(2, "0")}.${String(parsed.getMinutes()).padStart(2, "0")}`;
    }
    return timeStr;
  }

  function adjustTextareaHeight() {
    const el = chatTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = 340;
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

  // Sources Accordion Memo
  const { sessionCitations, webCitationsGrouped, fileCitationsGrouped, totalWebCount, totalFileCount } = useMemo(() => {
    const list: CitationItem[] = [];
    const seen = new Set<string>();
    const webMap = new Map<string, CitationItem[]>();
    const fileMap = new Map<string, { docTitle: string; page: number; items: { quote: string; question: string; rawCit: CitationItem }[] }>();

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (m.sender === "assistant" && m.citations && m.citations.length > 0) {
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
              if (!webMap.has(userQuestion)) webMap.set(userQuestion, []);
              webMap.get(userQuestion)!.push(c);
            } else {
              const docKey = `${c.document_id}-p${c.page_number}`;
              if (!fileMap.has(docKey)) {
                fileMap.set(docKey, { docTitle: c.document_title, page: c.page_number, items: [] });
              }
              fileMap.get(docKey)!.items.push({ quote: c.exact_quote, question: userQuestion, rawCit: c });
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
      totalFileCount: fileCount,
    };
  }, [messages]);

  const uniqueDocsCount = useMemo(() => new Set(sessionCitations.map((c) => c.document_id)).size, [sessionCitations]);

  // Session User & Theme Initialization
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
      if (savedTheme === "dark") document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
    }
    const savedModel = localStorage.getItem("epiona_model_preference") as ModelPreference | null;
    if (savedModel === "gemini-2.0-flash" || savedModel === "claude-3-5-sonnet") {
      setModelPreference(savedModel);
    }
  }, []);

  function handleSelectModelPreference(m: ModelPreference) {
    setModelPreference(m);
    try {
      localStorage.setItem("epiona_model_preference", m);
    } catch (e) {}
  }

  function toggleTheme() {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("epiona_theme", next);
      if (next === "dark") document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
      return next;
    });
  }

  // Click Outside & Escape Handler
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

  // Fetch Documents & Chat Sessions
  const fetchUserDocuments = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/documents`, {
        headers: { "X-User-Id": currentUser.token },
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents);
        // Tidak auto-select dokumen pertama agar default selalu Percakapan Terbuka
      }
    } catch (err) {
      console.error("Gagal mengambil dokumen:", err);
    }
  }, [currentUser, activeDoc]);

  const fetchChatSessions = useCallback(async () => {
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
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      fetchUserDocuments();
      fetchChatSessions();
    }
  }, [currentUser, fetchUserDocuments, fetchChatSessions]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auth Handler
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
      if (!res.ok) throw new Error(data.detail || "Terjadi kesalahan pada autentikasi.");

      const profile: UserProfile = {
        id: data.user_id,
        email: data.email,
        full_name: data.full_name,
        token: data.token,
        role: data.role || (data.email === "admin@epiona.my.id" ? "admin" : "user"),
      };

      setCurrentUser(profile);
      localStorage.setItem("epiona_session_user", JSON.stringify(profile));
      if (profile.role === "admin") setCurrentNav("admin");
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

  // Chat Session Actions
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
              ? new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : (m.timestamp || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })),
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
        headers: { "Content-Type": "application/json", "X-User-Id": currentUser.token },
        body: JSON.stringify({ title: "Percakapan Baru" }),
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
            headers: { "X-User-Id": currentUser.token },
          });
          if (res.ok) {
            setChatSessions((prev) => prev.filter((s) => s.id !== sessionId));
            if (currentSessionId === sessionId) {
              setCurrentSessionId(null);
              setMessages([]);
            }
          }
        } catch (err) {
          showAlert("Gagal Menghapus", "Terjadi kesalahan saat menghapus percakapan.", "error");
        }
      },
    });
  }

  async function handleRenameSession(sessionId: string, newTitle: string) {
    if (!currentUser || !newTitle.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/chats/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-User-Id": currentUser.token },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (res.ok) {
        setChatSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, title: newTitle.trim() } : s)));
        setEditingSessionId(null);
      }
    } catch (err) {
      console.error("Gagal mengubah judul percakapan:", err);
    }
  }

  // Upload & Delete Document Handlers
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
          if (!res.ok) throw new Error("Gagal mengunggah");
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
        setUploadNotice(`✓ Berhasil menambahkan ${successCount} dokumen ke MyLibrary.`);
        showAlert("Upload Berhasil", `${successCount} dokumen telah ditambahkan ke MyLibrary.${failedCount > 0 ? ` (${failedCount} gagal)` : ""}`, "info");
        await fetchUserDocuments();
        if (lastReceiptId) {
          const updated = await fetch(`${API_BASE}/api/v1/documents`, { headers: { "X-User-Id": currentUser.token } })
            .then((r) => r.json()).catch(() => ({ documents: [] }));
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
          if (!res.ok) throw new Error("Gagal menghapus");
          const data = await res.json();
          setDocuments((prev) => prev.filter((d) => d.id !== docId));
          if (activeDoc?.id === docId) setActiveDoc(null);
          setUploadNotice(data.message || `"${docTitle}" berhasil dihapus.`);
        } catch (err: any) {
          showAlert("Gagal Menghapus", err.message || "Gagal menghapus dokumen.", "error");
        }
      },
    });
  }

  // Progressive Status & Streaming Reply
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
      if (stepIdx < steps.length) setSendingStatusText(steps[stepIdx]);
    }, 1100);
    return () => clearInterval(timer);
  }

  function streamAssistantReply(
    fullText: string,
    citations: CitationItem[] = [],
    figures: FigureSnippet[] = [],
    onComplete?: () => void,
    targetMessageId?: string
  ) {
    const msgId = targetMessageId || (Date.now() + 1).toString();
    const initialMsg: Message = {
      id: msgId,
      sender: "assistant",
      text: "",
      citations,
      figures,
      timestamp: getNow24Hour(),
    };

    if (targetMessageId) {
      setMessages((prev) => prev.map((m) => (m.id === targetMessageId ? initialMsg : m)));
    } else {
      setMessages((prev) => [...prev, initialMsg]);
    }
    setIsSending(false);
    setIsTypingStream(true);
    setStreamingMsgId(msgId);

    const tokens = fullText.match(/\S+\s*|\s+/g) || [fullText];
    let currentIndex = 0;
    let accumulatedText = "";
    const totalTokens = tokens.length;
    const tokensPerTick = totalTokens > 400 ? 3 : totalTokens > 180 ? 2 : 1;

    const intervalId = setInterval(() => {
      if (currentIndex >= tokens.length) {
        clearInterval(intervalId);
        setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, text: fullText } : m)));
        setIsTypingStream(false);
        setStreamingMsgId(null);
        if (onComplete) onComplete();
        return;
      }
      for (let k = 0; k < tokensPerTick && currentIndex < tokens.length; k++) {
        accumulatedText += tokens[currentIndex];
        currentIndex++;
      }
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, text: accumulatedText } : m)));
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 18);
  }

  // Send Message Handler
  async function handleSendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!currentUser) return;
    const q = inputQuestion.trim();
    if (!q && attachedFiles.length === 0) return;
    const currentAttachments = [...attachedFiles];
    setInputQuestion("");
    setAttachedFiles([]);
    setIsSending(true);

    const stopStatus = startProgressiveStatus(groundingMode === "academic", currentAttachments.length > 0);
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
          headers: { "Content-Type": "application/json", "X-User-Id": currentUser.token },
          body: JSON.stringify({ title: "Percakapan Baru" }),
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
        headers: { "Content-Type": "application/json", "X-User-Id": currentUser.token },
        body: JSON.stringify({
          question: q || fallbackPrompt,
          grounding_mode: groundingMode,
          model_preference: modelPreference,
          focused_document_id: activeDoc ? activeDoc.id : null,
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
        const errData = await res.json().catch(() => ({}));
        let errMsg = "Gagal mendapatkan respon asisten";
        if (typeof errData.detail === "string") {
          errMsg = errData.detail;
        } else if (typeof errData.message === "string") {
          errMsg = errData.message;
        }
        if (res.status === 403) {
          setIsSubscriptionModalOpen(true);
          if (!errData.detail) {
            errMsg = "Akses Claude 3.5 Sonnet memerlukan paket Pro atau kuota chat Anda habis.";
          }
        }
        throw new Error(errMsg);
      }
      const data = await res.json();
      stopStatus();

      // Sinkronkan kuota Claude secara real-time
      if (typeof data.claude_quota_left === "number") {
        setCurrentUser((prev) => prev ? ({ ...prev, claude_quota_left: data.claude_quota_left }) : null);
      }

      if (data.session_title && activeSession) {
        setChatSessions((prev) => prev.map((s) => (s.id === activeSession ? { ...s, title: data.session_title } : s)));
      }
      streamAssistantReply(data.answer, data.citations || [], data.figures || [], () => {
        fetchChatSessions();
      });
    } catch (err: any) {
      stopStatus();
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "assistant",
          text: err.message || "Maaf, terjadi kendala saat menghubungkan ke asisten.",
          timestamp: getNow24Hour(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  // Copy Message Handler
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

  // Retry Message Handler (Regenerate: me-replace respon lama, bukan menambah pesan baru)
  async function handleRetryUserMessage(userMsg: Message) {
    if (!currentUser || isSending) return;
    setIsSending(true);
    const stopStatus = startProgressiveStatus(
      groundingMode === "academic",
      Boolean(userMsg.attachments && userMsg.attachments.length > 0)
    );

    // Cari pesan asisten yang menanggapi pesan user ini
    const userIdx = messages.findIndex((m) => m.id === userMsg.id);
    let targetAssistantId: string | null = null;
    if (userIdx !== -1) {
      const followingAssistants: string[] = [];
      for (let i = userIdx + 1; i < messages.length; i++) {
        if (messages[i].sender === "assistant") {
          followingAssistants.push(messages[i].id);
        } else {
          break;
        }
      }
      if (followingAssistants.length > 0) {
        targetAssistantId = followingAssistants[0];
        // Jika ada pesan asisten lebih dari satu berturut-turut (misal error menumpuk), bersihkan sisanya
        if (followingAssistants.length > 1) {
          const idsToRemove = new Set(followingAssistants.slice(1));
          setMessages((prev) => prev.filter((m) => !idsToRemove.has(m.id)));
        }
      }
    }

    try {
      const res = await fetch(`${API_BASE}/api/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": currentUser.token },
        body: JSON.stringify({
          question: userMsg.text,
          grounding_mode: groundingMode,
          model_preference: modelPreference,
          focused_document_id: activeDoc ? activeDoc.id : null,
          session_id: currentSessionId,
          attachments: (userMsg.attachments || []).map((f) => ({
            filename: f.name,
            file_type: f.type,
            file_size: f.size,
            data_base64: f.dataUrl && f.dataUrl.includes(";base64,") ? f.dataUrl.split(";base64,")[1] : null,
          })),
        }),
      });
      if (!res.ok) {
        if (res.status === 403) {
          const errData = await res.json().catch(() => ({}));
          const errMsg = typeof errData.detail === "string" ? errData.detail : "Akses Claude 3.5 Sonnet memerlukan paket Pro atau kuota chat Anda habis.";
          setIsSubscriptionModalOpen(true);
          throw new Error(errMsg);
        }
        throw new Error("Gagal mengulangi respon");
      }
      const data = await res.json();
      stopStatus();

      // Sinkronkan kuota Claude secara real-time
      if (typeof data.claude_quota_left === "number") {
        setCurrentUser((prev) => prev ? ({ ...prev, claude_quota_left: data.claude_quota_left }) : null);
      }

      streamAssistantReply(
        data.answer,
        data.citations || [],
        data.figures || [],
        undefined,
        targetAssistantId || undefined
      );
    } catch (err: any) {
      stopStatus();
      if (targetAssistantId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === targetAssistantId
              ? {
                  ...m,
                  text: err.message || "Maaf, terjadi kendala saat menghubungkan ke asisten.",
                  timestamp: getNow24Hour(),
                }
              : m
          )
        );
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: "assistant",
            text: "Maaf, terjadi kendala saat menghubungkan ke asisten.",
            timestamp: getNow24Hour(),
          },
        ]);
      }
    } finally {
      setIsSending(false);
    }
  }

  // Edit Message Handler (Me-replace respon lama dari hasil suntingan)
  async function handleSaveEditedMessage(msgId: string) {
    const trimmed = editingMessageText.trim();
    if (!trimmed || !currentUser || isSending) return;
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, text: trimmed } : m)));
    setEditingMessageId(null);
    setIsSending(true);

    // Cari pesan asisten yang berada setelah pesan user yang diedit
    const userIdx = messages.findIndex((m) => m.id === msgId);
    let targetAssistantId: string | null = null;
    if (userIdx !== -1) {
      const followingAssistants: string[] = [];
      for (let i = userIdx + 1; i < messages.length; i++) {
        if (messages[i].sender === "assistant") {
          followingAssistants.push(messages[i].id);
        } else {
          break;
        }
      }
      if (followingAssistants.length > 0) {
        targetAssistantId = followingAssistants[0];
        if (followingAssistants.length > 1) {
          const idsToRemove = new Set(followingAssistants.slice(1));
          setMessages((prev) => prev.filter((m) => !idsToRemove.has(m.id)));
        }
      }
    }

    const stopStatus = startProgressiveStatus(groundingMode === "academic", false);
    try {
      const res = await fetch(`${API_BASE}/api/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": currentUser.token },
        body: JSON.stringify({
          question: trimmed,
          grounding_mode: groundingMode,
          model_preference: modelPreference,
          focused_document_id: activeDoc ? activeDoc.id : null,
          session_id: currentSessionId,
          attachments: [],
        }),
      });
      if (!res.ok) {
        if (res.status === 403) {
          const errData = await res.json().catch(() => ({}));
          const errMsg = typeof errData.detail === "string" ? errData.detail : "Akses Claude 3.5 Sonnet memerlukan paket Pro atau kuota chat Anda habis.";
          setIsSubscriptionModalOpen(true);
          throw new Error(errMsg);
        }
        throw new Error("Gagal mengirim hasil edit");
      }
      const data = await res.json();
      stopStatus();

      // Sinkronkan kuota Claude secara real-time
      if (typeof data.claude_quota_left === "number") {
        setCurrentUser((prev) => prev ? ({ ...prev, claude_quota_left: data.claude_quota_left }) : null);
      }

      streamAssistantReply(
        data.answer,
        data.citations || [],
        data.figures || [],
        undefined,
        targetAssistantId || undefined
      );
    } catch (err: any) {
      stopStatus();
      if (targetAssistantId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === targetAssistantId
              ? {
                  ...m,
                  text: err.message || "Maaf, terjadi kendala saat menghubungkan ke asisten.",
                  timestamp: getNow24Hour(),
                }
              : m
          )
        );
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: "assistant",
            text: "Maaf, terjadi kendala saat menghubungkan ke asisten.",
            timestamp: getNow24Hour(),
          },
        ]);
      }
    } finally {
      setIsSending(false);
    }
  }

  // Voice Input Toggle
  function toggleVoiceInput() {
    if (isRecording) {
      shouldStopRecordingRef.current = true;
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showAlert(
        "Fitur Suara Tidak Didukung",
        "Browser Anda belum mendukung Web Speech Recognition. Gunakan Chrome atau Edge.",
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

      recognition.onstart = () => setIsRecording(true);
      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        const full = speechBaseTextRef.current ? `${speechBaseTextRef.current} ${transcript}` : transcript;
        setInputQuestion(full);
      };
      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => {
        if (!shouldStopRecordingRef.current) {
          try { recognition.start(); return; } catch (err) {}
        }
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setIsRecording(false);
    }
  }

  // Citation Click Handler
  function handleCitationClick(citation: CitationItem) {
    if (citation.source_type === "academic_web" || citation.doi || citation.journal_name) {
      setActiveAcademicCitation(citation);
      setHighlightQuote(citation.exact_quote);
      setIsPdfPanelOpen(true);
    } else {
      setActiveAcademicCitation(null);
      const doc = documents.find((d) => d.id === citation.document_id);
      if (doc) setActiveDoc(doc);
      setTargetPage(citation.page_number || 1);
      setHighlightQuote(citation.exact_quote);
      setIsPdfPanelOpen(true);
    }
    if (currentNav !== "workspace") setCurrentNav("workspace");
  }

  // Admin Console Fetchers
  const fetchAdminStatsAndActivities = useCallback(async () => {
    if (!currentUser || currentUser.role !== "admin") return;
    try {
      const headers = { Authorization: `Bearer ${currentUser.token}`, "X-User-Id": currentUser.token };
      const [resStats, resAct] = await Promise.all([
        fetch(`${API_BASE}/api/v1/admin/stats`, { headers }),
        fetch(`${API_BASE}/api/v1/admin/activities?limit=60`, { headers }),
      ]);
      if (resStats.ok) setAdminStats(await resStats.json());
      if (resAct.ok) setAdminActivities((await resAct.json()).activities || []);
    } catch (e) {
      console.error("Gagal mengambil data monitoring admin:", e);
    }
  }, [currentUser]);

  const fetchAdminTabContent = useCallback(
    async (tab: "activity" | "users" | "documents" | "server") => {
      if (!currentUser || currentUser.role !== "admin") return;
      setIsAdminLoading(true);
      const headers = { Authorization: `Bearer ${currentUser.token}`, "X-User-Id": currentUser.token };
      try {
        if (tab === "activity") {
          await fetchAdminStatsAndActivities();
        } else if (tab === "users") {
          const res = await fetch(`${API_BASE}/api/v1/admin/users`, { headers });
          if (res.ok) setAdminUsers((await res.json()).users || []);
        } else if (tab === "documents") {
          const res = await fetch(`${API_BASE}/api/v1/admin/documents`, { headers });
          if (res.ok) setAdminDocuments((await res.json()).documents || []);
        } else if (tab === "server") {
          const [resStatus, resLogs] = await Promise.all([
            fetch(`${API_BASE}/api/v1/admin/system/status`, { headers }),
            fetch(`${API_BASE}/api/v1/admin/system/logs?limit=80`, { headers }),
          ]);
          if (resStatus.ok) setAdminSystemStatus(await resStatus.json());
          if (resLogs.ok) setAdminLogs((await resLogs.json()).logs || []);
        }
      } catch (err) {
        console.error("Gagal memuat tab admin:", err);
      } finally {
        setIsAdminLoading(false);
      }
    },
    [currentUser, fetchAdminStatsAndActivities]
  );

  useEffect(() => {
    if (currentNav === "admin" && currentUser?.role === "admin") {
      fetchAdminStatsAndActivities();
      fetchAdminTabContent(adminActiveTab);
    }
  }, [currentNav, adminActiveTab, currentUser, fetchAdminTabContent, fetchAdminStatsAndActivities]);

  useEffect(() => {
    if (currentNav !== "admin" || !adminAutoRefresh || currentUser?.role !== "admin") return;
    const interval = setInterval(() => fetchAdminStatsAndActivities(), 7000);
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
          Authorization: `Bearer ${currentUser.token}`,
          "X-User-Id": currentUser.token,
        },
        body: JSON.stringify({ is_active: newStatus }),
      });
      if (res.ok) {
        setAdminUsers((prev) => prev.map((u) => (u.id === targetUserId ? { ...u, is_active: newStatus } : u)));
        fetchAdminStatsAndActivities();
      } else {
        const errData = await res.json();
        showAlert("Aksi Gagal", errData.detail || "Tidak dapat mengubah status pengguna.", "error");
      }
    } catch (err) {
      showAlert("Error", "Gagal menghubungi server.", "error");
    }
  }

  async function handleSelectInspectingSession(sessionId: string) {
    if (!currentUser) return;
    setInspectingActiveSessionId(sessionId);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/chats/${sessionId}/messages`, {
        headers: { Authorization: `Bearer ${currentUser.token}`, "X-User-Id": currentUser.token },
      });
      if (res.ok) setInspectingMessages((await res.json()).messages || []);
    } catch (err) {
      console.error("Gagal mengambil pesan sesi:", err);
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
        headers: { Authorization: `Bearer ${currentUser.token}`, "X-User-Id": currentUser.token },
      });
      if (res.ok) {
        const sessList = (await res.json()).sessions || [];
        setInspectingSessions(sessList);
        if (sessList.length > 0) handleSelectInspectingSession(sessList[0].id);
      }
    } catch (err) {
      console.error("Gagal memeriksa sesi pengguna:", err);
    } finally {
      setIsInspectingLoading(false);
    }
  }

  // --- RENDERING VIEWS ---
  if (!currentUser) {
    return (
      <AuthScreen
        theme={theme}
        authMode={authMode}
        setAuthMode={setAuthMode}
        authError={authError}
        setAuthError={setAuthError}
        isAuthLoading={isAuthLoading}
        emailInput={emailInput}
        setEmailInput={setEmailInput}
        passwordInput={passwordInput}
        setPasswordInput={setPasswordInput}
        fullNameInput={fullNameInput}
        setFullNameInput={setFullNameInput}
        handleAuthSubmit={handleAuthSubmit}
      />
    );
  }

  return (
    <div
      className={`flex h-screen font-claude-sans overflow-hidden transition-colors duration-200 ${
        theme === "dark" ? "bg-[#12161A] text-[#E6EDF2]" : "bg-[#F7F9FA] text-[#12202B]"
      }`}
    >
      {/* 1. SIDEBAR KIRI (HANYA WORKSPACE) */}
      {currentNav === "workspace" && (
        <LeftSidebar
          theme={theme}
          isLeftSidebarOpen={isLeftSidebarOpen}
          setIsLeftSidebarOpen={setIsLeftSidebarOpen}
          currentUser={currentUser}
          currentNav={currentNav}
          documents={documents}
          chatSessions={chatSessions}
          currentSessionId={currentSessionId}
          handleSelectSession={handleSelectSession}
          handleNewChat={handleNewChat}
          handleDeleteSession={handleDeleteSession}
          handleRenameSession={handleRenameSession}
          setCurrentNav={setCurrentNav}
          handleLogout={handleLogout}
          sidebarSearchQuery={sidebarSearchQuery}
          setSidebarSearchQuery={setSidebarSearchQuery}
          isSearchingSessions={isSearchingSessions}
          setIsSearchingSessions={setIsSearchingSessions}
          activeSessionMenuId={activeSessionMenuId}
          setActiveSessionMenuId={setActiveSessionMenuId}
          editingSessionId={editingSessionId}
          setEditingSessionId={setEditingSessionId}
          editingSessionTitle={editingSessionTitle}
          setEditingSessionTitle={setEditingSessionTitle}
        />
      )}

      {/* 2. AREA KONTEN UTAMA */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".pdf"
          multiple
          className="hidden"
        />

        {currentNav === "dashboard" && (
          <DashboardView
            theme={theme}
            currentUser={currentUser}
            currentNav={currentNav}
            setCurrentNav={setCurrentNav}
            documents={documents}
            chatSessions={chatSessions}
            toggleTheme={toggleTheme}
            setIsProfileModalOpen={setIsProfileModalOpen}
            setIsPdfPanelOpen={setIsPdfPanelOpen}
            openDocumentPreview={(doc) => setPreviewDoc(doc)}
            setActiveDoc={setActiveDoc}
            setTargetPage={setTargetPage}
            setHighlightQuote={setHighlightQuote}
            handleNewChat={handleNewChat}
            handleSelectSession={handleSelectSession}
            fileInputRef={fileInputRef}
          />
        )}

        {currentNav === "library" && (
          <LibraryView
            theme={theme}
            currentUser={currentUser}
            setCurrentNav={setCurrentNav}
            documents={documents}
            librarySearch={librarySearch}
            setLibrarySearch={setLibrarySearch}
            activeMenuDocId={activeMenuDocId}
            setActiveMenuDocId={setActiveMenuDocId}
            isUploading={isUploading}
            uploadNotice={uploadNotice}
            toggleTheme={toggleTheme}
            setIsPdfPanelOpen={setIsPdfPanelOpen}
            openDocumentPreview={(doc) => setPreviewDoc(doc)}
            handleDeleteDocument={handleDeleteDocument}
            fileInputRef={fileInputRef}
            apiBase={API_BASE}
          />
        )}

        {currentNav === "admin" && currentUser?.role === "admin" && (
          <AdminConsoleView
            theme={theme}
            currentUser={currentUser}
            setCurrentNav={setCurrentNav}
            handleLogout={handleLogout}
            adminActiveTab={adminActiveTab}
            setAdminActiveTab={setAdminActiveTab}
            adminStats={adminStats}
            adminActivities={adminActivities}
            adminUsers={adminUsers}
            adminDocuments={adminDocuments}
            adminSystemStatus={adminSystemStatus}
            adminLogs={adminLogs}
            isAdminLoading={isAdminLoading}
            adminAutoRefresh={adminAutoRefresh}
            setAdminAutoRefresh={setAdminAutoRefresh}
            adminSearchFilter={adminSearchFilter}
            setAdminSearchFilter={setAdminSearchFilter}
            toggleTheme={toggleTheme}
            fetchAdminStatsAndActivities={fetchAdminStatsAndActivities}
            fetchAdminTabContent={fetchAdminTabContent}
            handleInspectUser={handleInspectUser}
            handleToggleUserStatus={handleToggleUserStatus}
            apiBase={API_BASE}
          />
        )}

        {currentNav === "workspace" && (
          <WorkspaceView
            theme={theme}
            apiBase={API_BASE}
            currentUser={currentUser}
            setCurrentNav={setCurrentNav}
            isLeftSidebarOpen={isLeftSidebarOpen}
            setIsLeftSidebarOpen={setIsLeftSidebarOpen}
            isPdfPanelOpen={isPdfPanelOpen}
            setIsPdfPanelOpen={setIsPdfPanelOpen}
            groundingMode={groundingMode}
            setGroundingMode={setGroundingMode}
            modelPreference={modelPreference}
            setModelPreference={handleSelectModelPreference}
            onOpenSubscriptionModal={() => setIsSubscriptionModalOpen(true)}
            toggleTheme={toggleTheme}
            isSourcesOpen={isSourcesOpen}
            setIsSourcesOpen={setIsSourcesOpen}
            sourcesRef={sourcesRef}
            sessionCitations={sessionCitations}
            sourcesAccordionOpen={sourcesAccordionOpen}
            setSourcesAccordionOpen={setSourcesAccordionOpen}
            totalWebCount={totalWebCount}
            totalFileCount={totalFileCount}
            webCitationsGrouped={webCitationsGrouped}
            fileCitationsGrouped={fileCitationsGrouped}
            uniqueDocsCount={uniqueDocsCount}
            documents={documents}
            messages={messages}
            inputQuestion={inputQuestion}
            setInputQuestion={setInputQuestion}
            isSending={isSending}
            sendingStatusText={sendingStatusText}
            isRecording={isRecording}
            attachedFiles={attachedFiles}
            setAttachedFiles={setAttachedFiles}
            chatTextareaRef={chatTextareaRef}
            chatAttachmentInputRef={chatAttachmentInputRef}
            chatEndRef={chatEndRef}
            handleSendMessage={handleSendMessage}
            toggleVoiceInput={toggleVoiceInput}
            adjustTextareaHeight={adjustTextareaHeight}
            editingMessageId={editingMessageId}
            editingMessageText={editingMessageText}
            setEditingMessageId={setEditingMessageId}
            setEditingMessageText={setEditingMessageText}
            handleSaveEditedMessage={handleSaveEditedMessage}
            handleRetryUserMessage={handleRetryUserMessage}
            handleCopyMessage={handleCopyMessage}
            copiedMessageId={copiedMessageId}
            handleCitationClick={handleCitationClick}
            setLightboxImage={setLightboxImage}
            isTypingStream={isTypingStream}
            streamingMsgId={streamingMsgId}
            format24HourDisplay={format24HourDisplay}
            activeAcademicCitation={activeAcademicCitation}
            setActiveAcademicCitation={setActiveAcademicCitation}
            activeDoc={activeDoc}
            setActiveDoc={setActiveDoc}
            targetPage={targetPage}
            setTargetPage={setTargetPage}
            highlightQuote={highlightQuote}
            setHighlightQuote={setHighlightQuote}
          />
        )}
      </main>

      {/* 3. MODALS TERISOLASI */}
      <DocumentPreviewModal
        previewDoc={previewDoc}
        setPreviewDoc={setPreviewDoc}
        currentUser={currentUser}
        setActiveDoc={setActiveDoc}
        setTargetPage={setTargetPage}
        setHighlightQuote={setHighlightQuote}
        setIsPdfPanelOpen={setIsPdfPanelOpen}
        setCurrentNav={setCurrentNav}
        apiBase={API_BASE}
      />

      <UserChatInspectorModal
        theme={theme}
        inspectingUser={inspectingUser}
        setInspectingUser={setInspectingUser}
        inspectingSessions={inspectingSessions}
        inspectingActiveSessionId={inspectingActiveSessionId}
        inspectingMessages={inspectingMessages}
        isInspectingLoading={isInspectingLoading}
        handleSelectInspectingSession={handleSelectInspectingSession}
      />

      <ProfileSettingsModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUser}
        theme={theme}
        toggleTheme={toggleTheme}
        documents={documents}
        chatSessions={chatSessions}
        onLogout={handleLogout}
      />

      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => setIsSubscriptionModalOpen(false)}
        currentUser={currentUser}
        onSubscriptionSuccess={(newQuota, newTier) => {
          setCurrentUser((prev) =>
            prev
              ? {
                  ...prev,
                  tier: newTier as any,
                  claude_quota_left: (prev.claude_quota_left || 0) + newQuota,
                }
              : null
          );
          showAlert(
            "Langganan Aktif!",
            `Selamat! Paket ${newTier === "pro_weekly" ? "Pro Mingguan" : "Pro Bulanan"} berhasil diaktifkan. Anda mendapatkan +${newQuota} chat Claude 3.5 Sonnet.`,
            "info"
          );
        }}
        apiBase={API_BASE}
        theme={theme}
      />

      <ConfirmDialogModal
        confirmModal={confirmModal}
        onCancel={() => setConfirmModal(null)}
        theme={theme}
      />

      <AlertDialogModal
        alertModal={alertModal}
        onClose={() => setAlertModal(null)}
        theme={theme}
      />

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
            <div
              className={`w-full flex items-center justify-between pb-2 mb-2 border-b ${
                theme === "dark" ? "border-[#2A333B]" : "border-[#DCE3E8]"
              }`}
            >
              <span className={`text-xs font-bold truncate max-w-md ${theme === "dark" ? "text-[#E6EDF2]" : "text-[#12202B]"}`}>
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
            <img src={lightboxImage.src} alt={lightboxImage.title} className="max-h-[75vh] max-w-full rounded-xl object-contain shadow-inner" />
          </div>
        </div>
      )}
    </div>
  );
}
