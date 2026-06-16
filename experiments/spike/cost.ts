/**
 * Re-export the production cost utilities (now at @src/ai/cost) under the
 * spike-local `SpikeCost` alias used by the spike harness and report code.
 * Live code should import from @src/ai/cost directly.
 */
export {computeCost, computeRawCost, type Cost as SpikeCost, sumCosts, zeroCost} from '@src/ai/cost.js'
