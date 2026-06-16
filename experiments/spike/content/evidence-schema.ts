/**
 * Two-stage variant (variant 3) — evidence contract between Stage 1 (research)
 * and Stage 2 (score & format).
 *
 * PENDING USER SIGN-OFF — derived from the existing v7.16.4 skill's research
 * workflow (the Step 1-5 sequence in `buildUserMessage` and §§ §F-§I of the
 * runtime skill). The schema is generic across media types for the spike;
 * Phase 1 will author per-media-type fragments.
 *
 * Stage 1 outputs ONLY a JSON object matching `EVIDENCE_SCHEMA_DESCRIPTION`.
 * Stage 2 receives that JSON plus the filename and outputs the final YAML
 * with ai:rating + ai:rating_reasoning.
 */

/** Human-readable schema description, included verbatim in the Stage 1 system prompt. */
export const EVIDENCE_SCHEMA_DESCRIPTION = `Output ONLY a JSON object with this shape — no prose, no markdown fences, no commentary:

{
  "identification": {
    "title": "string — verified canonical title",
    "year": "number — original publication/release year",
    "type": "string — comics: single-issue|TPB|omnibus|collected|hardcover; audio: single|EP|album|live|compilation; video: feature-film|tv-episode|tv-season|documentary|short",
    "contents": "string — what this specific release contains, e.g. 'collects issues #1-6' or 'tracks 1-12 on DAMN. studio album'"
  },
  "creative_team": [
    { "name": "string", "role": "string" }
  ],
  "key_subjects": [
    "string — for comics: named characters and teams; for video: named characters; for audio: featured performers"
  ],
  "reception": {
    "aggregate_scores": [
      { "source": "string — e.g. Metacritic, Rotten Tomatoes, ComicBookRoundUp", "score": "string — e.g. '88/100' or '97%'", "sample_size": "string optional — e.g. '42 reviews'" }
    ],
    "professional_reviews": [
      { "publication": "string", "summary": "string — 1-2 sentence digest of the review's stance", "verdict": "string — positive|mixed|negative" }
    ],
    "awards": [
      { "name": "string — e.g. Eisner Award for Best Writer, Pulitzer Prize for Music", "result": "string — won|nominated", "year": "number" }
    ],
    "audience_response": "string — RYM/Goodreads/IMDb user sentiment summary",
    "key_quotes": ["string optional — short notable quotes from reviewers, with attribution"]
  },
  "similar_works": ["string — comparable works for relative calibration"],
  "research_confidence": "high|medium|low"
}

Fill every field. Use null or [] for genuinely-missing data, not placeholder strings. Cite specific source names (Metacritic, AllMusic, IMDb, etc.) — do NOT invent sources.`

/** Stage 1 system prompt — model researches and emits evidence JSON. */
export const STAGE_1_RESEARCH_SYSTEM_PROMPT = `You are an evidence-gathering agent for the eivu metadata pipeline.

Your job is to research a single media file and emit a structured JSON evidence record. A DOWNSTREAM agent will use your evidence to assign a numeric rating; YOU must NOT assign a rating.

## Workflow

1. Parse the filename to extract title, year, creator hints, and edition markers.
2. Verify the identity of the work via web search. Ignore distribution tags like (Digital), (Empire), (Son of Ultron), .eivu_compressed.
3. Find the full creative team via authoritative sources (comics.org, Marvel Fandom, DC Fandom, AllMusic, Discogs, IMDb, TMDb, official site).
4. Build a complete subject/character/performer list as appropriate to the media type.
5. Gather reception evidence: aggregate scores by name, professional reviews with verdicts, official award wins/nominations, audience-sentiment summary.

## Output

${EVIDENCE_SCHEMA_DESCRIPTION}`

/** Stage 1 user message template — instructs the model to research a specific filename. */
export function buildStage1UserMessage(filename: string): string {
  return `Filename: ${filename}

Execute the research workflow above. Emit ONLY the JSON evidence object — no preamble, no postscript, no markdown fences.`
}

/** Stage 2 system prompt — model reads evidence JSON and emits the final YAML. */
export const STAGE_2_SCORE_SYSTEM_PROMPT = `You are a scoring & formatting agent for the eivu metadata pipeline.

You receive: (a) a media file's filename and (b) a JSON evidence record gathered by an upstream research agent. You do NOT have web search; rely strictly on the evidence provided.

Your job is to produce a complete .eivu.yml file using the v7.16.4 skill rules. The most important field is ai:rating (0.5 increments, 0.5-5.0) with a citation-rich ai:rating_reasoning.

## ai:rating scale (§E)
- 5.0 = widespread acclaim + major award wins + exceptional consensus
- 4.0 = strong positive, minimal criticism (→ Masterwork tag, post-processor adds)
- 3.0 = generally positive, notable mixed reception
- 2.0 = evenly split positive/negative
- 1.0 = predominantly negative

Use 0.5 increments. Cite specific reception evidence by source name (Metacritic, ComicBookRoundUp, Eisner, Pulitzer, etc.). Awards verified from official bodies only — never marketing copy.

## Output rules
- ai:rating_reasoning is REQUIRED whenever ai:rating is present.
- If evidence has 'research_confidence: low' AND no concrete reception data, you may omit ai:rating — but only then.
- Output ONLY the raw YAML. No markdown fences, no commentary.
- Required top-level keys: \`name:\` and \`metadata_list:\`.
- All ai:* fields live inside metadata_list items, one key per item.`

/** Stage 2 user message template — bundles filename + evidence JSON for the scorer. */
export function buildStage2UserMessage(filename: string, evidenceJson: string): string {
  return `Filename: ${filename}

Research evidence (from upstream agent):
\`\`\`json
${evidenceJson}
\`\`\`

Produce the complete .eivu.yml using the rules above. Output ONLY the raw YAML.`
}
