"use client";

import React from "react";

export function getFileBadgeInfo(filename: string, fileType?: string) {
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

export function FileFormatIcon({
  filename,
  fileType,
  size = "md",
}: {
  filename: string;
  fileType?: string;
  size?: "sm" | "md" | "lg";
}) {
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
