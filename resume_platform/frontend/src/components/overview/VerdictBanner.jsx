import React from "react";

export default function VerdictBanner({ result }) {
  const ats = result?.ats?.score ?? 0;
  const match = result?.gap?.jd_match_score_before ?? result?.gap?.match_score ?? 0;
  const percentile = result?.percentile?.percentile ?? result?.percentile?.label;

  return (
    <section className="verdict-banner">
      <div>
        <span>ATS</span>
        <strong>{ats}</strong>
      </div>
      <div>
        <span>JD Match</span>
        <strong>{match || "--"}</strong>
      </div>
      <div>
        <span>Market Rank</span>
        <strong>{percentile || "--"}</strong>
      </div>
    </section>
  );
}
