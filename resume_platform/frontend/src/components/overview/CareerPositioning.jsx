import React from "react";

export default function CareerPositioning({ positioning }) {
  if (!positioning) return null;

  return (
    <section className="career-positioning">
      <p>{positioning.positioning_line}</p>
      <strong>{positioning.delta_line}</strong>
      <span>{positioning.cta_line}</span>
    </section>
  );
}
