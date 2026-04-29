# RIP V2 — CLAUDE.md
> Read before writing any code. Single source of truth.

---

## Project
**Resume Intelligence Platform V2** — Multi-agent AI career co-pilot for Indian software engineers (22–40 yrs, fresher to staff). Evaluates, benchmarks, rewrites, and improves resumes against JDs.
Owner: Varun Mathur | Zenteiq Aitech Innovations, Bengaluru

---

## Model Assignments ⚠️ NEVER CHANGE

| Agent | Provider | Model | max_tokens |
|---|---|---|---|
| Agent 1 — Resume Understanding | OpenAI | `gpt-4o-mini` | 4000 |
| Agent 2 — JD Intelligence | OpenAI | `gpt-4o-mini` | 4000 |
| Agent 3 — Gap Analyzer | OpenAI | `gpt-4o-mini` | 4000 |
| Agent 4 — Rewrite Agent | Anthropic | `claude-haiku-4.5` | 6000 |
| Agent 5 — Recruiter Simulator | Anthropic | `claude-haiku-4.5` | 4000 |
| Orchestrator | OpenAI | `gpt-4o-mini` | 4000 |

- Agents 1–4 + Orchestrator: `openai` SDK only
- Agent 5: `anthropic` SDK only
- Never hardcode model strings outside each agent's `__init__`
- `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` loaded from `.env` only — never hardcode, never log

---

## Stack

Python 3.9+ | Pydantic v2 | Typer (CLI) | Rich (terminal) | Streamlit (web) | python-docx | pdfplumber | plotly | python-dotenv

---

## Folder Structure

```
resume_platform/
├── CLAUDE.md
├── main.py                  ← CLI (5 commands)
├── orchestrator.py          ← sequences agents
├── renderer.py              ← rich terminal output
├── parser.py                ← PDF/DOCX/TXT → clean text (pdfplumber, 6000 char cap)
├── gap_session.py           ← interactive diff + .docx export
├── app.py                   ← Streamlit (5 tabs)
├── schemas/                 ← Pydantic models per agent + common enums
├── agents/                  ← base_agent.py + 5 agent files
├── engine/                  ← ats_scorer.py (NO LLM) + percentile.py
├── memory/                  ← session_store.py + style_extractor.py
└── data/benchmarks.json
```

---

## Pydantic Schemas (enforce everywhere)

All agent I/O must be Pydantic v2 models. Raw dicts only at LLM boundary. Use `.model_dump()` between agents.

### Common enums (`schemas/common.py`)
```python
class Seniority(str, Enum):
    JUNIOR = "junior"   # 0–2 yrs
    MID = "mid"         # 3–5 yrs
    SENIOR = "senior"   # 6–10 yrs
    STAFF = "staff"     # 11+ yrs or Staff/Principal/Director title

class CompanyType(str, Enum):
    FAANG = "faang" | PRODUCT_UNICORN = "product-unicorn"
    FUNDED_STARTUP = "funded-startup" | ENTERPRISE = "enterprise"
    SERVICE_BASED = "service-based" | UNKNOWN = "unknown"

class RewriteStyle(str, Enum):
    BALANCED = "balanced" | AGGRESSIVE = "aggressive" | TOP_1_PERCENT = "top_1_percent"
```

### Agent 1 Output — `ResumeUnderstandingOutput`
`experience_years` (int) | `seniority` (Seniority) | `tech_stack` (List[str]) | `domains` (List[str]) | `has_metrics` (bool) | `has_summary` (bool) | `sections_present` (List[str])

### Agent 2 Output — `JDIntelligenceOutput`
`role_title` (str) | `must_have_skills` (List[str]) | `nice_to_have_skills` (List[str]) | `hidden_signals` (List[HiddenSignal]) | `semantic_skill_map` (Dict[str, List[str]]) | `seniority_expected` (Seniority) | `company_type` (CompanyType)

### Agent 3 Output — `GapAnalyzerOutput`
`jd_match_score` (int 0–100) | `gaps` (List[SectionGap]) | `missing_keywords` (List[str]) | `priority_fixes` (List[str])
`SectionGap`: `section` | `missing_keywords` | `rewrite_hint`

