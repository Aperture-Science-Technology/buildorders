type ResourceName = 'food' | 'wood' | 'gold' | 'stone';

const PATTERNS: RegExp[] = [
  /(\d+)\s*(?:vills?|villagers?)?\s*(?:to|on|at|onto|into)\s*(food|wood|gold|stone)/gi,
  /(\d+)\s*(food|wood|gold|stone)\s*(?:vills?|villagers?)/gi,
  /(food|wood|gold|stone)\s*vills?\s*(?:=|:)\s*(\d+)/gi,
  /(food|wood|gold|stone)\s*(?:=|:)\s*(\d+)/gi,
];

/** Extracts the villager-per-resource assignment implied by a set of action descriptions; last match per resource wins. */
export function extractVillagerAssignments(descriptions: string[]): Partial<Record<ResourceName, number>> {
  const state: Partial<Record<ResourceName, number>> = {};
  const text = descriptions.join('. ');

  for (const pattern of PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const groups = match.slice(1).filter((group): group is string => group !== undefined);
      const numberPart = groups.find((group) => /^\d+$/.test(group));
      const resourcePart = groups.find((group): group is ResourceName =>
        ['food', 'wood', 'gold', 'stone'].includes(group.toLowerCase()),
      );
      if (!numberPart || !resourcePart) continue;
      state[resourcePart.toLowerCase() as ResourceName] = Number(numberPart);
    }
  }

  return state;
}
