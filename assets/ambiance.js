/* ══════════════════════════════════════════════════════════════════
   HAVRE — identité des maquettes
   Chaque bien reçoit une écriture architecturale : matières, menuiseries,
   végétation, équipements par défaut. Le plan reste la source de vérité ;
   l'identité vient s'y poser, jamais l'inverse.
   ══════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

const norm = (s = '') => String(s)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const E = {
  tv: true, biblio: false, bureau: false, table: true,
  plantes: true, tableaux: true, tapis: true, luminaires: true
};
const eq = (o = {}) => ({ ...E, ...o });

const STYLES = {
  haussmannien: {
    nom: 'Haussmannien', resume: 'pierre claire, moulures, chêne',
    mur: 0xF7F1E6, ext: 0xE4D8C4, parquet: ['#C9A26F', '#A67C4E'],
    bois: ['#C09263', '#9E7248'], pierre: ['#E8E1D4', '#CFC5B4'],
    tissus: [0x8B7B66, 0x6F7D6C, 0xA9806A], tapis: [0xC8B79D, 0x879481],
    menuiserie: 0xF2EEE5, accent: [0x2A55C4, 0x7A5C43, 0x4F6B5D],
    nature: ['platane', 'platane', 'buis'], terrain: 'pavage', eau: false, densite: 14,
    details: ['moulures', 'cheminee'], equipements: eq({ biblio: true })
  },
  balneaire: {
    nom: 'Balnéaire', resume: 'chaux blanche, lin, pin maritime',
    mur: 0xFBF8F1, ext: 0xF1ECE1, parquet: ['#D8BC91', '#BFA176'],
    bois: ['#D3B285', '#B08F63'], pierre: ['#E9E5DC', '#D2CCC0'],
    tissus: [0xD8D2C4, 0x6F8A97, 0xB98D6E], tapis: [0xE2D8C5, 0x9FB3B8],
    menuiserie: 0xF7F4ED, accent: [0x3E7C8C, 0xB96B4B, 0x56718C],
    nature: ['pin', 'pin', 'oyat', 'olivier'], terrain: 'pelouse', eau: true, densite: 24,
    details: ['lambris'], equipements: eq({ biblio: false })
  },
  mediterraneen: {
    nom: 'Méditerranéen', resume: 'chaux, terracotta, oliviers',
    mur: 0xF5EDDD, ext: 0xEADDC6, parquet: ['#D2AE7C', '#B58C5E'],
    bois: ['#C9A16F', '#A97E50'], pierre: ['#E7DDC9', '#CBBEA6'],
    tissus: [0xEFE5D2, 0x9B6B4C, 0x6C7B5C], tapis: [0xDCC9AD, 0xA98A6A],
    menuiserie: 0x6B6F66, accent: [0x9A6B3F, 0x6C7B4E, 0xB65A44],
    nature: ['olivier', 'cypres', 'olivier', 'buis'], terrain: 'terre', eau: true, densite: 18,
    details: ['poutres', 'cheminee'], equipements: eq({})
  },
  provencal: {
    nom: 'Provençal', resume: 'pierre sèche, lavande, tuiles',
    mur: 0xF6EFDF, ext: 0xE6D5B8, parquet: ['#D6B184', '#B98F61'],
    bois: ['#C79C68', '#A57B4C'], pierre: ['#E8DDC8', '#CDBEA3'],
    tissus: [0xE8DCC4, 0x8C7B8F, 0xA9B08C], tapis: [0xD9C7AA, 0x9CA682],
    menuiserie: 0x8A7B67, accent: [0x9A6B3F, 0x6C7B4E, 0xB65A44],
    nature: ['olivier', 'cypres', 'buis', 'olivier'], terrain: 'terre', eau: false, densite: 20,
    details: ['poutres', 'cheminee'], equipements: eq({})
  },
  tropique: {
    nom: 'Tropical', resume: 'teck, rotin, palmes',
    mur: 0xFBF6EA, ext: 0xF2E7CF, parquet: ['#D9B382', '#BE925D'],
    bois: ['#C89A62', '#9F7644'], pierre: ['#E9E0CE', '#D0C3A9'],
    tissus: [0xF0E6D2, 0x2E8B7A, 0xD08A3E], tapis: [0xE4D3B2, 0x97B3A0],
    menuiserie: 0x3E3A32, accent: [0x2E8B7A, 0xD08A3E, 0xC0553E],
    nature: ['palmier', 'palmier', 'buis'], terrain: 'sable', eau: true, densite: 18,
    details: ['poutres'], equipements: eq({ biblio: false })
  },
  contemporain: {
    nom: 'Contemporain', resume: 'lignes nettes, chêne clair, verre',
    mur: 0xF4F3EF, ext: 0xE7E4DC, parquet: ['#D9C2A0', '#BFa684'],
    bois: ['#CDB38C', '#AC8E68'], pierre: ['#E7E6E1', '#CBCAC3'],
    tissus: [0xCFCBC1, 0x4E6C74, 0xA87E5E], tapis: [0xDDD6C7, 0x9AA8A2],
    menuiserie: 0x2C3034, accent: [0x2A55C4, 0x8A8F98, 0x3F5E53],
    nature: ['platane', 'buis', 'bouleau'], terrain: 'pelouse', eau: false, densite: 16,
    details: [], equipements: eq({ bureau: true })
  },
  loft: {
    nom: 'Loft industriel', resume: 'béton, acier noir, cuir camel',
    mur: 0xEFEBE3, ext: 0xB26044, parquet: ['#C7A27A', '#A9825C'],
    bois: ['#B98D60', '#936C43'], pierre: ['#DED9D0', '#C2BCB1'],
    tissus: [0xB07A4F, 0x3D474B, 0x8C7159], tapis: [0xB9AE9C, 0x6E7A78],
    menuiserie: 0x26292C, accent: [0xB4552F, 0x2F3A3F, 0xC08A4A],
    nature: ['bouleau', 'buis'], terrain: 'pavage', eau: false, densite: 9,
    details: ['poutres'], equipements: eq({ biblio: true, bureau: true, table: false })
  },
  penthouse: {
    nom: 'Penthouse', resume: 'noir profond, laiton, terrasse',
    mur: 0xF2F0EB, ext: 0x33383D, parquet: ['#C9A87C', '#A9855B'],
    bois: ['#B58E60', '#8F6A43'], pierre: ['#E5E1D8', '#C4BFB4'],
    tissus: [0x2F3438, 0xB08D57, 0x8B9398], tapis: [0xB9AE9C, 0x5F6B70],
    menuiserie: 0x1F2326, accent: [0x1F2937, 0xB08D57, 0x2A55C4],
    nature: ['buis', 'olivier'], terrain: 'pavage', eau: false, densite: 8,
    details: [], equipements: eq({ biblio: true, bureau: true })
  },
  urbain: {
    nom: 'Urbain', resume: 'béton clair, frêne, lin',
    mur: 0xF1F0EC, ext: 0xD8D5CD, parquet: ['#D5C2A3', '#B69F7E'],
    bois: ['#C6AE8C', '#A38A67'], pierre: ['#E3E1DA', '#C6C3BA'],
    tissus: [0xC9C5BC, 0x5E6C72, 0x9C7A62], tapis: [0xD5CEC0, 0x8B9994],
    menuiserie: 0x25282B, accent: [0x5E6C72, 0x9C7A62, 0x2A55C4],
    nature: ['bouleau', 'buis'], terrain: 'pavage', eau: false, densite: 10,
    details: [], equipements: eq({ biblio: true, bureau: true })
  },
  chalet: {
    nom: 'Chalet', resume: 'mélèze, pierre, feu',
    mur: 0xF1E9DA, ext: 0xA97B4F, parquet: ['#B98E5F', '#91683F'],
    bois: ['#B38556', '#8A6038'], pierre: ['#DCD3C2', '#BEB29D'],
    tissus: [0xD9C9AF, 0x8C3B2E, 0x566B5B], tapis: [0xC9B594, 0x8B7A63],
    menuiserie: 0x6B4A2E, accent: [0x8C3B2E, 0x3E5A46, 0xB07A45],
    nature: ['sapin', 'sapin', 'bouleau'], terrain: 'neige', eau: false, densite: 26,
    details: ['poutres', 'cheminee'], equipements: eq({ biblio: true })
  }
};

function styleDe(bien) {
  const t = norm(bien.type), v = norm(bien.ville), p = norm(bien.pays);
  if (t.includes('chalet') || ['courchevel', 'megeve', 'annecy', 'avoriaz', 'chamonix'].includes(v) || p === 'autriche') return 'chalet';
  if (t.includes('loft') || t.includes('atelier')) return 'loft';
  if (t.includes('penthouse')) return 'penthouse';
  if (v === 'tulum') return 'tropique';
  if (['mykonos', 'ibiza', 'marbella', 'albufeira', 'cannes', 'saint-tropez', 'marseille', 'come'].includes(v)) return 'mediterraneen';
  if (['biarritz', 'hossegor', 'deauville'].includes(v)) return 'balneaire';
  if (['gordes'].includes(v)) return 'provencal';
  if (['paris', 'lyon', 'bordeaux'].includes(v)) return 'haussmannien';
  if (['berlin', 'londres', 'vienne', 'oslo'].includes(v)) return 'urbain';
  return 'contemporain';
}

export function identiteDe(bien) {
  const style = styleDe(bien);
  const modele = STYLES[style] || STYLES.contemporain;
  const graine = hash(`${bien.id}|${bien.ville}|${bien.type}|${bien.surface}`);
  const rnd = mulberry32(graine);
  const accent = modele.accent[Math.floor(rnd() * modele.accent.length)];
  const piscine = (bien.equipements || []).some(e => norm(e).includes('piscine'));
  const eau = modele.eau && (piscine || (bien.terrain || 0) > 220 || ['tropique', 'mediterraneen'].includes(style));
  const especes = modele.nature.slice();
  // une variation déterministe de la palette et du végétal par bien
  const decalage = Math.floor(rnd() * especes.length);
  const nature = especes.slice(decalage).concat(especes.slice(0, decalage));
  return {
    style, graine,
    nom: modele.nom,
    resume: modele.resume,
    palette: { ...modele, accent },
    nature: {
      especes: nature,
      terrain: modele.terrain,
      eau,
      densite: modele.densite + Math.round(rnd() * 6),
      neige: modele.terrain === 'neige'
    },
    details: modele.details,
    equipements: { ...modele.equipements }
  };
}

/* ──────────────────────────────────────────────────────────────────
   Végétation : une espèce par région, pas un arbre générique
   ────────────────────────────────────────────────────────────────── */
