/**
 * Structured-output tool definition for variant 5.
 *
 * The model is given both `web_search` and `submit_rating` tools, with
 * `tool_choice: 'any'` (forcing some tool call on every turn). The model is
 * expected to call `web_search` during research and `submit_rating` once it
 * has the evidence needed to score. The system prompt reinforces this.
 *
 * The rating enum constrains output to the 0.5-step set defined in skill §E.
 */

const ALLOWED_RATINGS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]

export const SUBMIT_RATING_TOOL = {
  description:
    'Submit the final ai:rating and rating_reasoning for this media file. Call this ONCE, after you have researched the file via web_search and have enough reception evidence to score it confidently.',
  // eslint-disable-next-line camelcase -- Anthropic API uses snake_case
  input_schema: {
    properties: {
      rating: {
        description:
          'Final ai:rating in 0.5 increments per skill §E. 5.0 = widespread acclaim + major awards; 4.0 = strong positive; 3.0 = generally positive, mixed; 2.0 = evenly split; 1.0 = predominantly negative.',
        enum: ALLOWED_RATINGS,
        type: 'number',
      },
      // eslint-disable-next-line camelcase -- mirrors .eivu.yml schema
      rating_reasoning: {
        description:
          'Cite SPECIFIC evidence by source name (Metacritic 88, Eisner win 2014, etc.). 1-3 sentences. No marketing copy.',
        type: 'string',
      },
    },
    required: ['rating', 'rating_reasoning'],
    type: 'object',
  },
  name: 'submit_rating',
} as const

export const SUBMIT_RATING_TOOL_CHOICE = {type: 'any'} as const

/** System prompt for variant 5: skill content + instruction to use the tool. */
export function buildStructuredOutputSystemPrompt(baselineSkillContent: string): string {
  return `${baselineSkillContent}

---

## CRITICAL OUTPUT INSTRUCTION FOR THIS RUN

You have two tools available:
- \`web_search\` — use it during research to verify identity, creative team, character appearances, and reception data.
- \`submit_rating\` — call this ONCE at the end with your final ai:rating (0.5 increments) and ai:rating_reasoning.

You MUST call submit_rating when research is complete. Do NOT emit YAML in this run; the rating tool is the ONLY way to produce output. The downstream pipeline will compose the full .eivu.yml from your rating + the filename.`
}
