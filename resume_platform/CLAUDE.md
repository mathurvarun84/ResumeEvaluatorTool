# Resume Intelligence Platform V2 — CLAUDE.md

> Read this file at the start of every session before writing any code.
> This is the single source of truth for architecture, conventions, and rules.

---

## Project identity

**Name:** Resume Intelligence Platform V2 (RIP V2)
**Owner:** Varun Mathur (@mathurvarun84) — Zenteiq Aitech Innovations, Bengaluru
**Purpose:** A multi-agent AI career co-pilot for Indian software engineers. Evaluates, benchmarks, rewrites, and iteratively improves resumes against job descriptions.
**Target users:** Software engineers aged 22–40 in India (Bengaluru, Hyderabad, Pune, NCR), experience levels: fresher to senior IC / staff.

---

## Stack

| Layer | Technology |
|---|---|
| Language | Python 3.9+ |
| LLM API (Agents 1–4, Orchestrator) | OpenAI GPT (via `openai` SDK) |
| LLM API (Agent 5 — Recruiter Sim) | Anthropic Claude (via `anthropic` SDK) |
| Data validation & schemas | **Pydantic v2** (`pydantic>=2.0`) |
| CLI framework | Typer |
| Terminal UI | Rich |
| Web UI | Streamlit |
| Document export | python-docx |
| PDF parsing | pdfplumber |
| Environment | python-dotenv |
| Charts | plotly |

---

## Folder structure

```
resume_platform/
├── CLAUDE.md                        � this file
├── main.py                          � CLI entry point (5 commands)
├── orchestrator.py                  � sequences agents, manages parallelism
├── renderer.py                      � rich terminal rendering for all commands
├── parser.py                        � PDF / DOCX / TXT → clean text
├── gap_session.py                   � interactive diff session + .docx export
├── app.py                           � Streamlit web UI (5 tabs)
├── requirements.txt
├── .env.example
├── README.md
├── schemas/
│   ├── __init__.py
│   ├── agent1_schema.py             � Pydantic models for Agent 1 I/O
│   ├── agent2_schema.py             � Pydantic models for Agent 2 I/O
│   ├── agent3_schema.py             � Pydantic models for Agent 3 I/O
│   ├── agent4_schema.py             � Pydantic models for Agent 4 I/O
│   ├── agent5_schema.py             � Pydantic models for Agent 5 I/O
│   └── common.py                    � Shared enums and base types (Seniority, CompanyType, etc.)
├── agents/
│   ├── __init__.py
│   ├── base_agent.py                � abstract BaseAgent class
│   ├── resume_understanding.py      � Agent 1
│   ├── jd_intelligence.py           � Agent 2
│   ├── gap_analyzer.py              � Agent 3
│   ├── rewriter.py                  � Agent 4
│   └── recruiter_sim.py             � Agent 5
├── engine/
│   ├── __init__.py
│   ├── ats_scorer.py                � deterministic ATS scoring (NO LLM)
│   └── percentile.py                � market percentile calculation
├── memory/
│   ├── __init__.py
│   ├── session_store.py             � per-user JSON load/save/update
│   └── style_extractor.py           � session history → style fingerprint
└── data/
    └── benchmarks.json              � static percentile distributions by seniority
```

---

## Model assignments

| Component | Provider | Model | max_tokens |
|---|---|---|---|
| Agent 1 — Resume Understanding | OpenAI | `gpt-4o-mini` | 4000 |
| Agent 2 — JD Intelligence | OpenAI | `gpt-4o-mini` | 4000 |
| Agent 3 — Gap Analyzer | OpenAI | `gpt-4o-mini` | 4000 |
| Agent 4 — Rewrite Agent | Anthropic | `claude-haiku-4-5-20251001` | 6000 |
| Agent 5 — Recruiter Simulator | Anthropic | `claude-haiku-4-5-202510012` | 4000 |
| Orchestrator (direct calls, if any) | OpenAI | `gpt-4o-mini` | 4000 |

**Never use a model not listed above. Never hardcode a model string anywhere other than the agent's `__init__`.**

### API key rules — two providers

```
OPENAI_API_KEY=your_openai_key_here       � used by Agents 1–4 and Orchestrator
ANTHROPIC_API_KEY=your_anthropic_key_here � used by Agent 5 only
```

