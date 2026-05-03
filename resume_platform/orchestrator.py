"""
Orchestrator module for Resume Intelligence Platform V2.
"""

from __future__ import annotations

import logging
import tempfile
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, Optional

from agents.gap_analyzer import GapAnalyzerAgent
from agents.jd_intelligence import JDIntelligenceAgent
from agents.recruiter_sim import RecruiterSimulatorAgent
from agents.resume_understanding import ResumeUnderstandingAgent
from agents.sectioner_agent import SectionerAgent
from agents.rewriter import RewriterAgent
from engine.ats_scorer import score_resume
from engine.percentile import get_percentile
from validators import ResumeUnderstandingValidator, RewriterValidator


class Orchestrator:
    def __init__(self, user_id: Optional[str] = None):
        self.user_id = user_id
        self.resume_understanding = ResumeUnderstandingAgent()
        self.sectioner = SectionerAgent()
        self.jd_intelligence = JDIntelligenceAgent()
        self.gap_analyzer = GapAnalyzerAgent()
        self.rewriter = RewriterAgent()
        self.recruiter_sim = RecruiterSimulatorAgent()

    def _build_merged_resume_sections(self, resume_und: dict, resume_text: str):
        """Merge A1 and Sectioner sections; keep richer section payload."""
        from schemas.common import SectionText

        a1_raw = resume_und.get("resume_sections", {})
        a1_sections = {
            k: SectionText(**v) if isinstance(v, dict) else v
            for k, v in a1_raw.items()
        }

        merged = dict(a1_sections)
        try:
            sectioner_raw = self.sectioner.run({"resume_text": resume_text}) or {}
            sectioner_sections = {
                k: SectionText(**v) if isinstance(v, dict) else v
                for k, v in sectioner_raw.items()
            }
        except Exception as exc:
            logging.warning("Sectioner merge skipped: %s", exc)
            sectioner_sections = {}

        for name, sec in sectioner_sections.items():
            cur = merged.get(name)
            if not cur:
                merged[name] = sec
                continue
            cur_count = len(cur.sub_entries or [])
            new_count = len(sec.sub_entries or [])
            cur_len = len(cur.full_text or "")
            new_len = len(sec.full_text or "")
            if (new_count > cur_count) or (new_count == cur_count and new_len > cur_len):
                merged[name] = sec

        return merged

    def _infer_strengths_from_resume(self, resume_und: dict) -> dict:
        return {
            "match_score": None,
            "confidence_score": None,
            "gaps": [
                {"type": "poor_wording", "description": w, "severity": "minor", "suggestion": ""}
                for w in resume_und.get("weaknesses", [])
            ],
            "strengths": resume_und.get("strengths", []),
            "weaknesses": resume_und.get("weaknesses", []),
            "quick_wins": resume_und.get("improvement_areas", []),
            "resume_only_mode": True,
        }

    def _build_gap_fallback_rewrites(self, gap_output: Dict[str, Any]) -> Dict[str, Any]:
        fallback_rewrites: Dict[str, Dict[str, str]] = {}
        for gap in gap_output.get("gaps", []):
            section = gap.get("section", "unknown")
            hint = gap.get("rewrite_hint") or gap.get("suggestion") or "Improve this section."
            fallback_rewrites[section] = {
                "balanced": f"[Rewrite unavailable - {hint}]",
                "aggressive": f"[Rewrite unavailable - {hint}]",
                "top_1_percent": f"[Rewrite unavailable - {hint}]",
            }

        fallback_styles = {
            "balanced": {"summary": "", "skills": "", "experience": [], "projects": []},
            "aggressive": {"summary": "", "skills": "", "experience": [], "projects": []},
            "top_1_percent": {"summary": "", "skills": "", "experience": [], "projects": []},
        }

        for section, variants in fallback_rewrites.items():
            for style_name, text in variants.items():
                if section == "summary":
                    fallback_styles[style_name]["summary"] = text
                elif section == "skills":
                    fallback_styles[style_name]["skills"] = text
                elif section == "experience":
                    fallback_styles[style_name]["experience"] = [{
                        "company": "Experience",
                        "role": "",
                        "rewritten_bullets": [text],
                    }]
                elif section == "projects":
                    fallback_styles[style_name]["projects"] = [{
                        "name": "Projects",
                        "tech_stack": [],
                        "rewritten_description": text,
                    }]

        return {"rewrites": fallback_rewrites, "styles": fallback_styles}

    def run_full_evaluation(
        self,
        resume_text: str,
        jd_text: Optional[str] = None,
        run_sim: bool = False,
        skip_rewrite: bool = False,
        user_id: Optional[str] = None,
        progress_cb: Optional[callable] = None,
    ) -> Dict[str, Any]:
        uid = user_id or self.user_id or "anonymous"
        if progress_cb: progress_cb({"step":1,"label":"Reading your resume...","pct":10})
        has_jd = bool(jd_text and jd_text.strip())
        ats_result = score_resume(resume_text, jd_text if has_jd else None)

        # Extract sections immediately after parser — feeds A3 and A4
        if has_jd:
            with ThreadPoolExecutor(max_workers=2) as executor:
                fut_resume = executor.submit(
                    self.resume_understanding.run,
                    {"resume_text": resume_text, "user_id": uid},
                )
                fut_jd = executor.submit(
                    self.jd_intelligence.run,
                    {"jd_text": jd_text},
                )
                resume_und = fut_resume.result()
                jd_intel = fut_jd.result()
        else:
            resume_und = self.resume_understanding.run({
                "resume_text": resume_text,
                "user_id": uid,
            })
            jd_intel = None

        resume_und = ResumeUnderstandingValidator().validate_and_fix(resume_und, resume_text)
        resume_sections = self._build_merged_resume_sections(resume_und, resume_text)
        resume_und["resume_sections"] = {
            k: v.model_dump() if hasattr(v, "model_dump") else v
            for k, v in resume_sections.items()
        }
        if progress_cb: progress_cb({"step":1,"label":"Resume parsed successfully","pct":30})

        if has_jd:
            if progress_cb: progress_cb({"step":2,"label":"Analyzing gaps against JD...","pct":45})
            gap_result = self.gap_analyzer.run({
                "resume_understanding": resume_und,
                "jd_intelligence": jd_intel,
                "resume_text": resume_text,
                "resume_sections": resume_sections,
                "jd_text": jd_text,
                "mode": "evaluate",
            })
            if progress_cb: progress_cb({"step":2,"label":"Gap analysis complete","pct":65})
        else:
            gap_result = self._infer_strengths_from_resume(resume_und)

        rewrites = None
        if not skip_rewrite:
            try:
                if progress_cb: progress_cb({"step":3,"label":"Rewriting changed sections...","pct":75})
                rewrites = self.rewriter.run({
                    "resume_text": resume_text,
                    "resume_sections": resume_sections,
                    "gap_analysis": gap_result,
                    "jd_intelligence": jd_intel,
                    "style_fingerprint": None,
                })
                if rewrites:
                    rewrites = RewriterValidator().validate_and_fix(rewrites, resume_sections, resume_text)
                if progress_cb: progress_cb({"step":3,"label":"Resume rewritten successfully","pct":95})
            except Exception as exc:
                logging.warning("Rewriter failed: %s. Using gap-based fallback.", exc)
                rewrites = self._build_gap_fallback_rewrites(gap_result)

        sim_result = None
        if run_sim:
            try:
                sim_result = self.recruiter_sim.run({
                    "resume_text": resume_text,
                    "resume_sections": resume_sections,
                    "jd_intelligence": jd_intel or {},
                })
            except Exception as exc:
                logging.warning("Recruiter Sim (Agent 5) failed: %s. Continuing without simulation.", exc)

        percentile = None
        try:
            seniority = resume_und.get("seniority", "mid")
            if hasattr(seniority, "value"):
                seniority = seniority.value
            match_score = gap_result.get("match_score") or 0
            composite = (ats_result["score"] * 0.4) + (match_score * 0.6)
            percentile = get_percentile(composite, seniority)
        except Exception as exc:
            logging.warning("Percentile calculation failed: %s. Returning null.", exc)

        from engine.career_positioning import get_positioning_statement
        positioning = None
        try:
            _sen = resume_und.get("seniority", "mid")
            if hasattr(_sen, "value"): _sen = _sen.value
            positioning = get_positioning_statement(
                seniority=str(_sen),
                ats_score=ats_result.get("score", 0),
                jd_match_score=gap_result.get("jd_match_score_before", 0) if has_jd else 0,
                sections_changed=len(gap_result.get("sections_changed", [])),
                ats_breakdown=ats_result.get("breakdown", {}),
                ats_issues=ats_result.get("ats_issues", []),
                expected_signals=resume_und.get("resume_health", {}).get("expected_signals", []),
                percentile=percentile,
            )
        except Exception as e:
            logging.warning("Career positioning failed: %s", e)

        return {
            "ats": ats_result,
            "resume": resume_und,
            "gap": gap_result,
            "rewrites": rewrites,
            "sim": sim_result,
            "percentile": percentile,
            "positioning": positioning,
        }
