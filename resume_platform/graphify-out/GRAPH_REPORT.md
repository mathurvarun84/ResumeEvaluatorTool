# Graph Report - resume_platform  (2026-04-29)

## Corpus Check
- 44 files · ~32,794 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 353 nodes · 825 edges · 14 communities detected
- Extraction: 54% EXTRACTED · 46% INFERRED · 0% AMBIGUOUS · INFERRED: 383 edges (avg confidence: 0.55)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]

## God Nodes (most connected - your core abstractions)
1. `BaseAgent` - 56 edges
2. `SectionText` - 39 edges
3. `Seniority` - 33 edges
4. `RewriterAgent` - 26 edges
5. `Validate all 4 agents against CLAUDE.md requirements.` - 25 edges
6. `Orchestrator` - 23 edges
7. `ResumeSection` - 21 edges
8. `GapAnalyzerAgent` - 19 edges
9. `ResumeUnderstandingAgent` - 19 edges
10. `RewriteStyle` - 18 edges

## Surprising Connections (you probably didn't know these)
- `Input contract for Agent 4.` --uses--> `RewriteStyle`  [INFERRED]
  schemas\agent4_schema.py → schemas\common.py
- `read_upload()` --calls--> `parse_resume()`  [INFERRED]
  app.py → parser.py
- `_export_to_docx()` --calls--> `_build_structured_resume()`  [INFERRED]
  gap_session.py → parser.py
- `_export_to_docx()` --calls--> `_build_docx()`  [INFERRED]
  gap_session.py → engine\resume_builder.py
- `Orchestrator` --uses--> `GapAnalyzerAgent`  [INFERRED]
  orchestrator.py → agents\gap_analyzer.py

## Communities

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (39): Input contract for Agent 4., RewriterInput, BaseAgent, Return True for OpenAI model families that reject max_tokens., Attempt to repair JSON truncated mid-stream by the LLM.         Closes untermina, BaseAgent, Simple verification test for RewriterAgent improvements.  This test verifies the, Test that __init__ sets the correct model, max_tokens, and provider. (+31 more)