Both keys loaded from `.env` via `python-dotenv`. Never hardcode either key.

---

## Pydantic schema conventions (CRITICAL — enforce across all agents)

All agent inputs and outputs **must** be defined as Pydantic v2 models in `schemas/`. Raw dicts are only used at the LLM boundary (parsing JSON from LLM response). The moment data enters Python logic, it must be a validated Pydantic model.

### Shared enums — `schemas/common.py`

```python
from pydantic import BaseModel
from enum import Enum

class Seniority(str, Enum):
    """Canonical seniority levels used across all agents and benchmarks."""
    JUNIOR = "junior"   # 0–2 years professional experience
    MID = "mid"         # 3–5 years
    SENIOR = "senior"   # 6–10 years
    STAFF = "staff"     # 11+ years OR explicit Staff/Principal/Director title

class CompanyType(str, Enum):
    """Canonical company categories for Indian tech market JD classification."""
    FAANG = "faang"
    PRODUCT_UNICORN = "product-unicorn"
    FUNDED_STARTUP = "funded-startup"
    ENTERPRISE = "enterprise"
    SERVICE_BASED = "service-based"
    UNKNOWN = "unknown"

class RewriteStyle(str, Enum):
    """Rewrite tone styles available from Agent 4."""
    BALANCED = "balanced"
    AGGRESSIVE = "aggressive"
    TOP_1_PERCENT = "top_1_percent"
```

### Agent 1 schema — `schemas/agent1_schema.py`

```python
from pydantic import BaseModel, Field
from schemas.common import Seniority
from typing import List

class ResumeUnderstandingInput(BaseModel):
    """Input contract for Agent 1. resume_text must be pre-cleaned by parser.py."""
    resume_text: str = Field(..., description="Raw text extracted from resume by parser.py")
    user_id: str = Field(..., description="Unique identifier for session memory tracking")

class ResumeUnderstandingOutput(BaseModel):
    """
    Structured representation of a parsed resume.
    All fields are required — Agent 1 must populate every key.
    Downstream agents (Gap Analyzer, Rewriter) depend on this schema.
    """
    experience_years: int = Field(..., ge=0, description="Total professional experience excluding internships")
    seniority: Seniority = Field(..., description="Inferred from both YoE AND title")
    tech_stack: List[str] = Field(..., description="Languages, frameworks, databases, cloud platforms only")
    domains: List[str] = Field(..., description="Business domains e.g. fintech, supply chain, e-commerce")
    has_metrics: bool = Field(..., description="True if resume has at least one quantified impact")
    has_summary: bool = Field(..., description="True if resume has a summary or objective section at top")
    sections_present: List[str] = Field(..., description="Canonical section names found in resume")
```

### Agent 2 schema — `schemas/agent2_schema.py`

```python
from pydantic import BaseModel, Field
from schemas.common import Seniority, CompanyType
from typing import List, Dict

class HiddenSignal(BaseModel):
    """A single implicit signal extracted from JD language."""
    signal: str = Field(..., description="The phrase or pattern found in JD")
    implication: str = Field(..., description="What it means for the candidate e.g. 'no PM, high ownership'")

class JDIntelligenceInput(BaseModel):
    """Input contract for Agent 2."""
    jd_text: str = Field(..., description="Raw job description text pasted by user")

class JDIntelligenceOutput(BaseModel):
    """
    Structured representation of a parsed job description.
    semantic_skill_map direction: JD term → list of resume equivalents.
    hidden_signals captures non-obvious hiring intent beyond stated requirements.
    """
    role_title: str = Field(..., description="Exact title as written in JD")
    must_have_skills: List[str] = Field(..., description="Dealbreaker requirements if missing")
    nice_to_have_skills: List[str] = Field(..., description="Preferred but not blocking skills")
    hidden_signals: List[HiddenSignal] = Field(..., description="Implicit signals in JD language")
    semantic_skill_map: Dict[str, List[str]] = Field(
        ...,
        description="Maps JD skill/phrase → resume terms candidate might use. E.g. {'event streaming': ['Kafka', 'Pulsar']}"
    )
    seniority_expected: Seniority = Field(..., description="Inferred from responsibilities, not just title")
    company_type: CompanyType = Field(..., description="Canonical company category")
```

