export interface ATSBreakdown {
  keyword_match: number;
  formatting: number;
  readability: number;
  impact_metrics: number;
}

export interface ATSResult {
  score: number;
  breakdown: ATSBreakdown;
  ats_issues: string[];
}

export interface SubLocationChange {
  sub_id: string;
  sub_label: string;
  needs_change: boolean;
  gap_reason: string;
  rewrite_instruction: string;
  missing_keywords: string[];
}

export interface SectionGap {
  section: string;
  needs_change: boolean;
  gap_reason: string;
  missing_keywords: string[];
  rewrite_instruction: string;
  present_in_resume: boolean;
  sub_changes: SubLocationChange[];
}

export interface ActionableChange {
  change_id: number;
  location: {
    section: string;
    sub_location: string;
  };
  change_type:
    | "rewrite_bullet"
    | "add_keyword"
    | "rewrite_section"
    | "add_section"
    | "remove_content"
    | "strengthen_metric";
  priority: "critical" | "high" | "medium";
  why: string;
  original_text: string;
  suggested_text: string;
  keywords_added: string[];
}

export interface PersonaVerdict {
  persona: string;
  first_impression: string;
  noticed: string[];
  ignored: string[];
  rejection_reason: string;
  shortlist_decision: boolean;
}

export interface SimResult {
  personas: PersonaVerdict[];
  shortlist_rate: number;
  consensus_strengths: string[];
  consensus_weaknesses: string[];
  most_critical_fix: string;
}

export interface SectionRewrite {
  balanced: string;
  aggressive: string;
  top_1_percent: string;
}

export interface ResumeUnderstanding {
  experience_years: number;
  seniority: "junior" | "mid" | "senior" | "staff";
  tech_stack: string[];
  domains: string[];
  has_metrics: boolean;
  has_summary: boolean;
  sections_present: string[];
  resume_sections: Record<string, { full_text: string }>;
}

export interface GapResult {
  jd_match_score_before: number | null;
  section_gaps: SectionGap[];
  missing_keywords: string[];
  priority_fixes: string[];
  changes: ActionableChange[];
}

export interface PositioningResult {
  positioning_line: string;
  delta_line: string;
  cta_line: string;
  fix_items: string[];
}

export interface AnalysisResult {
  job_id: string;
  ats: ATSResult;
  resume: ResumeUnderstanding;
  gap: GapResult | null;
  rewrites: Record<string, SectionRewrite> | null;
  sim: SimResult | null;
  percentile: number | null;
  positioning: PositioningResult | null;
}

export interface SSEProgressEvent {
  step?: number;
  label?: string;
  pct?: number;
  status: "running" | "complete" | "error";
  error?: string;
}

export interface HistoryRun {
  run_id: string;
  timestamp: string;
  ats_score: number;
  jd_match: number | null;
  percentile: number | null;
}

export interface HistoryResponse {
  runs: HistoryRun[];
}

export interface GapCloseRequest {
  job_id: string;
  accepted_sections: Record<string, RewriteStyle>;
  user_id: string;
}

export interface GapCloseResponse {
  docx_id: string;
}

export type RewriteStyle = "balanced" | "aggressive" | "top_1_percent";

export type TabId = "overview" | "fixes" | "recruiter" | "gap" | "progress";