### Community 1 - "Community 1"
Cohesion: 0.17
Nodes (31): Pydantic schemas for Agent 1 — Resume Understanding.  Input: raw resume text (pr, Input contract for Agent 1. resume_text must be pre-cleaned by parser.py., A single seniority-level signal and whether it is present in the resume., Structured representation of a parsed resume.      All fields are required — Age, Seniority-aware resume health — does not require a JD., ResumeHealthOutput, ResumeUnderstandingInput, ResumeUnderstandingOutput (+23 more)

### Community 2 - "Community 2"
Cohesion: 0.17
Nodes (24): ActionableChange, ChangeLocation, DetailedEvalOutput, GapAnalyzerInput, GapAnalyzerOutput, OverallAssessment, Pydantic schemas for Agent 3 - Gap Analyzer., A single sub-entry within a multi-entry resume section (e.g. one company in Expe (+16 more)

### Community 3 - "Community 3"
Cohesion: 0.1
Nodes (31): _add_contact_line(), _build_docx(), build_final_docx(), build_resume_docx(), _detect_title(), _extract_section_content(), _format_paragraph_runs(), _get_structured_value() (+23 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (24): analyze(), download(), gap_close(), GapCloseRequest, _json_event(), FastAPI backend for Resume Intelligence Platform V2., Stream job progress as Server-Sent Events., Return current job status and result for polling fallback. (+16 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (26): ExperienceRewrite, ProjectRewrite, Pydantic schemas for Agent 4 — Rewriter.  Input: original resume text, gap analy, Structured rewrite of a single project entry., Rewritten bullets for a single role., Skills grouped by category for consistent ATS keyword extraction., Complete resume rewrite for one style., All three rewrite styles for the candidate's resume sections.      gap_session.p (+18 more)

### Community 6 - "Community 6"
Cohesion: 0.17
Nodes (16): _original(), read_upload(), _build_structured_resume(), _clean_text(), _extract_contact_line(), _extract_section_blocks(), _is_text_meaningful(), _parse_docx() (+8 more)

### Community 7 - "Community 7"
Cohesion: 0.28
Nodes (14): HiddenSignal, JDIntelligenceInput, JDIntelligenceOutput, Pydantic schemas for Agent 2 — JD Intelligence.  Input: raw job description text, A single implicit signal extracted from JD language., Input contract for Agent 2., Structured representation of a parsed job description.      semantic_skill_map d, CompanyType (+6 more)

### Community 8 - "Community 8"
Cohesion: 0.18
Nodes (9): ABC, BaseAgent - Abstract base class for all AI agents in the Resume Intelligence Pla, Full structured decomposition of a resume into verbatim sections., ResumeSections, Converts the LLM's list output into a dict keyed by canonical section name., Extracts a resume into canonical sections with verbatim text and sub-entries., Entry point for Agent Sectioner.          Args:             input_dict: Must con, Builds the user prompt with full resume text and canonical section mapping. (+1 more)

### Community 9 - "Community 9"
Cohesion: 0.18
Nodes (13): _add_horizontal_rule(), _edit_section(), _export_to_docx(), Interactive gap-closing helper.  This module is purely terminal-interface and do, Open an editor for the user to modify the provided text.      Parameters     ---, Create a comprehensive r-sum- document with gap analysis metadata.      The stru, Insert a horizontal line using an XML border.      The function mutates the last, Run the interactive gap-closing session.      Parameters     ----------     gap_ (+5 more)

### Community 10 - "Community 10"
Cohesion: 0.21
Nodes (13): _collect_issues(), _count_syllables(), ATS Scoring Engine — deterministic resume quality scorer.  Scores a resume on fo, Evaluates resume formatting (0-25):       - Checks for standard section headers, Calculates readability score (0-25):       - Uses Flesch-Kincaid formula (ideal:, Measures quantifiable achievements (0-25):       - Detects numbers (40% latency, Calculate the ATS (Applicant Tracking System) score for a resume.        The sco, Calculates keyword match score (0-25):       - Counts action verbs (led, built, (+5 more)

### Community 11 - "Community 11"
Cohesion: 0.27
Nodes (10): _ensure_users_dir(), load_session(), Memory layer – per‑user JSON store.  Stores session history, tracks runs, and ke, Return a fresh session scaffold for the given user_id., Load the JSON session file for *user_id*.      Returns an empty scaffold if the, Persist *session_data* for *user_id*.      Args:         user_id: Identifier for, Append *run_result* to the user's session history.      Maintains a maximum of 5, save_session() (+2 more)

### Community 12 - "Community 12"
Cohesion: 0.57
Nodes (6): get_company_tier_from_score(), get_positioning_statement(), _load_bands(), _percentile_label(), _rank_rationale(), Career positioning engine — NO LLM. Pure Python + static JSON.

### Community 13 - "Community 13"
Cohesion: 0.4
Nodes (5): extract_fingerprint(), Style fingerprint extractor.  Analyzes a user's session history and produces a s, Truncate *text* to *limit* characters without cutting in the middle of a word., Return a concise style fingerprint.      The fingerprint is a single sentence of, _truncate()

## Knowledge Gaps
- **65 isolated node(s):** `Interactive gap-closing helper.  This module is purely terminal-interface and do`, `Insert a horizontal line using an XML border.      The function mutates the last`, `Run the interactive gap-closing session.      Parameters     ----------     gap_`, `Open an editor for the user to modify the provided text.      Parameters     ---`, `Create a comprehensive r-sum- document with gap analysis metadata.      The stru` (+60 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `BaseAgent` connect `Community 0` to `Community 1`, `Community 2`, `Community 5`, `Community 7`, `Community 8`?**
  _High betweenness centrality (0.134) - this node is a cross-community bridge._
- **Why does `SectionText` connect `Community 2` to `Community 0`, `Community 1`, `Community 4`, `Community 5`, `Community 8`?**
  _High betweenness centrality (0.128) - this node is a cross-community bridge._
- **Why does `Orchestrator` connect `Community 4` to `Community 0`, `Community 1`, `Community 2`, `Community 7`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Are the 48 inferred relationships involving `BaseAgent` (e.g. with `Validate all 4 agents against CLAUDE.md requirements.` and `GapAnalyzerAgent`) actually correct?**
  _`BaseAgent` has 48 INFERRED edges - model-reasoned connections that need verification._
- **Are the 36 inferred relationships involving `SectionText` (e.g. with `Orchestrator` and `Orchestrator module for Resume Intelligence Platform V2.`) actually correct?**
  _`SectionText` has 36 INFERRED edges - model-reasoned connections that need verification._
- **Are the 29 inferred relationships involving `Seniority` (e.g. with `Validate all 4 agents against CLAUDE.md requirements.` and `JDIntelligenceAgent`) actually correct?**
  _`Seniority` has 29 INFERRED edges - model-reasoned connections that need verification._
- **Are the 15 inferred relationships involving `RewriterAgent` (e.g. with `Orchestrator` and `Orchestrator module for Resume Intelligence Platform V2.`) actually correct?**
  _`RewriterAgent` has 15 INFERRED edges - model-reasoned connections that need verification._