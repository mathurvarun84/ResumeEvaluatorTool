import React, { useState } from "react";

export default function UploadZone({ onJobStart, onError }) {
  const [file, setFile] = useState(null);
  const [jdText, setJdText] = useState("");
  const [runSim, setRunSim] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.append("resume", file);
      body.append("jd_text", jdText);
      body.append("run_sim", String(runSim));
      const res = await fetch("/api/analyze", { method: "POST", body });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      onJobStart?.(data.job_id);
    } catch (err) {
      onError?.(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="upload-zone" onSubmit={submit}>
      <input type="file" accept=".pdf,.docx,.txt" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <textarea value={jdText} onChange={(e) => setJdText(e.target.value)} placeholder="Paste job description" />
      <label>
        <input type="checkbox" checked={runSim} onChange={(e) => setRunSim(e.target.checked)} />
        Recruiter simulation
      </label>
      <button type="submit" disabled={!file || busy}>{busy ? "Uploading..." : "Analyze"}</button>
    </form>
  );
}
