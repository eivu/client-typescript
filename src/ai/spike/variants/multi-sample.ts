import {buildUserMessage} from '@src/ai/base-agent.js'
import {ClaudeAgent} from '@src/ai/claude-agent.js'
import {extractRatingFromYaml, median} from '@src/ai/spike/extract-rating.js'
import {loadBaselineSkill, sumUsage, zeroUsage} from '@src/ai/spike/skill-loader.js'
import {type Variant, type VariantJob, type VariantRunResult} from '@src/ai/spike/types.js'

const SPIKE_MAX_TOKENS = 8192
const SAMPLE_COUNT = 3
const SAMPLE_TEMPERATURE = 0.3

/**
 * Variant 4: Multi-sample n=3 median. Same baseline prompt drawn 3 times at
 * temperature 0.3; the median of the 3 ratings is the variant's output.
 *
 * Cost is ~3× baseline per fixture. The hypothesis: if scoring variance is
 * roughly Gaussian, median-of-3 cuts effective stddev by ~30-40% — enough to
 * be worth the cost premium if baseline stddev is high.
 *
 * All 3 samples per job go into a SINGLE Anthropic batch, which is the most
 * efficient pattern (one cache miss, two cache hits, no inter-call latency).
 */
export const multiSampleVariant: Variant = {
  description: 'Baseline prompt × 3 samples at temp=0.3, median rating. Tests sampling-noise reduction.',
  name: 'multi-sample',
  async runBatch(jobs: VariantJob[]): Promise<VariantRunResult[]> {
    if (jobs.length === 0) return []

    const agent = new ClaudeAgent({
      maxTokens: SPIKE_MAX_TOKENS,
      model: 'claude-opus-4-6',
      skillContent: loadBaselineSkill(),
      temperature: SAMPLE_TEMPERATURE,
      webSearchMaxUses: 10,
    })

    // Flatten: 3 sample requests per job, encoded as customId + sample index.
    const sampleRequests = jobs.flatMap((job) =>
      Array.from({length: SAMPLE_COUNT}, (_, sampleIndex) => ({
        customId: `${job.customId}--s${sampleIndex + 1}`,
        filePath: job.fixture.filename,
        userMessage: buildUserMessage(job.fixture.filename),
      })),
    )

    const sampleResults = await agent.processRequestsRaw(sampleRequests)

    return jobs.map((job): VariantRunResult => {
      const myResults = sampleResults.filter((r) => r.customId.startsWith(`${job.customId}--s`))

      if (myResults.length === 0) {
        return {
          errorMessage: 'no sample results returned',
          rating: null,
          rawText: null,
          reasoning: null,
          status: 'model_error',
          usage: zeroUsage(),
        }
      }

      const perSampleRatings: Array<null | number> = []
      const sampleTexts: string[] = []
      let firstReasoning: null | string = null
      let anyError: null | string = null

      for (const sample of myResults) {
        if (sample.status === 'error') {
          perSampleRatings.push(null)
          anyError = sample.error ?? null
          sampleTexts.push(`[error: ${sample.error ?? 'unknown'}]`)
          continue
        }

        const extracted = extractRatingFromYaml(sample.rawText)
        perSampleRatings.push(extracted.rating)
        sampleTexts.push(sample.rawText)
        if (firstReasoning === null && extracted.reasoning !== null) firstReasoning = extracted.reasoning
      }

      const medianRating = median(perSampleRatings)
      const combinedUsage = sumUsage(...myResults.map((r) => r.usage))

      let status: VariantRunResult['status'] = 'success'
      if (medianRating === null) status = perSampleRatings.every((r) => r === null) ? 'model_error' : 'parse_failure'

      return {
        errorMessage: medianRating === null ? (anyError ?? 'all samples failed to parse') : null,
        perSampleRatings,
        rating: medianRating,
        rawText: sampleTexts.join('\n--- next sample ---\n'),
        reasoning: firstReasoning,
        status,
        usage: combinedUsage,
      }
    })
  },
}
