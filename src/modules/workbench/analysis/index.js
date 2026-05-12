// Compat re-export shim — new code should import from src/modules/analysis/*
export {
  SCRATCH_ANALYSIS_SOURCE,
  createScratchAnalysisContext,
  getScratchAnalysisCacheKey,
} from '../../analysis/scratchAnalysis.ts'