### Agent 3 schema — `schemas/agent3_schema.py`

```python
from pydantic import BaseModel, Field
from typing import List

class SectionGap(BaseModel):
    """Gap between resume section content and JD expectations for that section."""
    section: str = Field(..., description="Resume section name e.g. 'experience', 'skills'")
    missing_keywords: List[str] = Field(..., description="Keywords present in JD but absent in resume")
    rewrite_hint: str = Field(..., description="One-sentence instruction for Agent 4 rewriter")

class GapAnalyzerInput(BaseModel):
    """Input contract for Agent 3. Both upstream agent outputs are required."""
    resume_analysis: dict = Field(..., description="Validated ResumeUnderstandingOutput as dict")
    jd_analysis: dict = Field(..., description="Validated JDIntelligenceOutput as dict")

class GapAnalyzerOutput(BaseModel):
    """
    Diff between resume and JD used to drive Agent 4 rewriting and gap_session.py.
    jd_match_score feeds the composite score formula alongside ats_score.
    """
    jd_match_score: int = Field(..., ge=0, le=100, description="0–100 match score against JD")
    gaps: List[SectionGap] = Field(..., description="Per-section gap list ordered by priority")
    missing_keywords: List[str] = Field(..., description="Flat deduplicated list of all missing keywords")
    priority_fixes: List[str] = Field(..., description="Top 3 highest-impact actions to improve match score")
```

### Agent 4 schema — `schemas/agent4_schema.py`

```python
from pydantic import BaseModel, Field
from schemas.common import RewriteStyle
from typing import Dict

class SectionRewrite(BaseModel):
    """Three-style rewrite for a single resume section."""
    balanced: str = Field(..., description="Honest, strong, suitable for most applications")
    aggressive: str = Field(..., description="Maximum keyword density, impact-first framing")
    top_1_percent: str = Field(..., description="Tier-1 company framing, best-in-class language")

class RewriterInput(BaseModel):
    """Input contract for Agent 4."""
    resume_text: str = Field(..., description="Original resume text")
    gaps: list = Field(..., description="List of SectionGap dicts from Agent 3")
    style_fingerprint: str = Field("", description="Max 200 token style fingerprint from memory")

class RewriterOutput(BaseModel):
    """
    All three rewrite styles for each resume section.
    gap_session.py and Streamlit Tab 3 let the user select style per section.
    Anti-hallucination rules are enforced at prompt level — validate no invented companies/metrics.
    """
    rewrites: Dict[str, SectionRewrite] = Field(
        ...,
        description="Keys are section names. Values are three-style rewrites."
    )
```

### Agent 5 schema — `schemas/agent5_schema.py`

```python
from pydantic import BaseModel, Field
from typing import List

class PersonaVerdict(BaseModel):
    """Shortlist decision and reasoning from a single recruiter persona."""
    persona: str = Field(..., description="Persona name e.g. 'FAANG Technical Screener'")
    first_impression: str = Field(..., description="First reaction to resume in 1–2 sentences")
    noticed: List[str] = Field(..., description="Positive signals the persona picked up")
    ignored: List[str] = Field(..., description="Resume content this persona ignored or discounted")
    rejection_reason: str = Field(..., description="Primary reason for rejection if applicable; empty string if shortlisted")
    shortlist_decision: bool = Field(..., description="True if this persona would shortlist the candidate")

class RecruiterSimOutput(BaseModel):
    """
    Aggregate recruiter simulation across all 10 personas.
    shortlist_rate is the primary signal shown in Streamlit Tab 2.
    most_critical_fix drives the top recommendation card.
    """
    personas: List[PersonaVerdict] = Field(..., min_length=10, max_length=10)
    shortlist_rate: float = Field(..., ge=0.0, le=1.0, description="Fraction of personas who would shortlist")
    consensus_strengths: List[str] = Field(..., description="Signals praised by 3+ personas")
    consensus_weaknesses: List[str] = Field(..., description="Issues flagged by 3+ personas")
    most_critical_fix: str = Field(..., description="Single highest-priority improvement across all personas")
```

### How to use schemas in agent code

