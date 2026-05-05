import axios, { AxiosError } from "axios";

import type { AnalysisResult, SSEProgressEvent } from "../types";

interface FastAPIErrorDetail {
  msg?: string;
}

interface FastAPIErrorResponse {
  detail?: string | FastAPIErrorDetail | FastAPIErrorDetail[];
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const ANALYZE_TIMEOUT_MS = 60_000;

const getErrorMessage = (error: AxiosError<FastAPIErrorResponse>): string => {
  const detail = error.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg).filter(Boolean).join(", ");
  }
  if (detail?.msg) {
    return detail.msg;
  }
  if (error.code === "ECONNABORTED") {
    return "Request timed out. Please try again.";
  }
  return error.response?.statusText || error.message;
};

const waitForAnalysisCompletion = async (jobId: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const source = new EventSource(`${API_BASE_URL}/api/stream/${jobId}`);

    source.onmessage = (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as SSEProgressEvent;
      if (payload.status === "complete") {
        source.close();
        resolve();
      }
      if (payload.status === "error") {
        source.close();
        reject(new Error(payload.error ?? "Analysis failed on server."));
      }
    };

    source.onerror = () => {
      source.close();
      reject(new Error("Connection lost while tracking analysis progress."));
    };
  });

export async function analyzeResume(
  file: File,
  jdText?: string
): Promise<AnalysisResult> {
  const formData = new FormData();
  formData.append("resume", file);
  formData.append("jd_text", jdText ?? "");
  formData.append("run_sim", "true");

  try {
    const analyzeResponse = await axios.post<{ job_id: string }>(
      `${API_BASE_URL}/api/analyze`,
      formData,
      { timeout: ANALYZE_TIMEOUT_MS }
    );

    const jobId = analyzeResponse.data.job_id;
    await waitForAnalysisCompletion(jobId);

    const resultResponse = await axios.get<AnalysisResult>(
      `${API_BASE_URL}/api/result/${jobId}`,
      { timeout: ANALYZE_TIMEOUT_MS }
    );
    return resultResponse.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = getErrorMessage(error);
      if (error.response?.status === 422) {
        throw new Error(`Validation failed: ${message}`);
      }
      if (error.response?.status === 500) {
        throw new Error(`Server error: ${message}`);
      }
      throw new Error(message);
    }
    throw error;
  }
}