### Agent 4 Output — `RewriterOutput`
`rewrites`: Dict[section_name → `SectionRewrite`]
`SectionRewrite`: `balanced` | `aggressive` | `top_1_percent` (all str)

### Agent 5 Output — `RecruiterSimOutput`
`personas` (List[PersonaVerdict], exactly 10) | `shortlist_rate` (float 0–1) | `consensus_strengths` | `consensus_weaknesses` | `most_critical_fix`
`PersonaVerdict`: `persona` | `first_impression` | `noticed` | `ignored` | `rejection_reason` | `shortlist_decision` (bool)

---

## BaseAgent Contract

```python
class BaseAgent(ABC):
    def __init__(self, model: str, max_tokens: int, provider: str = "openai"):
        # provider routes _call_llm to openai or anthropic SDK

    def run(self, input_dict: dict) -> dict:  # abstract — must validate I/O via Pydantic
    def _call_llm(self, system_prompt: str, user_message: str) -> str:  # 1 auto-retry on JSON fail
    def _parse_json(self, raw: str) -> dict   # strips fences, raises ValueError with agent name
    def validate_output(self, output: dict, required_keys: list[str]) -> None  # legacy fallback
```

**OpenAI call (Agents 1–4):** always include `response_format={"type": "json_object"}`
**Anthropic call (Agent 5):** `client.messages.create(model, max_tokens, system=..., messages=[...])`

---

## Orchestrator Execution Order

```
1. ATS scoring          — deterministic, no LLM
2. Agent 1 + Agent 2    — parallel (ThreadPoolExecutor, max_workers=2)
3. Agent 3              — sequential, needs step 2 outputs
4. Memory load + fingerprint
5. Agent 4 + Agent 5    — parallel if both requested
6. Market percentile    — deterministic
7. Memory update
8. Return combined dict
```

Graceful degradation: Agent 5/4/memory failures → log + continue. Agent 1/2 failures → raise (pipeline blocked).

---

## ATS Scoring — `engine/ats_scorer.py` (NO LLM)

| Sub-score | Method | Max |
|---|---|---|
| `keyword_match` | Action verbs + tech keywords, normalized | 25 |
| `formatting` | Section headers, consistent bullets, 1–2 pages, no tables | 25 |
| `readability` | Avg sentence length + Flesch-Kincaid approx | 25 |
| `impact_metrics` | Regex scan for numbers, %, $, ₹, latency/scale terms | 25 |

Returns: `{ score, breakdown, ats_issues }`.
Composite score = `(ats_score × 0.4) + (jd_match_score × 0.6)`

---

## Gap Session — `gap_session.py`

- Rich table diff: ORIGINAL (red header) vs REWRITTEN (green header)
- Per-section prompt: `[A]ccept / [R]eject / [E]dit?`
- Edit flow: `tempfile` → `$EDITOR` → `nano` → `vi` → default accept on all failures
- Returns: `{ decisions, output_path, sections_accepted, sections_rejected }`

### .docx Export Styling ⚠️ DO NOT CHANGE
| Element | Style |
|---|---|
| Candidate name | Heading 1, Bold, 16pt, centered |
| Contact line | Normal, centered |
| Section headers | Arial Bold 12pt, black ruled top border via OxmlElement — **NOT teal** |
| Bullets (lines starting `-` or `•`) | List Bullet style |
| Body text | Arial 10pt, Normal paragraph |
| Margins | 1.27cm all sides |

---

## Streamlit — `app.py` (5 tabs)

| Tab | Purpose |
|---|---|
| 1 — Evaluate | Upload resume + JD → ATS score, shortlist score, market percentile |
| 2 — Recruiter Sim | 10 persona cards in 2-col grid, aggregate shortlist rate |
| 3 — Gap Closer | Per-section accept/keep radio, keyword pills, generate + download .docx |
| 4 — Agent Explorer | Select agent, paste JSON input, run, see output + schema compliance |
| 5 — My Progress | Session history table, ATS + match score trend charts (plotly), style fingerprint |