export function creerArbre(espece, echelle, r, M) {
  const g = new THREE.Group();
  const mat = (m) => m;
  const tige = (rt, rb, h, seg, m, y = h / 2) => {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
    o.position.y = y; o.castShadow = true; o.receiveShadow = true; g.add(o); return o;
  };
  const boule = (rad, m, x, y, z, detail = 0) => {
    const o = new THREE.Mesh(new THREE.IcosahedronGeometry(rad, detail), m);
    o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o;
  };
  const e = echelle;
  if (espece === 'palmier') {
    const tronc = tige(0.09 * e, 0.16 * e, 3.4 * e, 7, M.tronc);
    tronc.rotation.z = 0.06;
    for (let i = 0; i < 8; i++) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(1.7 * e, 0.045 * e, 0.34 * e), i % 2 ? M.vegetal : M.vegetalSombre);
      const a = i / 8 * Math.PI * 2;
      f.position.set(Math.cos(a) * 0.78 * e, 3.35 * e - Math.abs(Math.sin(a)) * 0.12 * e, Math.sin(a) * 0.78 * e);
      f.rotation.y = -a; f.rotation.z = -0.28 - r() * 0.12;
      f.castShadow = true; g.add(f);
    }
    boule(0.16 * e, M.vegetalSombre, 0, 3.32 * e, 0);
  } else if (espece === 'pin' || espece === 'sapin') {
    tige(0.13 * e, 0.22 * e, 2.0 * e, 7, M.tronc, 1.0 * e);
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry((1.05 - i * 0.2) * e, 1.5 * e, 9), i % 2 ? M.vegetal : M.vegetalSombre);
      c.position.y = (1.9 + i * 0.85) * e; c.castShadow = true; g.add(c);
      if (espece === 'sapin' && M.neige) {
        const n = new THREE.Mesh(new THREE.ConeGeometry((1.02 - i * 0.2) * e, 0.34 * e, 9), M.neige);
        n.position.y = (2.42 + i * 0.85) * e; g.add(n);
      }
    }
  } else if (espece === 'olivier') {
    tige(0.14 * e, 0.24 * e, 1.5 * e, 6, M.tronc, 0.75 * e);
    for (let i = 0; i < 4; i++) {
      boule((0.62 + r() * 0.22) * e, M.vegetalClair, (r() - 0.5) * 1.25 * e, (1.65 + r() * 0.45) * e, (r() - 0.5) * 1.25 * e);
    }
  } else if (espece === 'cypres') {
    tige(0.1 * e, 0.15 * e, 0.6 * e, 6, M.tronc, 0.3 * e);
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.5 * e, 4.1 * e, 8), M.vegetalSombre);
    c.position.y = 2.4 * e; c.castShadow = true; g.add(c);
  } else if (espece === 'bouleau') {
    tige(0.08 * e, 0.13 * e, 3.0 * e, 6, M.blanc, 1.5 * e);
    for (let i = 0; i < 3; i++) boule((0.55 + r() * 0.25) * e, i % 2 ? M.vegetalClair : M.vegetal, (r() - 0.5) * 1.1 * e, (2.8 + r() * 0.9) * e, (r() - 0.5) * 1.1 * e);
  } else if (espece === 'oyat') {
    for (let i = 0; i < 7; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.035 * e, (0.5 + r() * 0.5) * e, 4), i % 2 ? M.vegetalClair : M.vegetal);
      f.position.set((r() - 0.5) * 0.5 * e, 0.3 * e, (r() - 0.5) * 0.5 * e);
      f.rotation.z = (r() - 0.5) * 0.7; f.rotation.x = (r() - 0.5) * 0.7; g.add(f);
    }
  } else if (espece === 'buis') {
    tige(0.05 * e, 0.08 * e, 0.35 * e, 5, M.tronc, 0.18 * e);
    boule(0.48 * e, M.vegetal, 0, 0.72 * e, 0, 0);
    boule(0.36 * e, M.vegetalSombre, 0.22 * e, 0.6 * e, 0.12 * e, 0);
  } else {
    tige(0.1 * e, 0.16 * e, 2.1 * e, 6, M.tronc, 1.05 * e);
    for (let i = 0; i < 3; i++) boule((0.8 + r() * 0.3) * e, i % 2 ? M.vegetal : M.vegetalSombre, (r() - 0.5) * 1.3 * e, (2.5 + r() * 0.7) * e, (r() - 0.5) * 1.3 * e);
  }
  g.userData.espece = espece;
  return g;
}

