import { z } from 'zod';
import type { Risk, RiskRecord } from './types';

/** Beta-PERT weighted average: (min + 4×mostLikely + max) / 6 */
export function betaPertImpact(min: number, mostLikely: number, max: number): number {
  return (min + 4 * mostLikely + max) / 6;
}

/** Risk exposure = betaPertImpact × probability */
export function betaPertExposure(
  min: number,
  mostLikely: number,
  max: number,
  probability: number,
): number {
  return betaPertImpact(min, mostLikely, max) * probability;
}

// risk_records stores raw model-specific inputs as jsonb (model_inputs) plus
// which model applies (risk_model), rather than fixed typed columns per
// input -- adding a new risk model is a code change here (reviewed, tested,
// type-checked), not a database migration. Mirrors cost_codes.eac_method's
// existing strategy-switch pattern, extended to the *inputs* as well as the
// formula. See supabase/migrations/0037_risk_model_flexibility.sql.
export const RISK_MODELS = ['beta_pert_3point'] as const;
export type RiskModel = (typeof RISK_MODELS)[number];

export const BetaPert3PointInputsSchema = z.object({
  min: z.number(),
  mostLikely: z.number(),
  max: z.number(),
});
export type BetaPert3PointInputs = z.infer<typeof BetaPert3PointInputsSchema>;

/**
 * Validates model_inputs against the shape the given risk model expects.
 * Throws on an unrecognized model or a mismatched shape -- deliberately
 * strict rather than defaulting missing fields to 0, since that's exactly
 * the class of bug (silently zeroing real risk exposure) this whole
 * refactor exists to prevent from recurring under a new model.
 */
export function validateModelInputs(riskModel: string, modelInputs: unknown): BetaPert3PointInputs {
  switch (riskModel) {
    case 'beta_pert_3point':
      return BetaPert3PointInputsSchema.parse(modelInputs);
    default:
      throw new Error(`Unknown risk model "${riskModel}" -- add a case in validateModelInputs/computeExposureForModel (src/domain/risk.ts) before storing data under it.`);
  }
}

/** Computes risk exposure for whichever model a risk_records row uses. */
export function computeExposureForModel(riskModel: string, modelInputs: unknown, probability: number): number {
  const inputs = validateModelInputs(riskModel, modelInputs);
  switch (riskModel) {
    case 'beta_pert_3point':
      return betaPertExposure(inputs.min, inputs.mostLikely, inputs.max, probability);
    default:
      throw new Error(`Unknown risk model "${riskModel}"`);
  }
}

export interface RiskImpactLeaf {
  minImpactAmount: number;
  mostLikelyImpactAmount: number;
  maxImpactAmount: number;
  probability: number;
}

/**
 * Roll up a Risk's exposure and impact totals from its RiskRecord leaves.
 * Canonical replacement for the duplicated updateParentTotals in
 * RiskManagement.tsx and BulkRiskRecords.tsx.
 */
export function computeRiskRollup(records: RiskImpactLeaf[]): {
  exposure: number;
  minImpactTotal: number;
  mostLikelyImpactTotal: number;
  maxImpactTotal: number;
} {
  return records.reduce(
    (totals, r) => {
      const min = Number(r.minImpactAmount) || 0;
      const mostLikely = Number(r.mostLikelyImpactAmount) || 0;
      const max = Number(r.maxImpactAmount) || 0;
      const probability = Number(r.probability) || 0;
      return {
        exposure: totals.exposure + betaPertExposure(min, mostLikely, max, probability),
        minImpactTotal: totals.minImpactTotal + min,
        mostLikelyImpactTotal: totals.mostLikelyImpactTotal + mostLikely,
        maxImpactTotal: totals.maxImpactTotal + max,
      };
    },
    { exposure: 0, minImpactTotal: 0, mostLikelyImpactTotal: 0, maxImpactTotal: 0 },
  );
}

/**
 * Aggregates all of a project's RiskRecord leaves into
 * Map<riskId, RiskRollup> in one pass — pure, no I/O. Groups records by
 * riskId, then applies computeRiskRollup per group. Canonical replacement
 * for the duplicated updateParentTotals() in RiskManagement.tsx and
 * BulkRiskRecords.tsx (both fetched one risk's records at a time and wrote
 * the result back to Firestore; this computes all risks' totals live from
 * whatever records are currently subscribed).
 */
export function aggregateRiskRollups(risks: Risk[], riskRecords: RiskRecord[]): Map<string, ReturnType<typeof computeRiskRollup>> {
  const recordsByRiskId = new Map<string, RiskImpactLeaf[]>();
  for (const record of riskRecords) {
    const list = recordsByRiskId.get(record.riskId) || [];
    list.push(record);
    recordsByRiskId.set(record.riskId, list);
  }

  const rollups = new Map<string, ReturnType<typeof computeRiskRollup>>();
  for (const risk of risks) {
    rollups.set(risk.id, computeRiskRollup(recordsByRiskId.get(risk.id) || []));
  }
  return rollups;
}