---

## Memory Schema

```json
{
  "user_id": "string", "created_at": "ISO timestamp",
  "runs": [{ "timestamp": "", "ats_score": 0, "match_score": 0,
             "accepted_sections": [], "rejected_sections": [] }],
  "style_decisions": { "accepted": [], "rejected": [] }
}
```
- Max 50 runs (drop oldest). `memory/users/` auto-created. Load returns empty scaffold if missing.

---

## Benchmarks — `data/benchmarks.json`

```json
{
  "junior":  { "avg": 48, "p25": 38, "p50": 48, "p75": 60, "p90": 72 },
  "mid":     { "avg": 55, "p25": 45, "p50": 55, "p75": 67, "p90": 78 },
  "senior":  { "avg": 63, "p25": 52, "p50": 63, "p75": 74, "p90": 83 },
  "staff":   { "avg": 70, "p25": 60, "p50": 70, "p75": 80, "p90": 88 }
}
```

---

## Recruiter Personas (Agent 5 — all 10 in one LLM call)

1. FAANG Technical Screener | 2. Startup Hiring Manager | 3. Fintech Risk-Aware Recruiter
4. Product Company PM-adjacent | 5. High-Volume Agency Recruiter | 6. Senior IC Evaluator
7. Diversity-Focused Recruiter | 8. Campus/Entry-Level Recruiter | 9. Remote-First Recruiter | 10. Legacy Enterprise Recruiter

---

## Token Budget

| Rule | Limit |
|---|---|
| Style fingerprint | 200 tokens max — truncate output to 900 chars |
| Agent 4 max_tokens | 6000 |
| All other agents max_tokens | 4000 |
| ATS scorer | 0 LLM tokens |
| Wall time target | < 40 sec without simulation |

---

## Anti-Hallucination Rules (Agent 4 — enforce in prompt + tests)

1. Never invent companies not in original resume
2. Never invent degrees or institutions
3. Never change tenure at any role
4. Never invent metrics — use placeholders: `[X%]`, `[N users]`, `[Xms]`, `[₹X Cr ARR]`
5. Never invent project names

Violation = product defect.

---

## Error Handling

- All LLM calls: `try/except` with **1 auto-retry** on JSON parse failure
- All file I/O: `try/except` with descriptive messages — no raw tracebacks to user
- `ValidationError` caught at agent boundaries → re-raised as `ValueError` with agent name
- CLI: `typer.echo()` for errors, `raise typer.Exit(code=1)` on fatal

---

## CLI Commands

`evaluate` | `close-gaps` | `simulate` | `history` | `agent`
Every command must have `--help` with all options described.
Use `rich.console.Console` for all output — never `print()`.

---

## Testing Gates

```bash
# Foundation
python -c "from engine.ats_scorer import score_resume; from parser import parse_resume; print('OK')"
# Agents 1–2
python -c "from agents.resume_understanding import ResumeUnderstandingAgent; from agents.jd_intelligence import JDIntelligenceAgent; print('OK')"
# Agents 3–4
python -c "from agents.gap_analyzer import GapAnalyzerAgent; from agents.rewriter import RewriterAgent; print('OK')"
# Agent 5 + Memory
python -c "from agents.recruiter_sim import RecruiterSimulatorAgent; from memory.session_store import load_session; print('OK')"
# Orchestrator
python -c "from orchestrator import Orchestrator; print('OK')"
# Gap session
python -c "from gap_session import run_gap_session; print('OK')"
# CLI
python main.py --help
# Streamlit
streamlit run app.py --server.headless true &
# All schemas
python -c "from schemas.common import Seniority, CompanyType, RewriteStyle; from schemas.agent1_schema import *; from schemas.agent2_schema import *; from schemas.agent3_schema import *; from schemas.agent4_schema import *; from schemas.agent5_schema import *; print('All schemas OK')"
```

---

## What NOT To Do