/* ──────────────────────────────────────────────────────────────────
   Personnages : silhouettes à l'échelle, sans visage
   ────────────────────────────────────────────────────────────────── */
export function creerPersonnage({ pose = 'debout', echelle = 1, seed = 1, palette = {} } = {}) {
  const r = mulberry32(seed * 7919 + 13);
  const g = new THREE.Group();
  const peau = new THREE.MeshStandardMaterial({ color: [0xD8B79A, 0xC79A7B, 0x8D5B40, 0xE1C1A5][Math.floor(r() * 4)], roughness: 0.92 });
  const cheveux = new THREE.MeshStandardMaterial({ color: [0x2A211B, 0x6B4A32, 0xB38B5E, 0x3A3A3A][Math.floor(r() * 4)], roughness: 0.95 });
  const hauts = [0xE9E2D6, 0x3D4A55, 0x8C5A45, 0x6F7D6C, 0x2A3550];
  const bas = [0x2E3542, 0x6B665C, 0x3F4C46, 0x8A7A66];
  const haut = new THREE.MeshStandardMaterial({ color: palette.tissus?.[Math.floor(r() * (palette.tissus.length || 1))] ?? hauts[Math.floor(r() * hauts.length)], roughness: 0.95 });
  const pantalon = new THREE.MeshStandardMaterial({ color: bas[Math.floor(r() * bas.length)], roughness: 0.95 });
  const chaussure = new THREE.MeshStandardMaterial({ color: 0x2A2723, roughness: 0.8 });
  const capsule = (rad, len, mat, x, y, z, rz = 0) => {
    const o = new THREE.Mesh(new THREE.CapsuleGeometry(rad, len, 4, 8), mat);
    o.position.set(x, y, z); o.rotation.z = rz; o.castShadow = true; g.add(o); return o;
  };
  const cyl = (rt, rb, h, mat, x, y, z) => {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 8), mat);
    o.position.set(x, y, z); o.castShadow = true; g.add(o); return o;
  };
  const assis = pose === 'assis';
  const hautY = assis ? 0.98 : 1.12;
  // jambes
  if (assis) {
    for (const s of [-1, 1]) {
      capsule(0.085, 0.34, pantalon, s * 0.11, 0.53, 0.2, Math.PI / 2);
      cyl(0.065, 0.075, 0.42, pantalon, s * 0.11, 0.22, 0.42);
      const pied = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.24), chaussure);
      pied.position.set(s * 0.11, 0.04, 0.52); g.add(pied);
    }
  } else {
    for (const s of [-1, 1]) {
      capsule(0.08, 0.52, pantalon, s * 0.11, 0.45, 0);
      const pied = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.09, 0.26), chaussure);
      pied.position.set(s * 0.11, 0.045, 0.04); g.add(pied);
    }
  }
  // bassin + torse
  capsule(0.17, 0.24, haut, 0, hautY, 0);
  capsule(0.145, 0.16, haut, 0, hautY + 0.36, 0);
  // bras
  const brasY = hautY + 0.2;
  capsule(0.055, 0.36, haut, -0.27, brasY, 0.02, 0.14);
  capsule(0.055, 0.36, haut, 0.27, brasY, 0.02, -0.14);
  // tête + cheveux
  const tete = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 12), peau);
  tete.position.set(0, hautY + 0.67, 0); tete.castShadow = true; g.add(tete);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.121, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), cheveux);
  cap.position.set(0, hautY + 0.68, -0.012); g.add(cap);
  const cou = cyl(0.045, 0.05, 0.09, peau, 0, hautY + 0.56, 0);
  cou.castShadow = false;
  g.scale.setScalar(echelle);
  if (assis) g.position.y = 0.02;
  g.userData.personne = true;
  g.userData.phase = r() * Math.PI * 2;
  g.userData.balance = 0.008 + r() * 0.006;
  return g;
}