```python
from schemas.agent1_schema import ResumeUnderstandingInput, ResumeUnderstandingOutput

class ResumeUnderstandingAgent(BaseAgent):
    def run(self, input_dict: dict) -> dict:
        """
        Parses a resume into structured data for downstream agents.

        Validates input against ResumeUnderstandingInput, calls LLM,
        parses JSON response, validates output against ResumeUnderstandingOutput,
        and returns the model as a dict.

        Args:
            input_dict: Must contain 'resume_text' (str) and 'user_id' (str).

        Returns:
            Validated ResumeUnderstandingOutput serialized as dict.

        Raises:
            ValidationError: If input_dict is missing required fields.
            ValueError: If LLM response fails JSON parsing after 1 retry.
        """
        # Validate input — raises pydantic.ValidationError on bad input
        inp = ResumeUnderstandingInput(**input_dict)

        raw = self._call_llm(SYSTEM_PROMPT, inp.resume_text)
        parsed = self._parse_json(raw)

        # Validate and coerce output — raises pydantic.ValidationError on bad LLM output
        output = ResumeUnderstandingOutput(**parsed)
        return output.model_dump()
```

**Rules:**
- Always instantiate the input model at the top of `run()` before any logic
- Always instantiate the output model from LLM-parsed dict before returning
- Use `.model_dump()` when passing between agents (dicts cross agent boundaries)
- Use the model directly (not dict) for any internal logic within the agent

---

## Docstring and comment conventions (CRITICAL — enforce in every file)

Every function, method, and class in the codebase must have a docstring. No exceptions.

### Docstring format — Google style

```python
def calculate_percentile(composite_score: float, seniority: str) -> dict:
    """
    Calculates market percentile for a candidate based on composite score and seniority band.

    Uses static benchmark distributions from data/benchmarks.json.
    No LLM calls — fully deterministic.

    Args:
        composite_score: Weighted score = (ats_score × 0.4) + (jd_match_score × 0.6). Range 0–100.
        seniority: One of 'junior', 'mid', 'senior', 'staff'. Must match benchmarks.json keys.

    Returns:
        dict with keys:
            - percentile (int): 0–100 market rank
            - benchmark_avg (int): Average score for this seniority band
            - label (str): Human-readable label e.g. 'Top 25%'

    Raises:
        KeyError: If seniority string does not match any key in benchmarks.json.
        ValueError: If composite_score is outside 0–100 range.
    """
```

### Inline comment rules

- Add a comment on any line that is not obviously self-explanatory
- Explain **why**, not just **what** — the code shows what, the comment shows intent
- Always comment LLM call parameters (why this max_tokens, why this temperature)
- Always comment regex patterns
- Always comment any magic numbers or thresholds

```python
# Composite score weights: ATS is hygiene (40%), JD match is signal (60%)
composite = (ats_score * 0.4) + (jd_match_score * 0.6)

# Cap style fingerprint at 900 chars to stay within 200-token budget
fingerprint = raw_fingerprint[:900]

# 1 retry on JSON failure — enough to handle transient formatting issues without hammering the API
for attempt in range(2):
    ...
```

### Class docstrings

Every class must document its responsibility and any key invariants:

```python
class GapAnalyzerAgent(BaseAgent):
    """
    Agent 3 — Gap Analyzer.

    Compares structured resume data (from Agent 1) against JD intelligence
    (from Agent 2) to produce a prioritized gap list for Agent 4 (Rewriter).

    Runs sequentially after Agents 1 and 2. Cannot run without both upstream outputs.
    Uses gpt-4o-mini via OpenAI SDK. Returns GapAnalyzerOutput as dict.

    Invariants:
        - Input must contain validated Agent 1 and Agent 2 output dicts
        - jd_match_score must be 0–100 (enforced by Pydantic)
        - gaps list is ordered by priority (highest-impact first)
    """
```

---

## Architecture rules

### Agent contract (non-negotiable)

Every agent must implement this interface exactly:

```python
class SomeAgent(BaseAgent):
    def run(self, input_dict: dict) -> dict:
        """
        Entry point for this agent.

        Args:
            input_dict: Raw dict. Must conform to this agent's Input schema.

        Returns:
            Validated output dict conforming to this agent's Output schema.
        """
        ...
    # validate_output and _call_llm are inherited from BaseAgent
```