- No Anthropic SDK in Agents 1–4 or Orchestrator
- No OpenAI SDK in Agent 5
- No LLM calls in `engine/ats_scorer.py` or `engine/percentile.py`
- No hardcoded API keys anywhere — `.env` only
- No `asyncio` — use `ThreadPoolExecutor` for parallelism
- No `streamlit` imports in `main.py` or agent files
- No `print()` in CLI — use `rich.console.Console`
- No raw dicts in internal logic — use `.model_dump()` only at agent boundaries
- No function > 40 lines without a docstring
- No magic numbers without an inline comment
- No unapproved packages in `requirements.txt`
- No 6th agent without updating this file and orchestrator
- No more than 50 stored runs per user

---

*RIP V2 | Zenteiq Aitech Innovations | Bengaluru | April 2026*
- # ARCHITECTURE OVERRIDE
Agent 4 (Rewriter): Anthropic claude-haiku-4.5 via anthropic SDK, max_tokens=6000
Do NOT change provider, model, or switch to OpenAI for this agent.

---

## ROOT CAUSE

The error "Unterminated string starting at line 448 column 13 (char 37580)" means the LLM
response is being truncated mid-JSON at ~37,580 characters. The JSON is valid up to that
point but the model hits max_tokens=6000 and stops mid-string, producing unparseable output.

The rewriter is trying to return all sections × 3 styles in one giant JSON blob.
At 6000 tokens output limit, a full resume rewrite across balanced/aggressive/top_1_percent
easily exceeds this — especially for senior candidates with 6+ experience sections.

---

## FIX 1 — Rewrite Section-by-Section (Primary Fix)

Change RewriterAgent to process one section at a time instead of all sections in one call.

In `agents/rewriter.py`, replace the single bulk LLM call with a loop:

```python
def run(self, input_dict: dict) -> dict:
    inp = RewriterInput(**input_dict)
    rewrites = {}

    for gap in inp.gaps:
        section_name = gap["section"]
        section_content = self._extract_section(inp.resume_text, section_name)

        prompt = self._build_section_prompt(section_name, section_content, gap)

        for attempt in range(2):
            try:
                raw = self._call_llm(SYSTEM_PROMPT, prompt)
                parsed = self._parse_json(raw)
                rewrites[section_name] = SectionRewrite(**parsed)
                break
            except (ValueError, ValidationError) as e:
                if attempt == 1:
                    # Fallback: use original section content for all 3 styles
                    logging.warning(f"RewriterAgent: section '{section_name}' failed, using original. Error: {e}")
                    rewrites[section_name] = SectionRewrite(
                        balanced=section_content or f"[{section_name} rewrite unavailable]",
                        aggressive=section_content or f"[{section_name} rewrite unavailable]",
                        top_1_percent=section_content or f"[{section_name} rewrite unavailable]"
                    )

    return RewriterOutput(rewrites=rewrites).model_dump()
```

Per-section prompt shape (returns small JSON, never truncates):
```python
def _build_section_prompt(self, section: str, content: str, gap: dict) -> str:
    return f"""Rewrite the following resume section in 3 styles.
Return ONLY a JSON object with exactly these 3 keys: "balanced", "aggressive", "top_1_percent".
No preamble, no markdown fences, no extra keys.

Section: {section}
Original content:
{content[:2000]}

Missing keywords to incorporate: {', '.join(gap.get('missing_keywords', [])[:10])}
Rewrite hint: {gap.get('rewrite_hint', '')}

Anti-hallucination rules:
- Never invent companies, degrees, metrics, or project names not in the original
- Use placeholders [X%], [N users], [Xms], [₹X Cr] for any missing metrics
- Do not change tenure at any role

JSON output only:"""
```

---

## FIX 2 — Harden the System Prompt to Force Compact JSON

Update the SYSTEM_PROMPT in `agents/rewriter.py`:

```python
SYSTEM_PROMPT = """You are a resume rewriter for Indian software engineers.

CRITICAL OUTPUT RULES:
1. Return ONLY a valid JSON object. No markdown, no backticks, no explanation.
2. Keep each rewrite to 150 words maximum per style. Be dense, not verbose.
3. Never leave a string unterminated. If you are near your output limit, close all
   open strings, arrays, and objects immediately and stop.
4. The JSON must be parseable by Python's json.loads() with zero post-processing.

Output format:
{"balanced": "...", "aggressive": "...", "top_1_percent": "..."}
"""
```

---

## FIX 3 — Smarter _parse_json with Recovery Attempt

In `base_agent.py` or `agents/rewriter.py`, add a truncation recovery step before
raising on parse failure:

```python
def _parse_json(self, raw: str) -> dict:
    # Strip fences
    cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    # Attempt 1: direct parse
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Attempt 2: truncation recovery — find last complete key-value pair and close the object
    try:
        # Find the last position of a complete "key": "value" pattern
        last_complete = cleaned.rfind('",')
        if last_complete > 0:
            truncated = cleaned[:last_complete + 1] + "}"
            return json.loads(truncated)
    except json.JSONDecodeError:
        pass

    # Attempt 3: extract any valid JSON object substring
    try:
        start = cleaned.index("{")
        end = cleaned.rindex("}") + 1
        return json.loads(cleaned[start:end])
    except (ValueError, json.JSONDecodeError):
        pass

    raise ValueError(f"{self.__class__.__name__}: JSON parse failed — {cleaned[:200]}")
```

---

## FIX 4 — Graceful Fallback So Pipeline Never Breaks

In `orchestrator.py`, the rewriter failure handling currently logs a warning and builds
"minimal sections from gaps" — make this explicit and complete so the Gap Closer tab
always has something to render:

```python
except Exception as e:
    logging.warning(f"Rewriter failed: {e}. Using gap-based fallback.")
    # Build fallback rewrites from gap data so downstream never gets None
    fallback_rewrites = {}
    for gap in gap_output.get("gaps", []):
        section = gap.get("section", "unknown")
        hint = gap.get("rewrite_hint", "Improve this section.")
        fallback_rewrites[section] = {
            "balanced": f"[Rewrite unavailable — {hint}]",
            "aggressive": f"[Rewrite unavailable — {hint}]",
            "top_1_percent": f"[Rewrite unavailable — {hint}]"
        }
    rewriter_output = {"rewrites": fallback_rewrites}
```

---

## VERIFICATION GATES

After applying fixes, run with a senior-level resume (6+ sections):

```bash
# Gate 1: No JSON parse warnings in logs
python main.py evaluate --resume tests/senior_resume.pdf --jd tests/sample_jd.txt --user-id test01 2>&1 | grep -i "json parse\|unterminated\|rewriter failed"
# Expected: no output (zero matches)

# Gate 2: All sections present in rewriter output
python -c "
from agents.rewriter import RewriterAgent
a = RewriterAgent()
out = a.run({'resume_text': open('tests/senior_resume.txt').read(), 'gaps': [
    {'section': 'summary', 'missing_keywords': ['distributed systems'], 'rewrite_hint': 'Add scale'},
    {'section': 'experience', 'missing_keywords': ['kafka', 'k8s'], 'rewrite_hint': 'Add infra depth'}
], 'style_fingerprint': ''})
assert 'summary' in out['rewrites']
assert 'experience' in out['rewrites']
assert out['rewrites']['summary']['balanced']
print('RewriterAgent OK — sections:', list(out['rewrites'].keys()))
"

# Gate 3: docx export is non-blank (>5KB)
python main.py close-gaps --resume tests/senior_resume.pdf --jd tests/sample_jd.txt --user-id test01 --no-interactive --output /tmp/test_output.docx
ls -lh /tmp/test_output.docx  # must be >5KB
```

---

## FILES TO CHANGE
- `agents/rewriter.py` — section-by-section loop + compact system prompt
- `base_agent.py` — hardened _parse_json with truncation recovery
- `orchestrator.py` — explicit fallback dict so downstream never gets None

Do NOT change any other agent. Do NOT change model assignments.Do not use line_start or line_end for edits. Use the edit tool with old_string (the exact text to replace) and new_string (the replacement text) as required by the schema.