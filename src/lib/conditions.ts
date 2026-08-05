import type { Action, ActionBranch, Phase } from '@/lib/types';

/** Matches a standalone "if" token, case-insensitive (word boundaries avoid "gift", "different", etc). */
const IF_PATTERN = /\bif\b/i;
/** Conditions are meant to be short badges, not full sentences. */
const MAX_CONDITION_LENGTH = 60;

/**
 * Extracts the part of `description` following an "if" and returns it as a short,
 * cleaned-up condition string (truncated at the next sentence boundary, capped in
 * length, stripped of trailing punctuation). Returns undefined when there's no "if"
 * or nothing usable follows it.
 */
function extractCondition(description: string): string | undefined {
  const match = IF_PATTERN.exec(description);
  if (!match) return undefined;

  const afterIf = description.slice(match.index + match[0].length).trim();
  if (!afterIf) return undefined;

  const sentenceEnd = /[.!?;]/.exec(afterIf);
  let condition = sentenceEnd ? afterIf.slice(0, sentenceEnd.index) : afterIf;
  condition = condition.trim();

  if (condition.length > MAX_CONDITION_LENGTH) {
    const truncated = condition.slice(0, MAX_CONDITION_LENGTH);
    const lastSpace = truncated.lastIndexOf(' ');
    condition = lastSpace > MAX_CONDITION_LENGTH * 0.6 ? truncated.slice(0, lastSpace) : truncated;
  }

  condition = condition.replace(/[.\s]+$/, '').trim();
  return condition || undefined;
}

function applyConditionToBranch(branch: ActionBranch): ActionBranch {
  return { ...branch, actions: branch.actions.map(applyConditionToAction) };
}

function applyConditionToAction(action: Action): Action {
  const withCondition =
    action.condition || !IF_PATTERN.test(action.description)
      ? action
      : { ...action, condition: extractCondition(action.description) ?? action.condition };

  if (!action.branches?.length) return withCondition;
  return { ...withCondition, branches: action.branches.map(applyConditionToBranch) };
}

/**
 * Detects simple "if …" conditions in action descriptions (e.g. "Build a tower if
 * you scout early aggression.") and sets `action.condition` from the extracted part,
 * without touching the description or creating branches — branching is left to the
 * user via the grid editor since auto-generating it would be too risky/ambiguous.
 */
export function applyConditionsFromDescriptions(phases: Phase[]): Phase[] {
  return phases.map((phase) => ({
    ...phase,
    actions: phase.actions.map(applyConditionToAction),
  }));
}
