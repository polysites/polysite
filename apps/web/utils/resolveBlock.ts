// How a Payload block becomes a Vue component, per site theme.
//
// Every installed theme is bundled into one Nuxt build, so two themes that each
// supply a "HeroBlock" must not share a name -- the last one registered would
// win for every site. Theme components therefore live under components/<theme>/
// and Nuxt names them `<Theme><Block>`: `components/starter/HeroBlock.vue` is
// `StarterHeroBlock`. The renderer looks a block up in the site's theme first,
// then in that theme's parent chain (theme.json `parent`), then in the core
// fallbacks, which are deliberately plain.

/** Payload block slug -> component base name. Must match apps/cms/src/blocks/*.ts. */
export const BLOCK_COMPONENT_NAMES: Record<string, string> = {
  hero: "HeroBlock",
  textBlock: "TextBlock",
  faqAccordion: "FaqAccordionBlock",
  featureGrid: "FeatureGridBlock",
  formEmbed: "FormEmbedBlock",
  signupForm: "SignupFormBlock",
  leaderSpotlight: "LeaderSpotlightBlock",
  donationTiers: "DonationTiersBlock",
  commitmentsGrid: "CommitmentsGridBlock",
};

/** `my-theme` -> `MyTheme`, matching how Nuxt prefixes a components/<dir>/ folder. */
export function pascalCase(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join("");
}

/**
 * The theme followed by its ancestors, nearest first. Bounded so a typo'd
 * `parent` loop in someone's theme.json can't hang rendering.
 */
export function themeChain(theme: string | null | undefined, parents: Record<string, string> = {}): string[] {
  const chain: string[] = [];
  let current = theme;
  while (current && !chain.includes(current) && chain.length < 8) {
    chain.push(current);
    current = parents[current];
  }
  return chain;
}

/**
 * Finds the component for a block: the first theme in `chain` that provides it
 * wins, otherwise the core fallback. `names` is the block slug -> component name table: the core's, or the core's plus what
 * plugins registered (utils/blockTypes.ts). Returns undefined for a block type nobody
 * knows, so the caller can render its "unknown block" notice.
 */
export function resolveBlockComponent<T>(
  blockType: string,
  chain: string[],
  registry: Record<string, T | undefined>,
  fallbacks: Record<string, T | undefined>,
  names: Record<string, string> = BLOCK_COMPONENT_NAMES,
): T | undefined {
  const base = Object.hasOwn(names, blockType) ? names[blockType] : undefined;
  if (!base) return undefined;
  for (const theme of chain) {
    const found = registry[`${pascalCase(theme)}${base}`];
    if (found) return found;
  }
  return Object.hasOwn(fallbacks, blockType) ? fallbacks[blockType] : undefined;
}