- Input: a plain `dict`
- Output: a plain `dict` validated through the agent's Pydantic Output model
- Agents **never import each other**
- Agents **never call the Orchestrator**
- The Orchestrator is the only component allowed to instantiate and call agents

### Orchestrator execution order

```
Step 1  ATS scoring              deterministic, always first, no LLM cost
Step 2  Agent 1 + Agent 2        parallel (ThreadPoolExecutor, max_workers=2), only if JD provided
Step 3  Agent 3 (Gap Analyzer)   sequential — depends on Step 2 outputs
Step 4  Memory load + fingerprint
Step 5  Agent 4 + Agent 5        can run in parallel if both requested
Step 6  Market percentile        deterministic
Step 7  Memory update
Step 8  Return combined dict
```

### Graceful degradation

| Failure | Behaviour |
|---|---|
| Agent 5 fails | Log warning, continue without simulation results |
| Agent 4 fails | Log warning, continue without rewrites |
| Memory load fails | Continue with empty fingerprint, log warning |
| Percentile calc fails | Return `percentile: null`, do not crash |
| Agent 1 or 2 fails | **Raise** — pipeline cannot continue without these |

---

## Anti-hallucination rules (CRITICAL — enforce in every rewrite prompt)

The Rewrite Agent (Agent 4) must follow these rules in its system prompt, and must be verified in tests:

1. **Never invent companies.** If a company name is not in the original resume, it cannot appear in the rewrite.
2. **Never invent degrees or institutions.** Only degrees present in the original resume may appear.
3. **Never invent years of experience.** Do not change the candidate's tenure at any role.
4. **Never invent specific metrics.** If the original resume has no latency figure, the rewrite must not introduce one. Use placeholders: `[X%]`, `[N users]`, `[Xms]`, `[₹X Cr ARR]`.
5. **Never invent project names.** Only projects present in the original resume may appear.

Violation of any of these rules is a product defect, not a style choice.

---

## Token budget rules

| Rule | Limit |
|---|---|
| Style fingerprint (memory/style_extractor.py) | Hard cap at **200 tokens** — enforce by truncating output to 900 characters |
| Rewrite Agent max_tokens | **6000** — set in agent `__init__`, never override |
| All other agents max_tokens | **4000** |
| ATS Scoring Engine | **0 LLM tokens** — fully deterministic Python |
| Full evaluation wall time target | < 40 seconds without simulation |

---

## API key rules

- Load both `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` from `.env` using `python-dotenv` at startup
- **Never hardcode** either key anywhere in source code
- **Never log** either key
- **Never transmit** resume data to any service other than OpenAI API (Agents 1–4) or Anthropic API (Agent 5)
- `.env` is in `.gitignore` — never commit it

---

## BaseAgent contract (reference implementation shape)

Agents 1–4 and Orchestrator use the OpenAI SDK. Agent 5 uses the Anthropic SDK.
`BaseAgent` is the shared abstract class — each agent passes its `provider` so `_call_llm` routes correctly.

