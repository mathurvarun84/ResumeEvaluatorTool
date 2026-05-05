import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { getResult } from "./api/client";
import { EvaluationDashboard } from "./EvaluationDashboard";
import TopBar from "./components/layout/TopBar";
import TabNav from "./components/layout/TabNav";
import ActionableFixes from "./components/ActionableFixes";
import GapCloser from "./components/GapCloser";
import RecruiterSimulation from "./components/RecruiterSimulation";
import AnalysisProgress from "./components/upload/AnalysisProgress";
import UploadZone from "./components/upload/UploadZone";
import { IS_MOCK } from "./hooks/useMockData";
import { MOCK_ANALYSIS_RESULT, MOCK_SSE_EVENTS } from "./mocks/mockData";
import { useResumeStore } from "./store/useResumeStore";
import type { SSEProgressEvent } from "./types/index";

const queryClient = new QueryClient();

function AppShell() {
  const jobId = useResumeStore((state) => state.jobId);
  const analysisResult = useResumeStore((state) => state.analysisResult);
  const activeTab = useResumeStore((state) => state.activeTab);
  const isAnalyzing = useResumeStore((state) => state.isAnalyzing);
  const currentProgress = useResumeStore((state) => state.currentProgress);
  const setAnalysisResult = useResumeStore((state) => state.setAnalysisResult);
  const setIsAnalyzing = useResumeStore((state) => state.setIsAnalyzing);
  const setActiveTab = useResumeStore((state) => state.setActiveTab);
  const setCurrentProgress = useResumeStore((state) => state.setCurrentProgress);
  const setAnalysisError = useResumeStore((state) => state.setAnalysisError);
  const setIsLoading = useResumeStore((state) => state.setIsLoading);
  const resultLoadedRef = useRef(false);

  useEffect(() => {
    resultLoadedRef.current = false;
  }, [jobId]);

  useEffect(() => {
    if (!isAnalyzing || !jobId || !IS_MOCK) {
      return;
    }

    const timers = MOCK_SSE_EVENTS.map((event, index) =>
      window.setTimeout(() => {
        setCurrentProgress(event);
      }, (index + 1) * 500)
    );

    timers.push(
      window.setTimeout(() => {
        const completeEvent: SSEProgressEvent = {
          status: "complete",
          pct: 100,
        };
        setCurrentProgress(completeEvent);
        setAnalysisResult(MOCK_ANALYSIS_RESULT);
        setIsAnalyzing(false);
        setIsLoading(false);
        setActiveTab("overview");
      }, 3500)
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [
    isAnalyzing,
    jobId,
    setActiveTab,
    setAnalysisResult,
    setCurrentProgress,
    setIsAnalyzing,
    setIsLoading,
  ]);

  useEffect(() => {
    if (
      IS_MOCK ||
      !jobId ||
      currentProgress?.status !== "complete" ||
      resultLoadedRef.current
    ) {
      return;
    }

    resultLoadedRef.current = true;
    void getResult(jobId)
      .then((result) => {
        setAnalysisResult(result);
        setIsAnalyzing(false);
        setIsLoading(false);
        setActiveTab("overview");
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Unable to load analysis.";
        setAnalysisError(message);
        setIsAnalyzing(false);
        setIsLoading(false);
      });
  }, [
    currentProgress?.status,
    jobId,
    setActiveTab,
    setAnalysisError,
    setAnalysisResult,
    setIsAnalyzing,
    setIsLoading,
  ]);

  if (!analysisResult) {
    return (
      <div style={{ minHeight: '100vh', background: '#ffffff' }}>
        <TopBar />
        <UploadZone />
        {isAnalyzing && <AnalysisProgress />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <TopBar />
      <TabNav />
      <div className="tab-content">
        <div style={{ display: activeTab === "overview" ? "block" : "none" }}>
          <EvaluationDashboard onTabChange={(tab: string) => setActiveTab(tab as import("./types").TabId)} />
        </div>
        <div style={{ display: activeTab === "fixes" ? "block" : "none" }}>
          <ActionableFixes />
        </div>
        <div style={{ display: activeTab === "recruiter" ? "block" : "none" }}>
          <RecruiterSimulation />
        </div>
        <div style={{ display: activeTab === "gap" ? "block" : "none" }}>
          <GapCloser />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  );
}
