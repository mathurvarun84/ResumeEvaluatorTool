import { create } from "zustand";

import type {
  AnalysisResult,
  RewriteStyle,
  SSEProgressEvent,
  TabId,
} from "../types";

interface ResumeStoreState {
  jobId: string | null;
  analysisResult: AnalysisResult | null;
  selectedStyle: RewriteStyle;
  acceptedSections: Record<string, RewriteStyle>;
  activeTab: TabId;
  isAnalyzing: boolean;
  analysisError: string | null;
  currentProgress: SSEProgressEvent | null;
  docxId: string | null;
  userId: string;
  setJobId: (jobId: string | null) => void;
  setAnalysisResult: (analysisResult: AnalysisResult | null) => void;
  setSelectedStyle: (style: RewriteStyle) => void;
  acceptSection: (section: string, style: RewriteStyle) => void;
  setActiveTab: (tab: TabId) => void;
  setIsAnalyzing: (isAnalyzing: boolean) => void;
  setAnalysisError: (analysisError: string | null) => void;
  setCurrentProgress: (progress: SSEProgressEvent | null) => void;
  setDocxId: (docxId: string | null) => void;
  resetAnalysis: () => void;
}

const getOrCreateUserId = (): string => {
  const storageKey = "rip_user_id";
  const stored = localStorage.getItem(storageKey);
  if (stored) {
    return stored;
  }

  const generated = crypto.randomUUID();
  localStorage.setItem(storageKey, generated);
  return generated;
};

export const useResumeStore = create<ResumeStoreState>((set) => ({
  jobId: null,
  analysisResult: null,
  selectedStyle: "balanced",
  acceptedSections: {},
  activeTab: "overview",
  isAnalyzing: false,
  analysisError: null,
  currentProgress: null,
  docxId: null,
  userId: getOrCreateUserId(),

  setJobId: (jobId) => set({ jobId }),
  setAnalysisResult: (analysisResult) => set({ analysisResult }),
  setSelectedStyle: (selectedStyle) => set({ selectedStyle }),
  acceptSection: (section, style) =>
    set((state) => ({
      acceptedSections: {
        ...state.acceptedSections,
        [section]: style,
      },
    })),
  setActiveTab: (activeTab) => set({ activeTab }),
  setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
  setAnalysisError: (analysisError) => set({ analysisError }),
  setCurrentProgress: (currentProgress) => set({ currentProgress }),
  setDocxId: (docxId) => set({ docxId }),
  resetAnalysis: () =>
    set({
      jobId: null,
      analysisResult: null,
      acceptedSections: {},
      isAnalyzing: false,
      analysisError: null,
      currentProgress: null,
      docxId: null,
    }),
}));