```python
class BaseAgent(ABC):
    """
    Abstract base class for all RIP V2 agents.

    Provides shared LLM calling, JSON parsing, and output validation.
    Subclasses must implement run() and define their own Pydantic Input/Output schemas.

    Args:
        model: LLM model string. Must match model assignments table in CLAUDE.md.
        max_tokens: Maximum tokens for LLM response. Per-agent limits in CLAUDE.md.
        provider: 'openai' for Agents 1–4, 'anthropic' for Agent 5 only.
    """

    def __init__(self, model: str, max_tokens: int, provider: str = "openai"):
        self.model = model
        self.max_tokens = max_tokens
        self.provider = provider  # Routes _call_llm to correct SDK

    @abstractmethod
    def run(self, input_dict: dict) -> dict:
        """Entry point. Input and output must conform to this agent's Pydantic schemas."""
        pass

    def _call_llm(self, system_prompt: str, user_message: str) -> str:
        """
        Calls the appropriate LLM provider based on self.provider.

        Includes 1 automatic retry on JSON parse failure.
        Never raises on first failure — retries once before propagating.

        Args:
            system_prompt: Agent-specific system instruction.
            user_message: Resume text, JD text, or structured context as string.

        Returns:
            Raw string response from the LLM (JSON string for structured agents).

        Raises:
            ValueError: If JSON parsing fails on both initial attempt and retry.
        """
        if self.provider == "openai":
            # response_format enforces JSON mode — eliminates fence-stripping for GPT responses
            ...
        elif self.provider == "anthropic":
            ...

    def _parse_json(self, raw: str) -> dict:
        """
        Strips markdown fences and parses JSON string to dict.

        Args:
            raw: Raw LLM response string, possibly wrapped in ```json fences.

        Returns:
            Parsed dict ready for Pydantic model instantiation.

        Raises:
            ValueError: Includes agent class name in message for easy debugging.
        """
        ...

    def validate_output(self, output: dict, required_keys: list[str]) -> None:
        """
        Legacy key-presence check. Prefer Pydantic model instantiation over this method.
        Kept for backward compatibility during migration.

        Args:
            output: Dict to validate.
            required_keys: Keys that must be present.

        Raises:
            ValueError: Lists all missing keys with agent class name.
        """
        missing = [k for k in required_keys if k not in output]
        if missing:
            raise ValueError(f"{self.__class__.__name__}: missing output keys {missing}")
```

### OpenAI call pattern (Agents 1–4)

```python
from openai import OpenAI
client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
response = client.chat.completions.create(
    model=self.model,          # "gpt-4o-mini"
    max_tokens=self.max_tokens,
    messages=[
        {"role": "system", "content": system_prompt},
        {"role": "user",   "content": user_message}
    ],
    response_format={"type": "json_object"}  # enforce JSON mode — eliminates parse failures
)
return response.choices[0].message.content
```

### Anthropic call pattern (Agent 5 only)

```python
from anthropic import Anthropic
client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
response = client.messages.create(
    model=self.model,          # "claude-opus-4-5"
    max_tokens=self.max_tokens,
    system=system_prompt,
    messages=[{"role": "user", "content": user_message}]
)
return response.content[0].text
```

---

## CLI commands

| Command | Key options |
|---|---|
| `evaluate` | `--resume`, `--jd`, `--user-id`, `--simulate`, `--no-rewrite`, `--output`, `--format` |
| `close-gaps` | `--resume`, `--jd`, `--user-id`, `--style`, `--output`, `--no-interactive` |
| `simulate` | `--resume`, `--user-id` |
| `history` | `--user-id` |
| `agent` | `--name`, `--input`, `--output` |

Every command must have a `--help` that shows all options with descriptions.

---

## Streamlit UI — 5 tabs

| Tab | Key feature |
|---|---|
| 1 — Evaluate | Upload resume + paste JD + simulate toggle. Metrics: ATS score, shortlist scores, market percentile. |
| 2 — Recruiter Sim | 10 persona cards in 2-col grid. Aggregate shortlist rate. Most critical fix. |
| 3 — Gap Closer | Per-section accept/keep radio. Keyword pills. Generate + download .docx. |
| 4 — Agent Explorer | Select agent, paste JSON input, run, see output + schema compliance. |
| 5 — My Progress | Session history table. ATS + match score trend charts (plotly). Style fingerprint card. |

---

## Gap session rules (gap_session.py)

- Display diff using `rich.table.Table` — ORIGINAL column (red header) vs REWRITTEN column (green header)
- Accept/Reject/Edit prompt: `[A]ccept / [R]eject / [E]dit this section?`
- Edit flow: write to `tempfile` → open `$EDITOR` → fallback to `nano` → fallback to `vi` → on all failures, default to accept with warning
- `.docx` export structure: name (H1, 16pt, centered) → contact line (normal, centered) → HR → sections (H2, teal `#008080`, 13pt, bold, all caps) → content
- Never crash on empty section — skip gracefully
- Return dict: `{ decisions, output_path, sections_accepted, sections_rejected }`

---

## .docx export styling (python-docx)

| Element | Style |
|---|---|
| Candidate name | Heading 1, bold, 16pt, centered |
| Contact line | Normal, centered |
| Section heading | Heading 2, color RGB(0,128,128), 13pt, bold, ALL CAPS |
| Bullet lines (start with `-` or `•`) | List Bullet style |
| Other lines | Normal paragraph |

---

## Memory schema

```json
{
  "user_id": "string",
  "created_at": "ISO timestamp",
  "runs": [
    {
      "timestamp": "ISO timestamp",
      "ats_score": 0,
      "match_score": 0,
      "accepted_sections": [],
      "rejected_sections": []
    }
  ],
  "style_decisions": {
    "accepted": [],
    "rejected": []
  }
}
```

- Max 50 runs kept (drop oldest when limit reached)
- `memory/users/` directory auto-created on first write
- Load returns empty scaffold if file missing — never raises on missing file

---

## Benchmarks schema (data/benchmarks.json)

```json
{
  "junior":  { "avg": 48, "p25": 38, "p50": 48, "p75": 60, "p90": 72 },
  "mid":     { "avg": 55, "p25": 45, "p50": 55, "p75": 67, "p90": 78 },
  "senior":  { "avg": 63, "p25": 52, "p50": 63, "p75": 74, "p90": 83 },
  "staff":   { "avg": 70, "p25": 60, "p50": 70, "p75": 80, "p90": 88 }
}
```

Composite score = `(ats_score × 0.4) + (jd_match_score × 0.6)`

---

## ATS scoring logic (engine/ats_scorer.py) — no LLM

| Sub-score | Method | Max |
|---|---|---|
| `keyword_match` | Count action verbs (led, built, designed, reduced, increased, owned, shipped, scaled) + tech keywords; normalize | 25 |
| `formatting` | Check section headers present, consistent bullets, length 1–2 pages, no tables | 25 |
| `readability` | Average sentence length + Flesch-Kincaid approximation | 25 |
| `impact_metrics` | Regex scan for numbers, %, $, ₹, latency terms, scale terms | 25 |

Total: 0–100. Returned as `{ score, breakdown, ats_issues }`.

---

## Rewrite styles (Agent 4)

| Style | Description |
|---|---|
| `balanced` | Honest, strong, suitable for most applications |
| `aggressive` | Maximum keyword density, impact-first framing |
| `top_1_percent` | Frames experience as if applying to a tier-1 company in a best-in-class role |

All three styles are returned in every rewrite call. The gap session and Streamlit UI let the user select which style to use per section.

---

## Recruiter personas (Agent 5)

Agent 5 simulates all 10 personas in a single LLM call:

1. FAANG Technical Screener — system design signals, scale numbers
2. Startup Hiring Manager — ownership language, breadth
3. Fintech Risk-Aware Recruiter — compliance/security signals
4. Product Company PM-adjacent Recruiter — customer impact framing
5. High-Volume Agency Recruiter — keyword density, ATS-friendliness
6. Senior IC Evaluator — technical depth, architecture ownership
7. Diversity-Focused Recruiter — growth trajectory, potential signals
8. Campus/Entry-Level Recruiter — projects, freshness of stack
9. Remote-First Company Recruiter — async communication, self-direction
10. Legacy Enterprise Recruiter — certifications, stability, tenure

Each persona returns: `PersonaVerdict` (see `schemas/agent5_schema.py`)
Aggregate: `shortlist_rate`, `consensus_strengths`, `consensus_weaknesses`, `most_critical_fix`

---

## Error handling standards

- All LLM calls wrapped in `try/except` with **1 automatic retry** on JSON parse failure
- All file I/O wrapped in `try/except` with descriptive error messages
- All API calls: never expose raw exception tracebacks to the user — catch, log, print friendly message
- Pydantic `ValidationError` is the primary validation signal — catch it at agent boundaries and re-raise as `ValueError` with agent name
- CLI commands: use `typer.echo()` for user-facing errors, `raise typer.Exit(code=1)` on fatal errors

---

## Testing gates (run before proceeding to next phase)

Each phase has a verification command. **Do not proceed to the next phase if the gate fails.**

```bash
# Phase 1 gate
python -c "from engine.ats_scorer import score_resume; from engine.percentile import get_percentile; from agents.base_agent import BaseAgent; from parser import parse_resume; print('Foundation OK')"

# Phase 2 gate
python -c "from agents.resume_understanding import ResumeUnderstandingAgent; from agents.jd_intelligence import JDIntelligenceAgent; print('Agents 1+2 importable')"

# Phase 3 gate
python -c "from agents.gap_analyzer import GapAnalyzerAgent; from agents.rewriter import RewriterAgent; print('Agents 3+4 importable')"

# Phase 4 gate
python -c "from agents.recruiter_sim import RecruiterSimulatorAgent; from memory.session_store import load_session; from memory.style_extractor import extract_fingerprint; print('Agent 5 + Memory importable')"

# Phase 5 gate
python -c "from orchestrator import Orchestrator; print('Orchestrator importable')"

# Phase 6 gate
python -c "from gap_session import run_gap_session; print('Gap session importable')"

# Phase 7 gate
python main.py --help

# Phase 8 gate
streamlit run app.py --server.headless true &

# Schema gate (run after any schema change)
python -c "from schemas.common import Seniority, CompanyType, RewriteStyle; from schemas.agent1_schema import ResumeUnderstandingInput, ResumeUnderstandingOutput; from schemas.agent2_schema import JDIntelligenceInput, JDIntelligenceOutput; from schemas.agent3_schema import GapAnalyzerInput, GapAnalyzerOutput; from schemas.agent4_schema import RewriterInput, RewriterOutput; from schemas.agent5_schema import RecruiterSimOutput; print('All schemas importable')"
```

---

## What NOT to do

- Do not use the Anthropic SDK in Agents 1–4 or the Orchestrator — those use OpenAI only
- Do not use the OpenAI SDK in Agent 5 — that uses Anthropic only
- Do not add a `requirements.txt` entry that is not in the approved stack above
- Do not add a sixth agent without updating this file and the orchestrator
- Do not call any LLM from `engine/ats_scorer.py` or `engine/percentile.py` — these are deterministic Python
- Do not store either API key in any file other than `.env`
- Do not add `streamlit` imports to `main.py` or agent files
- Do not use `asyncio` — use `concurrent.futures.ThreadPoolExecutor` for parallelism
- Do not use `print()` for user-facing output in CLI — use `rich.console.Console`
- Do not exceed 50 stored runs per user in memory
- Do not omit `response_format={"type": "json_object"}` from OpenAI calls — it eliminates JSON parse failures
- Do not pass raw dicts between internal Python logic — use `.model_dump()` only at agent boundaries
- Do not write a function longer than 40 lines without a docstring
- Do not use magic numbers without an inline comment explaining the value

---

*RIP V2 | Zenteiq Aitech Innovations | Bengaluru | April 2026*

## Session: Merged Fix Set — Resume Preservation + SSE + Positioning

### Phase 1 — Foundation
- parser.py: _clean_text() 6-pass (hyphen-rejoin, comma, colon, camelCase, blanks)
- rewriter.py: COMPANY_HEADER_START/ROLE/END_HEADER markers, _ensure_experience_markers(),
  _rewrite_with_sub_changes() injects markers for experience entries,
  _resolve_sub_text() 4-level fallback, second-pass section preservation in run()
- engine/resume_builder.py: build_final_docx() fully replaced — structure-aware,
  _write_experience() handles markers+heuristic, placeholder guard everywhere
- gap_session.py: section writer delegates to resume_builder

### Phase 2 — Pipeline
- resume_understanding.py: sections key added to system prompt, max_tokens=6000,
  resume_sections extracted and returned in output dict
- sectioner_agent.py: DEPRECATED — not called by orchestrator
- orchestrator.py: sectioner removed, resume_sections from A1 output,
  progress_cb parameter with 6 call points, career_positioning called,
  positioning in return dict

### Phase 3 — API + Frontend
- data/ctc_bands.json: static CTC bands (seniority × company_tier)
- engine/career_positioning.py: get_positioning_statement() — no LLM
- backend/main.py: POST /api/analyze, GET /api/stream/{id} SSE,
  GET /api/result/{id}, POST /api/gap-close, GET /api/download/{id}
- frontend: AnalysisProgress.jsx (SSE+fallback), VerdictBanner.jsx,
  CareerPositioning.jsx, UploadZone.jsx (wired), App.jsx (auto-navigate)

### Key invariants
- ALL sections from original resume preserved in output docx
- Experience: every company BOLD, role italic, bullets ListBullet
- Unchanged sections/companies: verbatim, never placeholder
- Placeholder guard: [.*] pattern never written to docx
- LLM calls per run: 4 (was 5) — sectioner eliminated
- Latency: ~14-18s (was 18-22s)

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
