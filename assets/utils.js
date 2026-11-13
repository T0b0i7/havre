/* ══════════════════════════════════════════════════════════════════
   HAVRE — utilitaires partagés
   Source unique pour les fonctions dupliquées entre data.js,
   visite3d.js et ambiance.js.
   ══════════════════════════════════════════════════════════════════ */

/**
 * Générateur pseudo-aléatoire Mulberry32 — déterministe à partir d'une graine.
 * Retourne une fonction sans argument qui produit un flottant dans [0, 1[.
 * @param {number} seed
 * @returns {() => number}
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Hachage FNV-1a 32 bits — transforme une chaîne en entier non signé.
 * Utilisé pour dériver des graines déterministes à partir d'identifiants.
 * @param {string|number} s
 * @returns {number}
 */
export function hash(s) {
  let h = 2166136261;
  const str = String(s);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Normalise une chaîne pour la recherche ou la comparaison :
 * minuscules, sans accents, sans ponctuation, espaces normalisés.
 * @param {string} t
 * @returns {string}
 */
export function normaliser(t) {
  return (t || '')
    .toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}
