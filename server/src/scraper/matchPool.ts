import type { PoolListing } from "./fetchPoolList.js";

// Generic facility-type words the source PDFs consistently drop from a
// pool's official page name when labeling table rows (e.g. "Bud Kearns
// Memorial Pool" is labeled just "Bud Kearns"). These are never useful for
// matching, even as a fallback.
const GENERIC_STOPWORDS = new Set(["pool", "pools", "center", "centers", "aquatic", "community", "swim", "dr", "the"]);

// These are sometimes purely decorative ("Bud Kearns Memorial Pool" -> "Bud
// Kearns" in the PDF, "Dr. Martin Luther King Jr. Pool" -> "Martin Luther
// King") and sometimes the pool's whole identity ("Memorial Pool" ->
// "Memorial"), so they're only dropped when another identifying token is
// present alongside them.
const CONDITIONAL_STOPWORDS = new Set(["memorial", "jr"]);

// PDF row labels occasionally use an acronym that shares no tokens with the
// official page name at all. Can't be derived generically.
const ALIASES: Record<string, string> = {
  mlk: "martin-luther-king-jr-pool",
};

// Cheap stemming so "Gardens" (official name) and "Garden" (PDF's
// abbreviated row label) are treated as the same token.
function stem(token: string): string {
  return token.length > 3 && token.endsWith("s") ? token.slice(0, -1) : token;
}

export function normalizeTokens(text: string): string[] {
  const all = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map(stem);
  const withoutGeneric = all.filter((t) => !GENERIC_STOPWORDS.has(t));
  const withoutConditional = withoutGeneric.filter((t) => !CONDITIONAL_STOPWORDS.has(t));
  if (withoutConditional.length > 0) return withoutConditional;
  return withoutGeneric.length > 0 ? withoutGeneric : all;
}

export function aliasMatch(tokens: string[], pools: PoolListing[]): PoolListing | undefined {
  for (const token of tokens) {
    const slug = ALIASES[token];
    if (slug) {
      const found = pools.find((p) => p.slug === slug);
      if (found) return found;
    }
  }
  return undefined;
}

/** True once `buffer`'s accumulated tokens cover every token of the pool's normalized name. */
export function isRowComplete(buffer: string, pool: PoolListing): boolean {
  const bufTokens = new Set(normalizeTokens(buffer));
  const poolTokens = normalizeTokens(pool.name);
  return poolTokens.length > 0 && poolTokens.every((t) => bufTokens.has(t));
}

export function matchRowBuffer(buffer: string, remainingPools: PoolListing[]): PoolListing | undefined {
  const bufTokens = normalizeTokens(buffer);
  const alias = aliasMatch(bufTokens, remainingPools);
  if (alias) return alias;
  return remainingPools.find((p) => isRowComplete(buffer, p));
}
