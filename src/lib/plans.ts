// Centralized plan / tier configuration shared between frontend and edge functions

export const BASIC_PRODUCT_ID = 'prod_UN5zsXIUOrZTbq';
export const PRO_PRODUCT_ID = 'prod_UN67H1phk2js4F';
export const CLINICA_PRO_PRODUCT_ID = 'prod_UNv69FFEc8eE8h';

export const BASIC_PRICE_ID = 'price_1TOLnGDl2hex55TCx1bOpeFQ';
export const PRO_PRICE_ID = 'price_1TOLvFDl2hex55TCdWF2h1iR';
export const CLINICA_PRO_PRICE_ID = 'price_1TP9FvDl2hex55TCDKvCj9aO';

// Legacy price IDs (Mensal, Bimestral, Trimestral) — these subscribers keep Pro-level access
export const LEGACY_PRICE_IDS = [
  'price_1Sz87xDl2hex55TCI3ONELuq',
  'price_1Sz88ADl2hex55TCABAFO3OL',
  'price_1Sz88LDl2hex55TCwzGTUplF',
];

export type Tier = 'basic' | 'pro' | 'clinica_pro' | 'legacy' | 'trial' | 'owner' | null;

/**
 * Decide tier given the productId returned by check-subscription.
 * Special productIds: 'owner', 'trial', 'legacy' come pre-tagged from the edge function.
 */
export function deriveTier(productId: string | null | undefined): Tier {
  if (!productId) return null;
  if (productId === 'owner') return 'owner';
  if (productId === 'trial') return 'trial';
  if (productId === 'legacy') return 'legacy';
  if (productId === CLINICA_PRO_PRODUCT_ID) return 'clinica_pro';
  if (productId === PRO_PRODUCT_ID) return 'pro';
  if (productId === BASIC_PRODUCT_ID) return 'basic';
  // Unknown product — treat as legacy (don't lock out paying users)
  return 'legacy';
}

/** Tiers that grant Pro-level features. */
export function tierHasPro(tier: Tier): boolean {
  return tier === 'pro' || tier === 'clinica_pro' || tier === 'legacy' || tier === 'trial' || tier === 'owner';
}

/** Tiers that can manage a multi-professional team / organization. Exclusive to Clínica Pro. */
export function tierHasTeam(tier: Tier): boolean {
  return tier === 'clinica_pro' || tier === 'legacy' || tier === 'trial' || tier === 'owner';
}
