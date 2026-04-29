import React, { useEffect, useState } from "react";
import AnalysisProgress from "./components/shared/AnalysisProgress.jsx";
import VerdictBanner from "./components/overview/VerdictBanner.jsx";
import CareerPositioning from "./components/overview/CareerPositioning.jsx";
import UploadZone from "./components/upload/UploadZone.jsx";

export default function App() {
  const [jobId, setJobId] = useState("");
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [tab, setTab] = useState("upload");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!jobId) return;
    const es = new EventSource(`/api/stream/${jobId}`);
    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress(data);
      if (data.status === "complete") {
        setResult(data.result);
        setTab("overview");
        es.close();
      }
      if (data.status === "error") {
        setError(data.label);
        es.close();
      }
    };
    es.onerror = async () => {
      es.close();
      const res = await fetch(`/api/result/${jobId}`);
      if (res.ok) {
        const data = await res.json();
        setProgress(data.progress);
        if (data.status === "complete") {
          setResult(data.result);
          setTab("overview");
        }
      }
    };
    return () => es.close();
  }, [jobId]);

  return (
    <main className="app-shell">
      <nav className="tabs">
        <button onClick={() => setTab("upload")}>Upload</button>
        <button onClick={() => setTab("overview")} disabled={!result}>Overview</button>
        <button onClick={() => setTab("download")} disabled={!result}>Download</button>
      </nav>
      {error && <p className="error">{error}</p>}
      {tab === "upload" && <UploadZone onJobStart={setJobId} onError={setError} />}
      {progress && <AnalysisProgress progress={progress} />}
      {tab === "overview" && result && (
        <>
          <VerdictBanner result={result} />
          <CareerPositioning positioning={result.positioning} />
        </>
      )}
      {tab === "download" && result && (
        <a className="download-link" href={`/api/download/${jobId}?style=balanced`}>Download DOCX</a>
      )}
    </main>
  );
}
