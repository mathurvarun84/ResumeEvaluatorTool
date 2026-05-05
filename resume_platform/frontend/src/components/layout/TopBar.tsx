import { useState } from "react";

import { useResumeStore } from "../../store/useResumeStore";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export default function TopBar() {
  const analysisResult = useResumeStore((state) => state.analysisResult);
  const jobId = useResumeStore((state) => state.jobId);
  const isLoading = useResumeStore((state) => state.isLoading);
  const [isPressed, setIsPressed] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async (): Promise<void> => {
    const sessionId = jobId ?? analysisResult?.job_id;
    if (!sessionId) {
      return;
    }

    setIsDownloading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/report?session_id=${encodeURIComponent(sessionId)}`
      );
      if (!response.ok) {
        throw new Error("Download failed.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "resume-report.pdf";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(
        `${API_BASE_URL}/api/report?session_id=${encodeURIComponent(sessionId)}`,
        "_blank",
        "noopener,noreferrer"
      );
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 32px",
        background: "#ffffff",
        borderBottom: "1.5px solid #e5e7eb",
        position: "sticky",
        top: 0,
        zIndex: 50,
        backdropFilter: "blur(12px)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div
          style={{
            width: "42px",
            height: "42px",
            borderRadius: "12px",
            background: "linear-gradient(135deg, #6366f1, #7c3aed)",
            boxShadow: "0 3px 0 #4338ca, 0 5px 12px rgba(99,102,241,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: "#ffffff",
            fontSize: "19px",
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          ✦
        </div>
        <div>
          <div
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color: "#111827",
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
            }}
          >
            AI Career Intelligence
          </div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 400,
              color: "#6b7280",
              marginTop: "2px",
            }}
          >
            Premium Career Platform
          </div>
        </div>
      </div>

      <button
        onClick={handleDownload}
        disabled={!analysisResult || isLoading || isDownloading}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onMouseLeave={() => setIsPressed(false)}
        style={{
          background:
            analysisResult && !isLoading && !isDownloading ? "#6366f1" : "#f3f4f6",
          color:
            analysisResult && !isLoading && !isDownloading ? "#ffffff" : "#9ca3af",
          borderRadius: "10px",
          padding: "10px 20px",
          fontSize: "13px",
          fontWeight: 700,
          border: "none",
          cursor:
            analysisResult && !isLoading && !isDownloading ? "pointer" : "not-allowed",
          transform:
            analysisResult && !isLoading && !isDownloading && isPressed
              ? "translateY(3px)"
              : "translateY(0px)",
          transition: "transform 0.1s, box-shadow 0.1s",
          boxShadow: analysisResult && !isLoading && !isDownloading
            ? isPressed
              ? "0 1px 0 #4338ca"
              : "0 3px 0 #4338ca, 0 5px 12px rgba(99,102,241,0.25)"
            : "0 3px 0 #d1d5db",
        }}
      >
        {isDownloading ? "⏳ Downloading..." : "Download Report"}
      </button>
    </header>
  );
}