/* ──────────────────────────────────────────────────────────────────
   Équipements : construits à la pièce, déplaçables ensuite
   ────────────────────────────────────────────────────────────────── */
function outil() {
  const box = (w, h, d, mat, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o;
  };
  const cyl = (rt, rb, h, seg, mat, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o;
  };
  const plante = (h, matFeuille, matTronc) => {
    const p = new THREE.Group();
    p.add(cyl(0.16, 0.2, 0.3, 10, matTronc, 0, 0.15, 0));
    p.add(cyl(0.035, 0.05, h * 0.55, 6, matTronc, 0, 0.3 + h * 0.27, 0));
    for (let i = 0; i < 5; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(h * 0.16, 7, 6), matFeuille);
      const a = i / 5 * Math.PI * 2;
      f.scale.set(1.2, 0.55, 0.55);
      f.position.set(Math.cos(a) * h * 0.17, 0.3 + h * 0.55 + (i % 2) * h * 0.12, Math.sin(a) * h * 0.17);
      f.rotation.z = Math.cos(a) * 0.5; f.castShadow = true; p.add(f);
    }
    return p;
  };
  return { box, cyl, plante };
}

export function creerEquipement(cle, piece, M, id, decalage = 0) {
  const { box, cyl, plante } = outil();
  const P = id.palette;
  const acc = new THREE.MeshStandardMaterial({ color: P.accent, roughness: 0.8 });
  const acc2 = new THREE.MeshStandardMaterial({ color: P.tissus[1] ?? 0x8C7B63, roughness: 0.9 });
  const bois = M.bois === undefined ? M.boisClair : M.bois;
  const r = mulberry32(hash(`${id.graine}|${cle}|${piece.x}|${piece.z}`) + decalage);
  const groupes = [];
  const finaliser = (g, demi, uid) => {
    g.userData.selectable = true;
    g.userData.cle = cle;
    g.userData.uid = `${cle}-${uid}`;
    g.userData.demi = demi;
    groupes.push(g);
  };
  const cx = piece.x + piece.w / 2, cz = piece.z + piece.d / 2;

  if (cle === 'tv') {
    const w = Math.min(2.5, piece.w * 0.58);
    const z0 = piece.z + piece.d - 0.24;
    const g = new THREE.Group(); g.position.set(cx, 0, z0);
    g.add(box(w, 0.42, 0.38, M.boisClair, 0, 0.21, 0));
    g.add(box(w * 0.94, 0.03, 0.4, M.metalNoir, 0, 0.44, 0));
    g.add(box(Math.min(1.55, w * 0.66), 0.9, 0.055, M.metalNoir, 0, 1.55, 0.06));
    g.add(box(Math.min(1.5, w * 0.64), 0.84, 0.01, new THREE.MeshStandardMaterial({ color: 0x0B0F16, roughness: 0.25, metalness: 0.1 }), 0, 1.55, 0.025));
    g.add(box(w * 0.5, 0.055, 0.09, M.metalNoir, 0, 0.55, -0.05));
    g.add(box(0.4, 0.28, 0.04, acc2, -w * 0.32, 0.7, -0.15));
    finaliser(g, [w / 2, 0.3], 0);
  }

  if (cle === 'biblio') {
    const L = Math.min(2.3, piece.d * 0.7);
    const g = new THREE.Group(); g.position.set(piece.x + 0.22, 0, cz);
    g.rotation.y = Math.PI / 2;
    g.add(box(0.32, 2.18, L, M.bois, 0, 1.09, 0));
    const couleurs = [0x6E7B6B, 0x8C5A45, 0x2A3550, 0xC8B79D, 0x9A6B3F, 0x4F5B66];
    for (let s = 0; s < 4; s++) {
      const y = 0.45 + s * 0.46;
      g.add(box(0.34, 0.04, L + 0.02, M.boisClair, 0.02, y, 0));
      let z = -L / 2 + 0.12;
      while (z < L / 2 - 0.1) {
        const lw = 0.035 + r() * 0.03;
        const hh = 0.2 + r() * 0.16;
        const bm = new THREE.MeshStandardMaterial({ color: couleurs[Math.floor(r() * couleurs.length)], roughness: 0.9 });
        g.add(box(0.2, hh, lw, bm, 0.08, y + 0.02 + hh / 2, z));
        z += lw + 0.008;
      }
    }
    finaliser(g, [0.25, L / 2], 0);
  }

  if (cle === 'bureau') {
    const g = new THREE.Group();
    g.position.set(piece.x + Math.min(1.15, piece.w * 0.4), 0, piece.z + Math.min(1.0, piece.d * 0.4));
    g.add(box(1.55, 0.055, 0.72, M.bois, 0, 0.74, 0));
    for (const s of [-1, 1]) g.add(box(0.06, 0.72, 0.66, M.metalNoir, s * 0.7, 0.37, 0));
    g.add(box(0.6, 0.02, 0.02, M.metal, 0, 0.14, -0.28));
    g.add(box(0.42, 0.025, 0.3, M.metal, 0.1, 0.78, 0.04));
    g.add(box(0.4, 0.26, 0.012, new THREE.MeshStandardMaterial({ color: 0x111820, roughness: 0.3 }), 0.1, 0.92, 0.02));
    g.add(cyl(0.12, 0.14, 0.06, 10, M.metalNoir, -0.45, 0.8, -0.12));
    g.add(box(0.42, 0.06, 0.42, acc2, 0, 0.47, 0.58));
    g.add(box(0.08, 0.44, 0.08, M.metalNoir, 0, 0.25, 0.58));
    g.add(box(0.06, 0.3, 0.42, M.metalNoir, 0, 0.42, 0.58));
    g.add(box(0.86, 0.62, 0.03, M.lin, 0.55, 1.45, -0.35));
    g.add(box(0.9, 0.03, 0.05, M.bois, 0.55, 1.77, -0.34));
    finaliser(g, [0.9, 0.75], 0);
  }

  if (cle === 'table') {
    const g = new THREE.Group();
    const coin = piece.w * piece.d > 19;
    g.position.set(coin ? piece.x + piece.w * 0.27 : cx, 0, coin ? piece.z + piece.d * 0.7 : cz);
    g.add(cyl(0.62, 0.62, 0.055, 20, M.bois, 0, 0.73, 0));
    g.add(cyl(0.075, 0.11, 0.7, 10, M.metalNoir, 0, 0.36, 0));
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2 + 0.5;
      const ch = new THREE.Group();
      ch.position.set(Math.cos(a) * 0.95, 0, Math.sin(a) * 0.95);
      ch.rotation.y = -a;
      const assise = box(0.4, 0.05, 0.4, acc2, 0, 0.45, 0);
      ch.add(assise);
      ch.add(box(0.4, 0.45, 0.05, acc2, 0, 0.68, -0.18));
      for (const [sx, sz] of [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]]) ch.add(box(0.035, 0.44, 0.035, M.metalNoir, sx, 0.22, sz));
      g.add(ch);
    }
    finaliser(g, [1.3, 1.3], 0);
  }

  if (cle === 'plantes') {
    const cibles = [];
    const sej = piece.type === 'sejour' ? piece : null;
    if (sej) cibles.push([sej.x + 0.5, sej.z + 0.5, sej]);
    else cibles.push([piece.x + 0.5, piece.z + 0.5, piece]);
    cibles.forEach(([x, z, pc], i) => {
      const g = new THREE.Group(); g.position.set(x, 0, z);
      g.add(plante(0.9 + i * 0.15, i % 2 ? M.vegetalClair : M.vegetal, M.terracotta));
      finaliser(g, [0.3, 0.3], i);
    });
  }

  if (cle === 'tableaux') {
    const oeuvres = [
      { w: 0.95, h: 0.68, mat: acc },
      { w: 0.62, h: 0.85, mat: acc2 }
    ];
    oeuvres.forEach((o, i) => {
      const g = new THREE.Group();
      g.position.set(i ? piece.x + piece.w * 0.72 : cx, 1.62 + i * 0.08, i ? piece.z + 0.08 : piece.z + 0.08);
      g.add(box(o.w + 0.06, o.h + 0.06, 0.035, M.boisClair, 0, 0, 0));
      g.add(box(o.w, o.h, 0.012, o.mat, 0, 0, 0.024));
      g.add(box(o.w * 0.62, o.h * 0.5, 0.004, M.lin, 0.04, -0.02, 0.031));
      finaliser(g, [o.w / 2, 0.1], i);
    });
  }

  if (cle === 'tapis') {
    const g = new THREE.Group(); g.position.set(cx, 0, cz);
    g.add(box(Math.min(piece.w - 0.8, 2.4), 0.015, Math.min(piece.d - 0.8, 1.7), acc2, 0, 0.02, 0));
    finaliser(g, [1.2, 0.9], 0);
  }

  if (cle === 'luminaires') {
    const g = new THREE.Group();
    g.position.set(piece.x + Math.min(0.65, piece.w * 0.25), 0, piece.z + Math.min(0.65, piece.d * 0.25));
    g.add(cyl(0.22, 0.26, 0.035, 14, M.metalNoir, 0, 0.02, 0));
    g.add(cyl(0.022, 0.022, 1.65, 8, M.metalNoir, 0, 0.84, 0));
    const bras = box(0.9, 0.03, 0.03, M.metalNoir, 0.42, 1.66, 0);
    g.add(bras);
    const shadeMat = new THREE.MeshStandardMaterial({ color: 0xF2E6CE, roughness: 0.9, emissive: 0x000000 });
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.26, 14, 1, true), shadeMat);
    shade.position.set(0.86, 1.54, 0); shade.rotation.z = Math.PI;
    shade.userData.ampoule = true;
    g.add(shade);
    finaliser(g, [0.5, 0.3], 0);
  }

  return groupes;
}
