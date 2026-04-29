import React from "react";

export default function AnalysisProgress({ progress }) {
  const pct = Math.max(0, Math.min(100, progress?.pct ?? 0));
  const label = progress?.label || "Waiting to start";
  const status = progress?.status || "running";

  return (
    <section className="analysis-progress">
      <div className="progress-row">
        <strong>{label}</strong>
        <span>{pct}%</span>
      </div>
      <div className="progress-track" aria-label="Analysis progress">
        <div className={`progress-fill ${status}`} style={{ width: `${pct}%` }} />
      </div>
    </section>
  );
}
