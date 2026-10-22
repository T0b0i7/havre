/* ══════════════════════════════════════════════════════════════════
   HAVRE — moteur de reconstruction plan → maquette 3D
   Un seul jeu de données (pièces / murs / ouvertures) alimente :
     · le plan 2D vectoriel (SVG)
     · la maquette 3D + la visite déambulatoire
     · le détecteur de plans (image ou SVG importé)
   ══════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { identiteDe, creerArbre, creerPersonnage, creerEquipement } from './ambiance.js';

const H_MUR = 2.75;
const R_JEU = 0.28;

/* ── petits outils ── */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

function hashTexte(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── textures procédurales (aucune dépendance externe) ── */
function toile(w, h, dessin) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  dessin(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
function texBois(teinte = '#C9A87C', sombre = '#A9865C') {
  return toile(512, 512, (ctx, w, h) => {
    const r = rng(41);
    ctx.fillStyle = teinte; ctx.fillRect(0, 0, w, h);
    const l = 512 / 6;
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? sombre : teinte;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(0, i * l, w, l);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(80,55,30,.28)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(0, i * l); ctx.lineTo(w, i * l); ctx.stroke();
      for (let k = 0; k < 16; k++) {
        ctx.strokeStyle = `rgba(90,62,34,${0.05 + r() * 0.09})`;
        ctx.lineWidth = 0.6 + r();
        const y = i * l + r() * l;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 7, w * 0.7, y + (r() - 0.5) * 7, w, y);
        ctx.stroke();
      }
    }
  });
}
function texCarrelage(base = '#E9E5DD', joint = '#CFC8BC', n = 4) {
  return toile(512, 512, (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = joint; ctx.lineWidth = 3;
    const s = w / n;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(w, i * s); ctx.stroke();
    }
    const r = rng(9);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(120,115,105,${r() * 0.05})`;
      ctx.fillRect(r() * w, r() * h, 2, 2);
    }
  });
}
function texSable(base = '#D8CBB4') {
  return toile(256, 256, (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    const r = rng(7);
    for (let i = 0; i < 3000; i++) {
      ctx.fillStyle = `rgba(${90 + r() * 60},${80 + r() * 50},${65 + r() * 40},${r() * 0.10})`;
      ctx.fillRect(r() * w, r() * h, 2, 2);
    }
  });
}
function texEnduit() {
  return toile(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#F6F2EA'; ctx.fillRect(0, 0, w, h);
    const r = rng(23);
    for (let i = 0; i < 2400; i++) {
      ctx.fillStyle = `rgba(${170 + r() * 50},${165 + r() * 50},${150 + r() * 45},${r() * 0.18})`;
      ctx.fillRect(r() * w, r() * h, 3, 3);
    }
  });
}
function texCiel3D(nuit = false) {
  return toile(8, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    if (nuit) {
      g.addColorStop(0, '#050B18');
      g.addColorStop(0.42, '#0B1730');
      g.addColorStop(0.72, '#14243E');
      g.addColorStop(1, '#263A55');
    } else {
      g.addColorStop(0, '#EAF4FF');
      g.addColorStop(0.45, '#DCEBFF');
      g.addColorStop(0.75, '#CFE1FA');
      g.addColorStop(1, '#C3D6F2');
    }
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    if (nuit) {
      const r = rng(77);
      for (let i = 0; i < 90; i++) {
        const a = 0.25 + r() * 0.65;
        ctx.fillStyle = `rgba(255,248,232,${a})`;
        const s = r() < 0.12 ? 2 : 1;
        ctx.fillRect(r() * w, r() * h * 0.72, s, s);
      }
    }
  });
}

/* ══════════════════════════════════════════════════════════════════
   DÉCOUPE D'UN MUR AUTOUR DE SES OUVERTURES
   ══════════════════════════════════════════════════════════════════ */
function decouperMur(mur, hauteur) {
  const L = Math.hypot(mur.x2 - mur.x1, mur.z2 - mur.z1);
  const ops = (mur.ouvertures || []).map(o => ({
    ...o,
    u0: clamp((o.t ?? 0.5) * L, 0.2, L - 0.2),
    demi: Math.min(o.largeur || 1, L - 0.4) / 2
  })).sort((a, b) => a.u0 - b.u0);

  const solides = [];   // intervalles pleins [a,b]
  let curseur = 0;
  ops.forEach(o => {
    const a = clamp(o.u0 - o.demi, 0, L);
    const b = clamp(o.u0 + o.demi, 0, L);
    if (a > curseur + 0.01) solides.push([curseur, a]);
    curseur = Math.max(curseur, b);
  });
  if (curseur < L - 0.01) solides.push([curseur, L]);

  const trous = ops.map(o => {
    const a = clamp(o.u0 - o.demi, 0, L);
    const b = clamp(o.u0 + o.demi, 0, L);
    const estPorte = o.type === 'porte';
    const allege = estPorte ? 0 : (o.allege ?? 0.9);
    const haut = estPorte ? (o.hauteur ?? 2.12) : allege + (o.hauteur ?? 1.4);
    return { ...o, a, b, allege, haut, estPorte };
  });
  return { L, solides, trous };
}

/* ══════════════════════════════════════════════════════════════════
   PLAN 2D VECTORIEL
   ══════════════════════════════════════════════════════════════════ */
export function planSVG(plan, { niveau = 0, marge = 1.4, largeur = 1000, compact = false } = {}) {
  const n = plan.niveaux[niveau];
  if (!n) return '';
  const W = n.largeur, D = n.profondeur;
  const vb = { x: -marge, y: -marge, w: W + marge * 2, h: D + marge * 2 };
  const s = largeur / vb.w;
  const px = 1 / s;
  const out = [];
  out.push(`<svg class="plan-svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">`);
  out.push(`<defs>
    <pattern id="hachure" width="0.22" height="0.22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="0.22" stroke="#2A3547" stroke-width="0.05"/>
    </pattern>
  </defs>`);
  out.push(`<rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" fill="#FBF8F1"/>`);

  // pièces
  n.pieces.forEach(p => {
    out.push(`<rect x="${p.x}" y="${p.z}" width="${p.w}" height="${p.d}" fill="${p.couleur}" opacity=".72"/>`);
  });
  // cotes intérieures
  if (!compact) {
    n.pieces.forEach(p => {
      const surf = Math.round(p.w * p.d);
      const cx = p.x + p.w / 2, cz = p.z + p.d / 2;
      const petite = p.w < 2.6 || p.d < 2.6;
      out.push(`<text x="${cx}" y="${cz - (petite ? 0 : 0.12)}" text-anchor="middle" font-family="Manrope,sans-serif" font-size="${0.30 * (compact ? 1.6 : 1)}" font-weight="600" fill="#2A3547">${p.nom}</text>`);
      if (!petite) out.push(`<text x="${cx}" y="${cz + 0.42}" text-anchor="middle" font-family="Manrope,sans-serif" font-size="${0.24}" fill="#7A8290">${surf} m²</text>`);
    });
  }

  // murs
  n.murs.forEach(m => {
    const { L, solides, trous } = decouperMur(m, H_MUR);
    const ang = Math.atan2(m.z2 - m.z1, m.x2 - m.x1) * 180 / Math.PI;
    const ux = (m.x2 - m.x1) / L, uz = (m.z2 - m.z1) / L;
    const P = u => [m.x1 + ux * u, m.z1 + uz * u];
    solides.forEach(([a, b]) => {
      const [x1, z1] = P(a), [x2, z2] = P(b);
      out.push(`<line x1="${x1}" y1="${z1}" x2="${x2}" y2="${z2}" stroke="#232D3E" stroke-width="${m.ep}" stroke-linecap="butt"/>`);
    });
    trous.forEach(o => {
      const [x1, z1] = P(o.a), [x2, z2] = P(o.b);
      if (o.estPorte) {
        // seuil + arc de porte
        out.push(`<line x1="${x1}" y1="${z1}" x2="${x2}" y2="${z2}" stroke="#FBF8F1" stroke-width="${m.ep * 1.01}"/>`);
        out.push(`<line x1="${x1}" y1="${z1}" x2="${x2}" y2="${z2}" stroke="#B9AF9D" stroke-width="0.035" stroke-dasharray="0.1 0.08"/>`);
        const dv = o.b - o.a;
        out.push(`<path d="M ${x1} ${z1} A ${dv} ${dv} 0 0 1 ${(x1 + Math.cos(ang * Math.PI / 180 + Math.PI / 2) * dv).toFixed(3)} ${(z1 + Math.sin(ang * Math.PI / 180 + Math.PI / 2) * dv).toFixed(3)}" fill="none" stroke="#B9AF9D" stroke-width="0.022"/>`);
      } else {
        out.push(`<line x1="${x1}" y1="${z1}" x2="${x2}" y2="${z2}" stroke="#FBF8F1" stroke-width="${m.ep * 1.01}"/>`);
        // double trait de la fenêtre
        const nx = -uz, nz = ux;
        const e = Math.max(0.05, m.ep * 0.34);
        out.push(`<line x1="${x1 + nx * e}" y1="${z1 + nz * e}" x2="${x2 + nx * e}" y2="${z2 + nz * e}" stroke="#4C88B8" stroke-width="0.04"/>`);
        out.push(`<line x1="${x1 - nx * e}" y1="${z1 - nz * e}" x2="${x2 - nx * e}" y2="${z2 - nz * e}" stroke="#4C88B8" stroke-width="0.04"/>`);
      }
    });
  });

  if (!compact) {
    // cotes générales
    const yCote = D + 0.9, xCote = W + 0.9;
    out.push(`<g stroke="#8C93A0" stroke-width="0.022" fill="none">
      <line x1="0" y1="${yCote}" x2="${W}" y2="${yCote}"/>
      <line x1="0" y1="${yCote - 0.14}" x2="0" y2="${yCote + 0.14}"/>
      <line x1="${W}" y1="${yCote - 0.14}" x2="${W}" y2="${yCote + 0.14}"/>
      <line x1="${xCote}" y1="0" x2="${xCote}" y2="${D}"/>
      <line x1="${xCote - 0.14}" y1="0" x2="${xCote + 0.14}" y2="0"/>
      <line x1="${xCote - 0.14}" y1="${D}" x2="${xCote + 0.14}" y2="${D}"/>
    </g>`);
    out.push(`<text x="${W / 2}" y="${yCote - 0.18}" text-anchor="middle" font-family="Manrope,sans-serif" font-size="0.26" fill="#5A6270">${W.toFixed(1)} m</text>`);
    out.push(`<text x="${xCote + 0.22}" y="${D / 2}" font-family="Manrope,sans-serif" font-size="0.26" fill="#5A6270" transform="rotate(90 ${xCote + 0.22} ${D / 2})" text-anchor="middle">${D.toFixed(1)} m</text>`);
    // échelle graphique
    out.push(`<g transform="translate(0,${D + 0.3})">
      <line x1="0" y1="0" x2="3" y2="0" stroke="#2A3547" stroke-width="0.035"/>
      <line x1="0" y1="-0.09" x2="0" y2="0.09" stroke="#2A3547" stroke-width="0.035"/>
      <line x1="1.5" y1="-0.06" x2="1.5" y2="0.06" stroke="#2A3547" stroke-width="0.028"/>
      <line x1="3" y1="-0.09" x2="3" y2="0.09" stroke="#2A3547" stroke-width="0.035"/>
      <text x="3.16" y="0.09" font-family="Manrope,sans-serif" font-size="0.22" fill="#5A6270">3 m</text>
    </g>`);
    // nord
    out.push(`<g transform="translate(${W - 0.55},${-0.35})">
      <circle r="0.42" fill="none" stroke="#2A3547" stroke-width="0.02"/>
      <path d="M0 -0.32 L0.13 0.16 L0 0.07 L-0.13 0.16 Z" fill="#2A3547"/>
      <text y="-0.5" text-anchor="middle" font-family="Manrope,sans-serif" font-size="0.2" fill="#2A3547">N</text>
    </g>`);
  }
  out.push('</svg>');
  return out.join('');
}

/* ══════════════════════════════════════════════════════════════════
   MAQUETTE 3D
   ══════════════════════════════════════════════════════════════════ */
function materiaux(id) {
  const P = id.palette;
  const chantier = (o) => new THREE.MeshStandardMaterial(o);
  const tissuMat = (i, fallback) => chantier({ color: P.tissus[i] ?? fallback, roughness: 0.95 });
  const tapis = (i) => chantier({ color: P.tapis[i] ?? 0xC8B79D, roughness: 1 });
  const solExt = (() => {
    if (id.nature.terrain === 'neige') return chantier({ color: 0xE8EDF2, roughness: 0.96 });
    if (id.nature.terrain === 'sable') return chantier({ map: texSable('#D8C6A4'), roughness: 1 });
    if (id.nature.terrain === 'pavage') return chantier({ map: texCarrelage('#D8D1C4', '#C1B9AB', 3), roughness: 0.92 });
    if (id.nature.terrain === 'terre') return chantier({ map: texSable('#B99B77'), roughness: 1 });
    return chantier({ map: texSable('#8FA27E'), roughness: 1 });
  })();
  return {
    enduit: chantier({ map: texEnduit(), color: P.mur, roughness: 0.94 }),
    enduitExt: chantier({ map: texEnduit(), color: P.ext, roughness: 0.96 }),
    murCoupe: chantier({ color: 0x232D3E, roughness: 0.8 }),
    bois: chantier({ map: texBois(P.bois[0], P.bois[1]), roughness: 0.56 }),
    boisClair: chantier({ map: texBois(P.bois[0], P.bois[1]), color: 0xF2E4CD, roughness: 0.52 }),
    parquet: chantier({ map: texBois(P.parquet[0], P.parquet[1]), roughness: 0.52 }),
    pierre: chantier({ map: texCarrelage(P.pierre[0], P.pierre[1], 3), roughness: 0.72 }),
    marbre: chantier({ map: texCarrelage('#F0ECE3', '#D7D0C4', 2), roughness: 0.34 }),
    carreaux: chantier({ map: texCarrelage('#E5E8E7', '#C9CFCE', 5), roughness: 0.5 }),
    beton: chantier({ map: texSable('#CFC9BE'), roughness: 0.88 }),
    tapis: tapis(0),
    tissu: tissuMat(0),
    tissuNuit: tissuMat(1, 0x8E9AAE),
    terracotta: chantier({ color: 0xB87556, roughness: 0.9 }),
    vegetal: chantier({ color: id.style === 'chalet' ? 0x3F5F4A : 0x5D7A52, roughness: 0.95 }),
    vegetalSombre: chantier({ color: id.style === 'tropique' ? 0x2C6B55 : 0x445E3C, roughness: 0.95 }),
    vegetalClair: chantier({ color: id.style === 'provencal' ? 0x8C9874 : id.style === 'mediterraneen' ? 0x7F8F72 : 0x78946B, roughness: 0.95 }),
    tronc: chantier({ color: id.style === 'chalet' ? 0x5A402C : 0x6E5B45, roughness: 1 }),
    neige: chantier({ color: 0xF2F6F8, roughness: 0.92 }),
    metal: chantier({ color: 0x8B8F94, roughness: 0.32, metalness: 0.85 }),
    metalNoir: chantier({ color: id.style === 'penthouse' ? 0x14181B : 0x2A2C2E, roughness: 0.4, metalness: 0.6 }),
    menuiserie: chantier({ color: P.menuiserie, roughness: 0.5, metalness: id.style === 'contemporain' || id.style === 'urbain' ? 0.3 : 0 }),
    verre: new THREE.MeshStandardMaterial({ color: 0xBFD6EA, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.26, side: THREE.DoubleSide }),
    eau: new THREE.MeshStandardMaterial({ color: 0x8FB9CE, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.78 }),
    blanc: chantier({ color: 0xF7F4ED, roughness: 0.5 }),
    lin: chantier({ color: 0xEFE9DE, roughness: 0.95 }),
    terre: chantier({ color: 0x6E5B45, roughness: 1 }),
    pelouse: solExt,
    solExt,
    sable: chantier({ map: texSable('#D8C6A4'), roughness: 1 }),
    pavage: chantier({ map: texCarrelage('#D8D1C4', '#C1B9AB', 3), roughness: 0.92 }),
    dalle: chantier({ map: texCarrelage('#DAD5CB', '#C3BDB1', 2), roughness: 0.9 })
  };
}

let compteurGeo = 0;
function boite(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  compteurGeo++;
  return m;
}
function cylindre(rt, rb, h, seg, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/* ── mobilier par pièce ── */
function meubler(piece, M, identite) {
  const g = new THREE.Group();
  const { w, d, type } = piece;
  const cx = piece.x + w / 2, cz = piece.z + d / 2;
  g.position.set(cx, 0, cz);
  const r = rng(hashTexte(piece.type + piece.x + piece.z));
  const accent = new THREE.MeshStandardMaterial({ color: identite?.palette?.accent ?? 0x2A55C4, roughness: 0.9 });
  const dispo = type !== 'escalier' && type !== 'palier' && type !== 'terrasse';
  if (!dispo) {
    if (type === 'escalier' || type === 'palier') {
      const marches = Math.max(6, Math.min(12, Math.floor(d / 0.28)));
      for (let i = 0; i < marches; i++) {
        g.add(boite(Math.min(1.1, w - 0.4), 0.18, 0.26, M.boisClair, 0, 0.09 + i * 0.18, -d / 2 + 0.5 + i * 0.27));
      }
      g.add(boite(0.06, 0.9, d - 0.6, M.metalNoir, Math.min(0.55, w / 2 - 0.25), 1.0, 0));
    } else if (type === 'terrasse') {
      g.add(boite(1.8, 0.08, 0.9, M.bois, 0, 0.42, 0));
      g.add(boite(1.8, 0.34, 0.08, M.bois, 0, 0.22, -0.45));
      for (const s of [-0.7, 0.7]) g.add(cylindre(0.26, 0.26, 0.16, 10, M.tissu, s, 0.55, 0.1));
    }
    return g;
  }

  const p = (x, z) => [x, z];
  const axeLong = w >= d;
  if (type === 'sejour') {
    const long = Math.max(2, Math.min(3.2, (axeLong ? w : d) * 0.45));
    const cote = Math.min(0.95, (axeLong ? d : w) * 0.32);
    const sofa = boite(long, 0.42, cote, M.tissu, 0, 0.21, 0);
    const dossier = boite(long, 0.44, 0.16, M.tissu, 0, 0.62, -cote / 2 + 0.08);
    const accoudoir = (s) => boite(0.16, 0.3, cote, M.tissu, s * (long / 2 - 0.08), 0.55, 0);
    g.add(sofa, dossier); g.add(accoudoir(-1), accoudoir(1));
    // coussins d'accent
    for (const s of [-0.28, 0.26]) g.add(boite(0.32, 0.32, 0.12, accent, s * (long - 0.5), 0.52, -cote / 2 + 0.18));
    g.add(boite(long * 0.6, 0.06, 0.5, M.tapis, 0, 0.03, cote / 2 + 0.55));
    g.add(boite(1.05, 0.34, 0.6, M.bois, 0, 0.17, cote / 2 + 0.55));
    g.add(boite(0.9, 0.02, 0.45, M.marbre || M.blanc, 0, 0.35, cote / 2 + 0.55));
    for (let i = 0; i < 2; i++) {
      g.add(cylindre(0.06, 0.06, 0.7, 8, M.vegetalSombre, -long / 2 + 0.2 + i * 0.3, 0.9, -cote / 2 + 0.05));
      g.add(cylindre(0.22, 0.14, 0.24, 8, M.terre, -long / 2 + 0.2 + i * 0.3, 0.55, -cote / 2 + 0.05));
    }
    // suspension
    g.add(cylindre(0.22, 0.28, 0.2, 12, M.blanc, 0, 2.25, 0));
    g.add(cylindre(0.008, 0.008, 0.4, 4, M.metalNoir, 0, 2.55, 0));
  } else if (type === 'cuisine') {
    const long = Math.max(1.8, Math.min(4.4, w - 0.5));
    const x0 = -long / 2;
    g.add(boite(long, 0.86, 0.62, M.blanc, 0, 0.43, -d / 2 + 0.36));
    g.add(boite(long, 0.05, 0.66, M.pierre, 0, 0.88, -d / 2 + 0.36));
    g.add(boite(0.62, 0.86, Math.min(2, d * 0.42), M.blanc, w / 2 - 0.38, 0.43, 0.4));
    g.add(boite(1.9, 0.9, 0.9, M.boisClair, 0, 0.45, d * 0.16));
    g.add(boite(2.0, 0.05, 1.0, M.pierre, 0, 0.92, d * 0.16));
    for (const s of [-0.6, 0.6]) {
      g.add(cylindre(0.17, 0.17, 0.06, 12, M.bois, s, 0.6, d * 0.16 + 0.42));
      g.add(cylindre(0.03, 0.03, 0.58, 6, M.metalNoir, s, 0.3, d * 0.16 + 0.42));
    }
    g.add(boite(0.6, 0.06, 0.45, M.metal, -long / 2 + 0.7, 0.86, -d / 2 + 0.36));
    g.add(boite(0.05, 0.34, 0.05, M.metal, -long / 2 + 1.2, 1.08, -d / 2 + 0.42));
    // étagères hautes
    for (let i = 0; i < 3; i++) g.add(boite(long * 0.7, 0.04, 0.3, M.bois, 0, 1.35 + i * 0.32, -d / 2 + 0.22));
  } else if (type === 'chambre' || type === 'suite') {
    const bw = Math.min(1.7, Math.max(1.1, w * 0.55));
    const bd = Math.min(2.1, Math.max(1.4, d * 0.62));
    g.add(boite(bw + 0.12, 0.28, bd + 0.12, M.bois, 0, 0.19, 0));
    g.add(boite(bw, 0.22, bd, M.lin, 0, 0.42, 0));
    g.add(boite(bw, 0.9, 0.14, M.tissu, 0, 0.95, -bd / 2 - 0.02));
    for (const s of [-1, 1]) {
      g.add(boite(bw * 0.38, 0.1, 0.42, M.blanc, s * bw * 0.23, 0.56, -bd / 2 + 0.32));
      g.add(boite(0.42, 0.5, 0.42, M.bois, s * (bw / 2 + 0.4), 0.25, -bd / 2 + 0.35));
      g.add(cylindre(0.11, 0.13, 0.28, 10, M.blanc, s * (bw / 2 + 0.4), 0.68, -bd / 2 + 0.35));
      g.add(cylindre(0.12, 0.12, 0.02, 10, M.lin, s * (bw / 2 - 0.3), 0.54, -bd / 2 + 0.6));
    }
    if (type === 'suite') {
      g.add(boite(Math.min(1.4, w * 0.4), 2.2, 0.55, M.boisClair, w / 2 - 0.55, 1.1, d / 2 - 0.55));
      g.add(boite(0.9, 1.7, 0.04, M.verre, -w / 2 + 0.06, 1.0, 0));
    }
  } else if (type === 'sdb') {
    g.add(boite(Math.min(1.6, w * 0.7), 0.8, 0.52, M.blanc, 0, 0.4, -d / 2 + 0.3));
    g.add(boite(0.6, 0.06, 0.4, M.blanc, 0, 0.83, -d / 2 + 0.3));
    g.add(boite(0.7, 0.8, 0.05, M.verre, 0, 1.5, -d / 2 + 0.06));
    if (w * d > 7) {
      g.add(boite(Math.min(1.7, w * 0.6), 0.5, Math.min(0.8, d * 0.42), M.blanc, 0, 0.25, d / 2 - 0.5));
      g.add(boite(Math.min(1.6, w * 0.56), 0.04, Math.min(0.7, d * 0.4), M.carreaux, 0, 0.46, d / 2 - 0.5));
    } else {
      g.add(boite(0.9, 0.02, 0.9, M.carreaux, -w / 2 + 0.55, 0.02, d / 2 - 0.55));
      g.add(boite(0.9, 2.1, 0.03, M.verre, -w / 2 + 0.55, 1.05, d / 2 - 0.1));
      g.add(cylindre(0.12, 0.12, 0.02, 10, M.metal, 0, 2.4, d / 2 - 0.08));
    }
  } else if (type === 'wc') {
    g.add(boite(0.4, 0.42, 0.6, M.blanc, 0, 0.21, 0));
    g.add(boite(0.42, 0.5, 0.2, M.blanc, 0, 0.55, -0.26));
    g.add(cylindre(0.03, 0.03, 0.5, 6, M.metal, 0.32, 0.55, 0));
    g.add(boite(0.22, 0.12, 0.16, M.blanc, 0.34, 0.85, 0.2));
  } else if (type === 'bureau') {
    const bw = Math.min(2.1, w * 0.66);
    g.add(boite(bw, 0.06, 0.8, M.bois, 0, 0.74, 0));
    g.add(boite(0.06, 0.72, 0.72, M.metalNoir, -bw / 2 + 0.05, 0.37, 0));
    g.add(boite(0.06, 0.72, 0.72, M.metalNoir, bw / 2 - 0.05, 0.37, 0));
    g.add(boite(0.48, 0.06, 0.48, M.tissuNuit, 0, 0.46, 0.62));
    g.add(boite(0.08, 0.5, 0.08, M.metalNoir, 0, 0.25, 0.62));
    g.add(boite(0.06, 0.34, 0.5, M.metalNoir, 0, 0.42, 0.62));
    g.add(boite(bw, 0.28, 0.3, M.boisClair, 0, 1.5, -d / 2 + 0.2));
  } else if (type === 'dressing') {
    for (const s of [-1, 1]) {
      g.add(boite(0.6, 2.3, Math.min(2.6, d * 0.8), M.boisClair, s * (w / 2 - 0.36), 1.15, 0));
      g.add(boite(0.02, 0.02, Math.min(2.5, d * 0.78), M.metal, s * (w / 2 - 0.66), 1.7, 0));
    }
  } else if (type === 'entree') {
    g.add(boite(1.0, 0.8, 0.34, M.bois, 0, 0.4, -d / 2 + 0.25));
    g.add(cylindre(0.2, 0.2, 0.05, 12, M.marbre || M.blanc, 0, 0.83, -d / 2 + 0.25));
    g.add(boite(0.9, 0.06, 0.35, M.boisClair, -w / 2 + 0.9, 0.46, d / 2 - 0.35));
    g.add(boite(1.1, 0.5, 0.03, M.metal, -w / 2 + 0.9, 1.55, d / 2 - 0.2));
  }
  return g;
}

/* ══════════════════════════════════════════════════════════════════
   DÉTAILS D'ARCHITECTURE LIÉS À L'IDENTITÉ DU BIEN
   ══════════════════════════════════════════════════════════════════ */
function detailsStyle(g, niveau, M, identite, hauteur) {
  const d = identite.details || [];
  const sejour = niveau.pieces.find(p => p.type === 'sejour') || niveau.pieces.find(p => p.w * p.d > 12);
  if (d.includes('moulures')) {
    niveau.pieces.forEach(p => {
      if (p.w < 1.6 || p.d < 1.6) return;
      const y = hauteur - 0.2;
      g.add(boite(p.w - 0.06, 0.1, 0.045, M.blanc, p.x + p.w / 2, y, p.z + 0.05));
      g.add(boite(p.w - 0.06, 0.1, 0.045, M.blanc, p.x + p.w / 2, y, p.z + p.d - 0.05));
      g.add(boite(0.045, 0.1, p.d - 0.06, M.blanc, p.x + 0.05, y, p.z + p.d / 2));
      g.add(boite(0.045, 0.1, p.d - 0.06, M.blanc, p.x + p.w - 0.05, y, p.z + p.d / 2));
    });
  }
  if (d.includes('poutres')) {
    const n = Math.max(2, Math.round(niveau.largeur / 2.6));
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * (niveau.largeur / n);
      g.add(boite(0.16, 0.26, niveau.profondeur - 0.4, M.bois, x, hauteur - 0.15, niveau.profondeur / 2));
    }
  }
  if (d.includes('cheminee') && sejour) {
    const p = sejour;
    const cz = p.z + p.d * 0.52;
    const f = new THREE.Group();
    f.position.set(p.x + 0.3, 0, cz);
    f.add(boite(0.52, 1.35, Math.min(1.7, p.d * 0.46), M.pierre, 0, 0.67, 0));
    f.add(boite(0.06, 0.72, Math.min(1.05, p.d * 0.3), M.metalNoir, 0.28, 0.48, 0));
    f.add(boite(0.16, 0.1, Math.min(1.45, p.d * 0.4), M.marbre, 0.36, 1.36, 0));
    f.add(boite(0.5, 0.06, Math.min(1.5, p.d * 0.42), M.pierre, 0.18, 0.03, 0));
    f.children[1].userData.cheminee = true;
    g.add(f);
  }
  if (d.includes('lambris') && sejour) {
    const p = sejour;
    for (let i = 0; i < 7; i++) {
      g.add(boite(Math.min(3.2, p.w * 0.55), 0.16, 0.035, M.boisClair, p.x + p.w * 0.28, 0.2 + i * 0.18, p.z + 0.08));
    }
  }
}

/* ══════════════════════════════════════════════════════════════════
   CONSTRUCTION D'UN NIVEAU
   ══════════════════════════════════════════════════════════════════ */
function construireNiveau(niveau, M, { hauteur = H_MUR, ext = true, collisions = [], identite = null } = {}) {
  const g = new THREE.Group();
  const W = niveau.largeur, D = niveau.profondeur;

  // dalle générale
  const dalle = boite(W + 0.5, 0.18, D + 0.5, M.dalle, W / 2, -0.09, D / 2);
  dalle.receiveShadow = true; dalle.castShadow = false;
  g.add(dalle);

  // sols par pièce
  niveau.pieces.forEach(p => {
    let mat = M.parquet;
    if (['cuisine', 'sdb', 'wc', 'entree'].includes(p.type)) mat = M.pierre;
    if (p.type === 'terrasse') mat = M.bois;
    if (p.type === 'escalier' || p.type === 'palier') mat = M.boisClair;
    const sol = new THREE.Mesh(new THREE.PlaneGeometry(p.w - 0.03, p.d - 0.03), mat.clone());
    if (mat.map) {
      sol.material.map = mat.map.clone();
      sol.material.map.needsUpdate = true;
      sol.material.map.repeat.set(Math.max(1, p.w / 2.2), Math.max(1, p.d / 2.2));
      sol.material.map.wrapS = sol.material.map.wrapT = THREE.RepeatWrapping;
    }
    sol.rotation.x = -Math.PI / 2;
    sol.position.set(p.x + p.w / 2, 0.011, p.z + p.d / 2);
    sol.receiveShadow = true;
    g.add(sol);
    // plinthes
    const pl = 0.07;
    [[p.x, p.z + pl / 2, p.w, pl], [p.x, p.z + p.d - pl / 2, p.w, pl]].forEach(() => {});
    g.add(boite(p.w, 0.08, 0.025, M.blanc, p.x + p.w / 2, 0.04, p.z + 0.012));
  });

  // murs
  niveau.murs.forEach(m => {
    const L = Math.hypot(m.x2 - m.x1, m.z2 - m.z1);
    if (L < 0.05) return;
    const ang = Math.atan2(m.z2 - m.z1, m.x2 - m.x1);
    const ux = (m.x2 - m.x1) / L, uz = (m.z2 - m.z1) / L;
    const mx = (m.x1 + m.x2) / 2, mz = (m.z1 + m.z2) / 2;
    const grp = new THREE.Group();
    grp.position.set(mx, 0, mz);
    grp.rotation.y = -ang;
    const mat = m.ext ? M.enduitExt : M.enduit;
    const { L: LL, solides, trous } = decouperMur(m, hauteur);

    solides.forEach(([a, b]) => {
      const w = b - a;
      if (w < 0.015) return;
      const x = a + w / 2 - LL / 2;
      const mur = boite(w, hauteur, m.ep, mat, x, hauteur / 2, 0);
      grp.add(mur);
      // arête supérieure coupée (lecture maquette)
      grp.add(boite(w, 0.012, m.ep + 0.004, M.murCoupe, x, hauteur + 0.006, 0));
      collisions.push({ x1: m.x1 + ux * a, z1: m.z1 + uz * a, x2: m.x1 + ux * b, z2: m.z1 + uz * b, ep: m.ep });
    });

    trous.forEach(o => {
      const x = (o.a + o.b) / 2 - LL / 2;
      const w = o.b - o.a;
      const hTrou = o.haut - o.allege;
      // linteau
      if (o.haut < hauteur - 0.01) {
        grp.add(boite(w + 0.04, hauteur - o.haut, m.ep, mat, x, (hauteur + o.haut) / 2, 0));
        grp.add(boite(w + 0.04, 0.012, m.ep + 0.004, M.murCoupe, x, hauteur + 0.006, 0));
      }
      if (!o.estPorte) {
        // une fenêtre fermée bloque le passage (l'allège et le vitrage sont solides)
        collisions.push({
          x1: m.x1 + ux * o.a, z1: m.z1 + uz * o.a,
          x2: m.x1 + ux * o.b, z2: m.z1 + uz * o.b,
          ep: m.ep
        });
        // allège
        if (o.allege > 0.02) {
          grp.add(boite(w, o.allege, m.ep, mat, x, o.allege / 2, 0));
        }
        // vitrage
        const v = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, hTrou - 0.06, 0.03), M.verre);
        v.position.set(x, o.allege + hTrou / 2, 0);
        v.userData.fenetre = true;
        grp.add(v);
        // menuiserie
        const c = 0.05;
        grp.add(boite(w, c, m.ep * 0.55, M.menuiserie, x, o.allege + hTrou / 2, 0));
        grp.add(boite(c, hTrou, m.ep * 0.55, M.menuiserie, x, o.allege + hTrou / 2, 0));
        grp.add(boite(w, c, m.ep * 0.6, M.menuiserie, x, o.allege + 0.02, 0));
        grp.add(boite(w, c, m.ep * 0.6, M.menuiserie, x, o.allege + hTrou, 0));
        // tablette intérieure
        grp.add(boite(w + 0.1, 0.035, m.ep + 0.12, M.marbre, x, o.allege + 0.02, 0));
      } else {
        // encadrement de porte
        grp.add(boite(0.06, o.haut, m.ep + 0.02, M.menuiserie, x - w / 2 + 0.02, o.haut / 2, 0));
        grp.add(boite(0.06, o.haut, m.ep + 0.02, M.menuiserie, x + w / 2 - 0.02, o.haut / 2, 0));
        grp.add(boite(w, 0.06, m.ep + 0.02, M.menuiserie, x, o.haut - 0.02, 0));
        // battant entrouvert
        const battant = new THREE.Group();
        battant.position.set(x - w / 2 + 0.02, 0, 0);
        battant.rotation.y = -0.55;
        const p = boite(w - 0.08, o.haut - 0.06, 0.04, M.boisClair, (w - 0.08) / 2, (o.haut - 0.06) / 2, 0);
        battant.add(p);
        battant.add(cylindre(0.028, 0.028, 0.12, 8, M.metal, w - 0.2, 1.02, 0.05));
        grp.add(battant);
        collisions.push({ x1: m.x1 + ux * o.a, z1: m.z1 + uz * o.a, x2: m.x1 + ux * o.b, z2: m.z1 + uz * o.b, ep: 0, porte: true });
      }
    });
    g.add(grp);
  });

  // mobilier
  niveau.pieces.forEach(p => {
    if (p.w < 1.2 || p.d < 1.2) return;
    const f = meubler(p, M, identite);
    // orienter le séjour vers la baie si possible
    g.add(f);
    // tapis pour les chambres
    if (p.type === 'chambre' || p.type === 'suite') {
      const t = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(p.w - 0.5, 2.2), Math.min(p.d - 0.5, 1.6)), M.tapis);
      t.rotation.x = -Math.PI / 2; t.position.set(p.x + p.w / 2, 0.02, p.z + p.d / 2);
      g.add(t);
    }
    // plafonnier
    const lp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), new THREE.MeshStandardMaterial({ color: 0xFFF6E6, emissive: 0xFFE9C2, emissiveIntensity: 1.4 }));
    lp.position.set(p.x + p.w / 2, hauteur - 0.22, p.z + p.d / 2);
    g.add(lp);
  });

  if (identite) detailsStyle(g, niveau, M, identite, hauteur);

  // plafond (masqué en mode maquette)
  const plafond = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: 0xFBF8F2, roughness: 1, side: THREE.DoubleSide }));
  plafond.rotation.x = Math.PI / 2;
  plafond.position.set(W / 2, hauteur, D / 2);
  plafond.name = 'plafond';
  g.add(plafond);

  return g;
}

/* ══════════════════════════════════════════════════════════════════
   VISITE
   ══════════════════════════════════════════════════════════════════ */
export class Visite {
  constructor(racine, bien, options = {}) {
    this.racine = racine;
    this.bien = bien;
    this.plan = bien.plan || options.plan;
    this.niveau = 0;
    this.mode = 'visite';
    this.detruit = false;
    this.collisions = [];
    this.pieces = [];
    this.nbFrames = 0;
    this.derniere = performance.now();
    this.angles = { theta: 0.9, phi: 0.95, r: 26 };
    this.joueur = { x: 0, z: 0, yaw: 0, pitch: 0 };
    this.touches = new Set();
    this.pointers = new Map();
    this.vitesse = 2.4;
    this.reduit = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
    this.identite = identiteDe(bien);
    this.nuit = false;
    this.personnes = false;
    this.panneauOuvert = false;
    this.selection = null;
    this.selectionBox = null;
    this.objetsParCle = new Map();
    this.personnages = [];
    this.lumieresNuit = [];
    this.ampoules = [];
    this.cheminees = [];
    this.positions = {};
    this.supprimes = new Set();
    this.sauvegarde = this._lireSauvegarde();
    this.equipements = { ...this.identite.equipements };
    if (this.sauvegarde?.equipements) Object.assign(this.equipements, this.sauvegarde.equipements);
    if (this.sauvegarde?.positions) this.positions = { ...this.sauvegarde.positions };
    if (this.sauvegarde?.supprimes) this.supprimes = new Set(this.sauvegarde.supprimes);
    if (this.sauvegarde?.nuit) this.nuit = true;
    if (this.sauvegarde?.personnes) this.personnes = true;
    this._construireDOM();
    this._initThree();
    this._monterNiveau(0);
    this._construireExterieur();
    this._evenements();
    this._majBoutons();
    this._appliquerNuit();
    this._boucle();
    window.__visite3d = this;
  }

  _lireSauvegarde() {
    try {
      const v = JSON.parse(localStorage.getItem(`havre.maquette.${this.bien.id}`) || 'null');
      return v && v.version === 1 ? v : null;
    } catch { return null; }
  }

  _sauvegarder() {
    try {
      this._memoriserPositions();
      localStorage.setItem(`havre.maquette.${this.bien.id}`, JSON.stringify({
        version: 1,
        equipements: this.equipements,
        positions: this.positions,
        supprimes: [...this.supprimes],
        nuit: this.nuit,
        personnes: this.personnes
      }));
    } catch { /* stockage local indisponible : la maquette reste utilisable */ }
  }

  _memoriserPositions() {
    this.deco?.children.forEach(g => {
      if (!g.userData?.uid) return;
      this.positions[g.userData.uid] = {
        x: +g.position.x.toFixed(3),
        z: +g.position.z.toFixed(3),
        ry: +g.rotation.y.toFixed(3)
      };
    });
  }

  /* ── DOM de la visite ── */
  _construireDOM() {
    const n = this.plan.niveaux.length;
    this.racine.innerHTML = `
      <div class="v3d">
        <canvas class="v3d-canvas"></canvas>
        <div class="v3d-voile" hidden><span></span></div>
        <header class="v3d-haut">
          <div class="v3d-titre">
            <b>${this.bien.titre}</b>
            <span>${this.bien.ville} · ${this.bien.quartier} — <em class="v3d-niveau-nom">${this.plan.niveaux[0].nom}</em></span>
          </div>
          <div class="v3d-segments" role="tablist" aria-label="Mode de visite">
            <button data-mode="visite" class="actif">Visite</button>
            <button data-mode="maquette">Maquette</button>
            <button data-mode="plan">Plan</button>
          </div>
          <div class="v3d-actions">
            ${n > 1 ? `<div class="v3d-niveaux">${this.plan.niveaux.map((x, i) =>
              `<button data-niveau="${i}" class="${i === 0 ? 'actif' : ''}">${i === 0 ? 'RDC' : 'Étage ' + i}</button>`).join('')}</div>` : ''}
            <button class="v3d-icone v3d-nuit" title="Mode nuit (N)" aria-label="Mode nuit" aria-pressed="false">☾</button>
            <button class="v3d-icone v3d-amenager" title="Aménager la maquette" aria-label="Aménager la maquette" aria-pressed="false">✎</button>
            <button class="v3d-plein" title="Plein écran" aria-label="Plein écran">⤢</button>
            <button class="v3d-fermer" title="Fermer" aria-label="Fermer">✕</button>
          </div>
        </header>
        <aside class="v3d-panneau" hidden aria-label="Aménagement de la maquette">
          <header class="vp-tete">
            <div><b>Aménager</b><span class="vp-signature">${this.identite.nom} · ${this.identite.resume}</span></div>
            <button class="vp-fermer" title="Fermer le panneau" aria-label="Fermer le panneau">✕</button>
          </header>
          <div class="vp-corps">
            <section class="vp-section">
              <span class="vp-label">Ambiance</span>
              <div class="vp-duo">
                <button data-amb="nuit" aria-pressed="false"><i aria-hidden="true">☾</i><span>Nuit</span></button>
                <button data-amb="personnes" aria-pressed="false"><i aria-hidden="true">◉</i><span>Personnes</span></button>
              </div>
            </section>
            <section class="vp-section">
              <span class="vp-label">Équipements</span>
              <div class="vp-chips">
                <button data-equip="tv" aria-pressed="false">Télévision</button>
                <button data-equip="biblio" aria-pressed="false">Bibliothèque</button>
                <button data-equip="bureau" aria-pressed="false">Bureau</button>
                <button data-equip="table" aria-pressed="false">Table</button>
                <button data-equip="plantes" aria-pressed="false">Plantes</button>
                <button data-equip="tableaux" aria-pressed="false">Tableaux</button>
                <button data-equip="tapis" aria-pressed="false">Tapis</button>
                <button data-equip="luminaires" aria-pressed="false">Luminaires</button>
              </div>
            </section>
            <section class="vp-section vp-selection" hidden>
              <span class="vp-label">Objet sélectionné</span>
              <p class="vp-selection-nom">—</p>
              <div class="vp-outils">
                <button data-sel="gauche" title="Pivoter à gauche" aria-label="Pivoter à gauche">⟲</button>
                <button data-sel="droite" title="Pivoter à droite" aria-label="Pivoter à droite">⟳</button>
                <button data-sel="supprimer" class="danger">Supprimer</button>
                <button data-sel="fermer" title="Désélectionner" aria-label="Désélectionner">✕</button>
              </div>
            </section>
            <p class="vp-aide">Glissez un objet sur le sol pour le déplacer. Flèches pour ajuster, <b>R</b> pour pivoter, <b>Suppr</b> pour retirer.</p>
            <button class="vp-reset" data-reset>Réinitialiser l'aménagement</button>
          </div>
        </aside>
        <div class="v3d-hud">
          <div class="v3d-piece">Entrée</div>
          <div class="v3d-surface">${Math.round(this.plan.niveaux[0].surface)} m² · ${this.plan.niveaux[0].pieces.length} pièces</div>
          <div class="v3d-identite">${this.identite.nom} · ${this.identite.resume}</div>
        </div>
        <div class="v3d-mini"><canvas width="320" height="320"></canvas><span class="v3d-nord">N</span></div>
        <div class="v3d-aide">
          <span><b>ZQSD / WASD</b> se déplacer</span>
          <span><b>Glisser</b> regarder</span>
          <span><b>Maj</b> courir</span>
          <span class="v3d-aide-tactile"><b>Joystick</b> marcher · glisser l'écran pour regarder</span>
        </div>
        <div class="v3d-joystick" aria-hidden="true"><i></i></div>
        <div class="v3d-plan" hidden></div>
        <div class="v3d-charge"><i></i><span>Reconstruction du plan…</span></div>
        <div class="v3d-astuce">Cliquez et glissez pour regarder autour de vous</div>
      </div>`;
    this.el = this.racine.querySelector('.v3d');
    this.canvas = this.racine.querySelector('.v3d-canvas');
    this.elPiece = this.racine.querySelector('.v3d-piece');
    this.elSurface = this.racine.querySelector('.v3d-surface');
    this.elIdentite = this.racine.querySelector('.v3d-identite');
    this.elNomNiveau = this.racine.querySelector('.v3d-niveau-nom');
    this.elPanneau = this.racine.querySelector('.v3d-panneau');
    this.elSelection = this.racine.querySelector('.vp-selection');
    this.elSelectionNom = this.racine.querySelector('.vp-selection-nom');
    this.elMini = this.racine.querySelector('.v3d-mini canvas');
    this.elPlan = this.racine.querySelector('.v3d-plan');
    this.elCharge = this.racine.querySelector('.v3d-charge');
    this.elAstuce = this.racine.querySelector('.v3d-astuce');
    this.joystick = this.racine.querySelector('.v3d-joystick');
  }

  _initThree() {
    this.M = materiaux(this.identite);
    this.scene = new THREE.Scene();
    this.cielJour = texCiel3D();
    this.cielNuit = texCiel3D(true);
    this.scene.background = this.cielJour;
    this.scene.fog = new THREE.Fog(0xDFECFF, 40, 120);
    this.camera = new THREE.PerspectiveCamera(68, 1, 0.05, 400);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.hemisphere = new THREE.HemisphereLight(0xEAF3FF, 0xB9AE99, 1.15);
    this.scene.add(this.hemisphere);
    const soleil = new THREE.DirectionalLight(0xFFF3DC, 2.1);
    soleil.position.set(-18, 26, -14);
    soleil.castShadow = true;
    soleil.shadow.mapSize.set(1024, 1024);
    soleil.shadow.camera.left = -30; soleil.shadow.camera.right = 30;
    soleil.shadow.camera.top = 30; soleil.shadow.camera.bottom = -30;
    soleil.shadow.bias = -0.0008;
    this.scene.add(soleil);
    this.soleil = soleil;

    const interieur = new THREE.PointLight(0xFFE7C4, 18, 26, 2);
    interieur.position.set(6, 2.35, 6);
    this.scene.add(interieur);
    this.lumiereInterieure = interieur;

    this.habillage = new THREE.Group();
    this.scene.add(this.habillage);
    this.lampesExt = new THREE.Group();
    this.scene.add(this.lampesExt);

    this.raycaster = new THREE.Raycaster();
    this.planSol = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.02);

    this.groupe = new THREE.Group();
    this.scene.add(this.groupe);
    this.porte = new THREE.Group();
    this.scene.add(this.porte);
  }

  _monterNiveau(i) {
    this.niveau = i;
    this.niveauData = this.plan.niveaux[i];
    this.collisions = [];
    this._selectionner(null);
    this.personnages = [];
    this.objetsParCle = new Map();
    this.lumieresNuit = [];
    this.ampoules = [];
    this.cheminees = [];
    this.groupe.clear();
    this.pieces = this.niveauData.pieces;
    this.W = this.niveauData.largeur;
    this.D = this.niveauData.profondeur;
    // socle + niveau
    const g = construireNiveau(this.niveauData, this.M, { collisions: this.collisions, identite: this.identite });
    this.groupe.add(g);
    // plafond : masqué en maquette / plan
    g.getObjectByName('plafond').visible = this.mode === 'visite';

    // départ du joueur : centre du séjour, jamais collé à une cloison
    const entree = this.pieces.find(p => p.type === 'entree') || this.pieces[0];
    const sejour = this.pieces.find(p => p.type === 'sejour') || entree;
    this.joueur.x = sejour.x + sejour.w / 2;
    this.joueur.z = sejour.z + sejour.d / 2;
    this.joueur.yaw = 0;
    this.joueur.pitch = -0.02;
    this.angles.r = Math.max(this.W, this.D) * 1.75;
    this.angles.theta = Math.PI * 0.25;
    this.angles.phi = 0.82;
    this.elNomNiveau.textContent = this.niveauData.nom;
    this.elSurface.textContent = `${Math.round(this.niveauData.surface)} m² · ${this.niveauData.pieces.length} pièces`;
    if (this.elIdentite) this.elIdentite.textContent = `${this.identite.nom} · ${this.identite.resume}`;
    this.racine.querySelectorAll('[data-niveau]').forEach(b => {
      b.classList.toggle('actif', +b.dataset.niveau === i);
    });
    this.deco = new THREE.Group();
    this.deco.name = 'decoration';
    this.groupe.add(this.deco);
    this.personnagesGroupe = new THREE.Group();
    this.personnagesGroupe.name = 'personnes';
    this.groupe.add(this.personnagesGroupe);
    this._peupler();
    this._repeuplerPersonnes();
    this._construireLumieresNuit();
    this._dessinerPlan();
    this._majHUD();
    this._majBoutons();
  }

  _pieceDe(types) {
    const dispo = this.pieces.filter(p => types.includes(p.type) && p.w > 1.3 && p.d > 1.3);
    return dispo.sort((a, b) => b.w * b.d - a.w * a.d)[0]
      || this.pieces.filter(p => !['sdb', 'wc', 'escalier', 'palier', 'terrasse'].includes(p.type))
        .sort((a, b) => b.w * b.d - a.w * a.d)[0]
      || null;
  }

  _peupler() {
    if (!this.deco) return;
    this._selectionner(null);
    this.deco.clear();
    this.objetsParCle = new Map();
    this.ampoules = [];
    this.cheminees = [];
    const sejour = this._pieceDe(['sejour']);
    const cuisine = this._pieceDe(['cuisine']);
    const bureau = this._pieceDe(['bureau']);
    const chambre = this._pieceDe(['chambre', 'suite']);
    const entree = this._pieceDe(['entree']);
    this._indexParCle = new Map();
    const ajouter = (cle, piece) => {
      if (!piece) return;
      const gs = creerEquipement(cle, piece, this.M, this.identite, this._indexParCle.get(cle) || 0);
      gs.forEach(g => {
        const idx = this._indexParCle.get(cle) || 0;
        this._indexParCle.set(cle, idx + 1);
        const uid = `n${this.niveau}-${cle}-${idx}`;
        g.userData.uid = uid;
        if (this.supprimes.has(uid)) return;
        const p = this.positions[uid];
        if (p) {
          g.position.x = clamp(p.x, 0.25, this.W - 0.25);
          g.position.z = clamp(p.z, 0.25, this.D - 0.25);
          g.rotation.y = p.ry || 0;
        }
        g.traverse(o => {
          if (!o.isMesh) return;
          o.castShadow = true; o.receiveShadow = true;
          if (o.userData.ampoule) this.ampoules.push(o);
          if (o.userData.cheminee) this.cheminees.push(o);
        });
        this.deco.add(g);
        if (!this.objetsParCle.has(cle)) this.objetsParCle.set(cle, []);
        this.objetsParCle.get(cle).push(g);
      });
    };

    if (this.equipements.tv) ajouter('tv', sejour);
    if (this.equipements.biblio) ajouter('biblio', bureau || sejour);
    if (this.equipements.bureau) ajouter('bureau', bureau || sejour);
    if (this.equipements.table) ajouter('table', cuisine || sejour);
    if (this.equipements.plantes) {
      ajouter('plantes', sejour);
      if (entree && entree !== sejour) ajouter('plantes', entree);
    }
    if (this.equipements.tableaux) ajouter('tableaux', sejour);
    if (this.equipements.tapis) ajouter('tapis', entree || chambre || sejour);
    if (this.equipements.luminaires) ajouter('luminaires', sejour);
    this._construireLumieresNuit();
  }

  _basculerEquipement(cle) {
    this._memoriserPositions();
    this.equipements[cle] = !this.equipements[cle];
    if (this.equipements[cle]) {
      const prefixe = `n${this.niveau}-${cle}-`;
      [...this.supprimes].forEach(uid => { if (uid.startsWith(prefixe)) this.supprimes.delete(uid); });
    }
    this._peupler();
    this._majBoutons();
    this._sauvegarder();
  }

  _repeuplerPersonnes() {
    if (!this.personnagesGroupe) return;
    this.personnagesGroupe.clear();
    this.personnages = [];
    if (!this.personnes) return;
    const sejour = this._pieceDe(['sejour']);
    const cuisine = this._pieceDe(['cuisine']);
    const chambre = this._pieceDe(['chambre', 'suite']);
    const entree = this._pieceDe(['entree']);
    const lieux = [];
    if (sejour) {
      lieux.push({ piece: sejour, fx: 0.3, fz: 0.32, echelle: 1.02 });
      if (sejour.w * sejour.d > 15) lieux.push({ piece: sejour, fx: 0.7, fz: 0.25, echelle: 0.98 });
    }
    if (cuisine) lieux.push({ piece: cuisine, fx: 0.5, fz: 0.55, echelle: 0.97 });
    if (chambre) lieux.push({ piece: chambre, fx: 0.66, fz: 0.62, echelle: 0.96 });
    if (entree) lieux.push({ piece: entree, fx: 0.5, fz: 0.5, echelle: 0.64 });
    lieux.slice(0, 5).forEach((l, i) => {
      const p = l.piece;
      const g = creerPersonnage({
        pose: 'debout',
        echelle: l.echelle,
        seed: this.identite.graine + i * 41,
        palette: this.identite.palette
      });
      g.position.set(
        clamp(p.x + p.w * l.fx, p.x + 0.3, p.x + p.w - 0.3),
        0,
        clamp(p.z + p.d * l.fz, p.z + 0.3, p.z + p.d - 0.3)
      );
      g.rotation.y = (i * 1.9 + this.identite.graine % 7) % (Math.PI * 2);
      g.userData.baseY = 0;
      this.personnagesGroupe.add(g);
      this.personnages.push(g);
    });
  }

  _basculerPersonnes() {
    this.personnes = !this.personnes;
    this._repeuplerPersonnes();
    this._majBoutons();
    this._sauvegarder();
  }

  _construireLumieresNuit() {
    this.lumieresNuit?.forEach(l => {
      l.parent?.remove(l);
      if (l.isMesh) {
        l.geometry?.dispose();
        l.material?.dispose();
      }
    });
    this.lumieresNuit = [];
    if (!this.nuit || !this.groupe) return;
    const pieces = this.pieces
      .filter(p => ['sejour', 'cuisine', 'chambre', 'suite', 'entree', 'bureau'].includes(p.type) && p.w * p.d > 4)
      .sort((a, b) => b.w * b.d - a.w * a.d)
      .slice(0, 5);
    const matLanterne = new THREE.MeshStandardMaterial({
      color: 0xFFE3B0, emissive: 0xFFC06A, emissiveIntensity: 2.4,
      roughness: 0.5, metalness: 0
    });
    const ajouterLumiere = (x, y, z, intensite, distance) => {
      const l = new THREE.PointLight(0xFFC98A, intensite, distance, 2);
      l.position.set(x, y, z);
      l.castShadow = false;
      this.groupe.add(l);
      this.lumieresNuit.push(l);
      const lanterne = new THREE.Mesh(new THREE.SphereGeometry(0.105, 10, 8), matLanterne);
      lanterne.position.set(x, y, z);
      this.groupe.add(lanterne);
      this.lumieresNuit.push(lanterne);
    };
    pieces.forEach(p => {
      ajouterLumiere(p.x + p.w / 2, H_MUR - 0.32, p.z + p.d / 2, 10.5, 6.2);
    });
    // deux fanaux dehors : on lit la terrasse et l'entrée même sans lune
    ajouterLumiere(this.W / 2, 2.15, this.D + 3.15, 7.5, 7.4);
    ajouterLumiere(1.8, 1.85, this.D + 1.55, 5.2, 5.8);
  }

  _construireExterieur() {
    this.habillage.clear();
    this.lampesExt.clear();
    const id = this.identite;
    const W = this.plan.niveaux[0].largeur, D = this.plan.niveaux[0].profondeur;
    const r = rng(id.graine ^ 0x9E3779B9);

    const solMat = this.M.solExt.clone();
    if (solMat.map) {
      solMat.map = solMat.map.clone();
      solMat.map.repeat.set(16, 16);
      solMat.map.needsUpdate = true;
    }
    const terrain = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), solMat);
    terrain.rotation.x = -Math.PI / 2;
    terrain.position.set(W / 2, -0.2, D / 2);
    terrain.receiveShadow = true;
    this.habillage.add(terrain);

    // allée / cour d'entrée
    const allee = boite(1.9, 0.05, 7, this.M.dalle, W / 2, -0.16, D + 3.4);
    allee.receiveShadow = true;
    this.habillage.add(allee);

    // terrasse ou cour, toujours côté jardin
    const deckW = Math.min(8.5, Math.max(4.8, W * 0.72));
    const deckD = 4.0;
    const deck = boite(deckW, 0.1, deckD, id.style === 'urbain' || id.style === 'haussmannien' ? this.M.pavage : this.M.bois, W / 2, 0.02, D + 2.2);
    deck.receiveShadow = true;
    this.habillage.add(deck);
    if (id.style === 'mediterraneen' || id.style === 'tropique' || id.style === 'provencal') {
      // pergola
      for (const s of [-1, 1]) {
        this.habillage.add(cylindre(0.07, 0.09, 2.5, 8, this.M.bois, W / 2 + s * deckW * 0.42, 1.25, D + deckD * 0.5 + 0.2));
        this.habillage.add(cylindre(0.07, 0.09, 2.5, 8, this.M.bois, W / 2 + s * deckW * 0.42, 1.25, D + 3.9));
      }
      for (let k = 0; k < 8; k++) {
        this.habillage.add(boite(deckW * 0.9, 0.06, 0.1, this.M.bois, W / 2, 2.5, D + 2.4 + k * 0.24));
      }
    }
    for (let k = 0; k < 3; k++) {
      const x = W / 2 - deckW * 0.32 + k * deckW * 0.32;
      this.habillage.add(boite(0.46, 0.06, 0.46, this.M.bois, x, 0.4, D + 2.4));
      this.habillage.add(boite(0.46, 0.4, 0.05, this.M.bois, x, 0.62, D + 2.2));
      this.habillage.add(cylindre(0.03, 0.03, 0.38, 6, this.M.metalNoir, x, 0.19, D + 2.4));
    }

    // bassin : uniquement là où le climat et la parcelle le justifient
    if (id.nature.eau) {
      const px = W + 5.4, pz = D * 0.48;
      const bassin = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 3.6), this.M.eau);
      bassin.rotation.x = -Math.PI / 2;
      bassin.position.set(px, -0.08, pz);
      this.habillage.add(bassin);
      this.habillage.add(boite(7.9, 0.14, 0.22, this.M.pierre, px, 0.0, pz - 1.9));
      this.habillage.add(boite(7.9, 0.14, 0.22, this.M.pierre, px, 0.0, pz + 1.9));
      this.habillage.add(boite(0.22, 0.14, 3.8, this.M.pierre, px - 3.9, 0.0, pz));
      this.habillage.add(boite(0.22, 0.14, 3.8, this.M.pierre, px + 3.9, 0.0, pz));
      for (let k = 0; k < 3; k++) {
        const ch = boite(0.42, 0.06, 1.7, this.M.bois, px - 2.4 + k * 1.2, 0.42, pz + 2.9);
        this.habillage.add(ch);
        this.habillage.add(cylindre(0.03, 0.03, 0.42, 6, this.M.metalNoir, px - 2.4 + k * 1.2, 0.21, pz + 2.15));
      }
    }

    // végétation régionale, en couronne
    const especes = id.nature.especes;
    const nb = id.nature.densite;
    for (let i = 0; i < nb; i++) {
      const a = r() * Math.PI * 2;
      const rad = 10 + r() * 27;
      const x = W / 2 + Math.cos(a) * rad;
      const z = D / 2 + Math.sin(a) * rad * 0.8;
      if (Math.abs(x - W / 2) < W * 0.6 + 3 && Math.abs(z - D / 2) < D * 0.65 + 4) continue;
      if (id.nature.eau && x > W + 1.5 && x < W + 9.5 && Math.abs(z - D * 0.48) < 4) continue;
      const espece = especes[i % especes.length];
      const echelle = (espece === 'oyat' || espece === 'buis' ? 0.7 : 0.85) + r() * 0.7;
      const t = creerArbre(espece, echelle, r, this.M);
      t.position.set(x, -0.2, z);
      t.rotation.y = r() * Math.PI * 2;
      this.habillage.add(t);
    }
    // massifs et pierres
    for (let i = 0; i < 9; i++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3 + r() * 0.35, 0), i % 2 ? this.M.vegetal : this.M.vegetalSombre);
      b.position.set(W / 2 + (r() - 0.5) * (W + 12), 0.05, D / 2 + (r() - 0.5) * (D + 10));
      b.castShadow = true;
      this.habillage.add(b);
    }
    if (id.nature.neige) {
      for (let i = 0; i < 12; i++) {
        const n = new THREE.Mesh(new THREE.CircleGeometry(0.7 + r() * 1.3, 9), this.M.neige);
        n.rotation.x = -Math.PI / 2;
        n.position.set(W / 2 + (r() - 0.5) * (W + 20), -0.18, D / 2 + (r() - 0.5) * (D + 18));
        this.habillage.add(n);
      }
    }

    // guirlande de terrasse, allumée la nuit
    const fil = new THREE.MeshStandardMaterial({ color: 0xFFF0C8, emissive: 0xFFD49A, emissiveIntensity: 1.8, roughness: 0.7 });
    for (let i = 0; i < 9; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), fil);
      l.position.set(W / 2 - deckW / 2 + i * (deckW / 8), 2.35, D + 2.25);
      this.lampesExt.add(l);
    }
    this.lampesExt.visible = this.nuit;
  }

  _appliquerNuit() {
    if (!this.scene) return;
    this.scene.background = this.nuit ? this.cielNuit : this.cielJour;
    this.scene.fog.color.setHex(this.nuit ? 0x0A1322 : 0xDFECFF);
    this.scene.fog.near = this.nuit ? 16 : 40;
    this.scene.fog.far = this.nuit ? 92 : 120;
    this.hemisphere.intensity = this.nuit ? 0.44 : 1.15;
    this.hemisphere.color.setHex(this.nuit ? 0x31496B : 0xEAF3FF);
    this.hemisphere.groundColor.setHex(this.nuit ? 0x1A2029 : 0xB9AE99);
    this.soleil.intensity = this.nuit ? 0.82 : 2.1;
    this.soleil.color.setHex(this.nuit ? 0x9DB7E8 : 0xFFF3DC);
    this.renderer.toneMappingExposure = this.nuit ? 1.08 : 1.05;
    this.lumiereInterieure.intensity = this.nuit ? 14 : 18;
    this.M.verre.emissive.setHex(this.nuit ? 0xFFD9A0 : 0x000000);
    this.M.verre.emissiveIntensity = this.nuit ? 0.42 : 0;
    this.M.eau.emissive.setHex(this.nuit ? 0x1D5C70 : 0x000000);
    this.M.eau.emissiveIntensity = this.nuit ? 0.5 : 0;
    this.ampoules.forEach(o => {
      if (o.material?.emissive) {
        o.material.emissive.setHex(this.nuit ? 0xFFD69A : 0x000000);
        o.material.emissiveIntensity = this.nuit ? 1.6 : 0;
      }
    });
    this.cheminees.forEach(o => {
      if (o.material?.emissive) {
        o.material.emissive.setHex(this.nuit ? 0xFF7A2E : 0x000000);
        o.material.emissiveIntensity = this.nuit ? 1.1 : 0;
      }
    });
    if (this.lampesExt) this.lampesExt.visible = this.nuit;
    this._construireLumieresNuit();
    this.el?.classList.toggle('nuit', this.nuit);
    this._majBoutons();
  }

  _basculerNuit() {
    this.nuit = !this.nuit;
    this._appliquerNuit();
    this._sauvegarder();
  }

  _basculerPanneau(force) {
    this.panneauOuvert = force === undefined ? !this.panneauOuvert : !!force;
    if (this.panneauOuvert) this.setMode('maquette');
    if (this.elPanneau) this.elPanneau.hidden = !this.panneauOuvert;
    const b = this.racine.querySelector('.v3d-amenager');
    if (b) b.setAttribute('aria-pressed', String(this.panneauOuvert));
  }

  _majBoutons() {
    if (!this.el) return;
    this.racine.querySelectorAll('[data-equip]').forEach(b => {
      const on = !!this.equipements[b.dataset.equip];
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('actif', on);
    });
    this.racine.querySelectorAll('[data-amb="nuit"], .v3d-nuit').forEach(b => {
      b.setAttribute('aria-pressed', String(this.nuit));
      b.classList.toggle('actif', this.nuit);
    });
    this.racine.querySelectorAll('[data-amb="personnes"]').forEach(b => {
      b.setAttribute('aria-pressed', String(this.personnes));
      b.classList.toggle('actif', this.personnes);
    });
    this.racine.querySelector('.v3d-amenager')?.setAttribute('aria-pressed', String(this.panneauOuvert));
  }

  _reinitialiser() {
    try { localStorage.removeItem(`havre.maquette.${this.bien.id}`); } catch { /* rien */ }
    this.positions = {};
    this.supprimes = new Set();
    this.equipements = { ...this.identite.equipements };
    this.nuit = false;
    this.personnes = false;
    this._peupler();
    this._repeuplerPersonnes();
    this._appliquerNuit();
    this._majBoutons();
  }

  _pickerObjet(e) {
    const r = this.canvas.getBoundingClientRect();
    const p = new THREE.Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1
    );
    this.raycaster.setFromCamera(p, this.camera);
    const hits = this.raycaster.intersectObjects(this.deco?.children || [], true);
    for (const h of hits) {
      let o = h.object;
      while (o && o !== this.deco) {
        if (o.userData?.selectable) return o;
        o = o.parent;
      }
    }
    return null;
  }

  _pointSol(e) {
    const r = this.canvas.getBoundingClientRect();
    const p = new THREE.Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1
    );
    this.raycaster.setFromCamera(p, this.camera);
    const pt = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.planSol, pt) ? pt : null;
  }

  _selectionner(obj) {
    if (this.selectionBox) {
      this.scene.remove(this.selectionBox);
      this.selectionBox.geometry?.dispose();
      this.selectionBox.material?.dispose();
      this.selectionBox = null;
    }
    this.selection = obj || null;
    if (obj) {
      this.selectionBox = new THREE.BoxHelper(obj, 0x7FB2FF);
      this.selectionBox.material.depthTest = false;
      this.selectionBox.material.transparent = true;
      this.selectionBox.material.opacity = 0.95;
      this.scene.add(this.selectionBox);
    }
    if (this.elSelection) this.elSelection.hidden = !obj;
    if (obj && this.elSelectionNom) {
      const noms = { tv: 'Télévision', biblio: 'Bibliothèque', bureau: 'Bureau', table: 'Table', plantes: 'Plante', tableaux: 'Tableau', tapis: 'Tapis', luminaires: 'Luminaire' };
      this.elSelectionNom.textContent = noms[obj.userData.cle] || 'Objet';
    }
  }

  _majAide() {
    if (this.selectionBox) this.selectionBox.update();
  }

  _pivoterSelection(delta) {
    if (!this.selection) return;
    this.selection.rotation.y += delta;
    this._majAide();
    this._sauvegarder();
  }

  _deplacerSelection(dx, dz) {
    if (!this.selection) return;
    this.selection.position.x = clamp(this.selection.position.x + dx, 0.25, this.W - 0.25);
    this.selection.position.z = clamp(this.selection.position.z + dz, 0.25, this.D - 0.25);
    this._majAide();
    this._sauvegarder();
  }

  _supprimerSelection() {
    if (!this.selection) return;
    const g = this.selection;
    const cle = g.userData.cle;
    const uid = g.userData.uid;
    this._selectionner(null);
    g.parent?.remove(g);
    const arr = this.objetsParCle.get(cle) || [];
    this.objetsParCle.set(cle, arr.filter(x => x !== g));
    delete this.positions[uid];
    this.supprimes.add(uid);
    if (!this.objetsParCle.get(cle).length) this.equipements[cle] = false;
    this._majBoutons();
    this._sauvegarder();
  }

  _dessinerPlan() {
    this.elPlan.innerHTML = planSVG(this.plan, { niveau: this.niveau, largeur: 1100 });
  }

  setMode(m) {
    this.mode = m;
    if (m !== 'maquette' && this.panneauOuvert) this._basculerPanneau(false);
    this.racine.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('actif', b.dataset.mode === m));
    this.elPlan.hidden = m !== 'plan';
    this.el.classList.toggle('mode-plan', m === 'plan');
    this.el.classList.toggle('mode-maquette', m === 'maquette');
    const plafond = this.groupe.getObjectByName('plafond');
    if (plafond) plafond.visible = m === 'visite';
    this.racine.querySelectorAll('.v3d-mini,.v3d-hud,.v3d-aide,.v3d-joystick,.v3d-astuce').forEach(e => {
      e.style.display = m === 'visite' ? '' : 'none';
    });
    if (m !== 'visite') {
      this.el.classList.remove('actif');
    }
    if (m === 'maquette') {
      this.angles.phi = 0.85;
      this.angles.r = Math.max(this.W, this.D) * 1.9;
    }
    if (m === 'plan') {
      this.elPlan.scrollTop = 0;
    }
    if (m !== 'maquette') this._selectionner(null);
  }

  _evenements() {
    const el = this.el;
    el.querySelector('.v3d-fermer').addEventListener('click', () => this.fermer());
    el.querySelector('.v3d-plein').addEventListener('click', () => {
      if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
      else document.exitFullscreen?.();
    });
    el.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => this.setMode(b.dataset.mode)));
    el.querySelectorAll('[data-niveau]').forEach(b => b.addEventListener('click', () => this._monterNiveau(+b.dataset.niveau)));
    el.querySelector('.v3d-nuit').addEventListener('click', () => this._basculerNuit());
    el.querySelector('.v3d-amenager').addEventListener('click', () => this._basculerPanneau());
    el.querySelector('.vp-fermer').addEventListener('click', () => this._basculerPanneau(false));
    el.querySelectorAll('[data-amb="nuit"]').forEach(b => b.addEventListener('click', () => this._basculerNuit()));
    el.querySelectorAll('[data-amb="personnes"]').forEach(b => b.addEventListener('click', () => this._basculerPersonnes()));
    el.querySelectorAll('[data-equip]').forEach(b => b.addEventListener('click', () => this._basculerEquipement(b.dataset.equip)));
    el.querySelectorAll('[data-sel]').forEach(b => b.addEventListener('click', () => {
      const a = b.dataset.sel;
      if (a === 'gauche') this._pivoterSelection(Math.PI / 6);
      else if (a === 'droite') this._pivoterSelection(-Math.PI / 6);
      else if (a === 'supprimer') this._supprimerSelection();
      else this._selectionner(null);
    }));
    el.querySelector('[data-reset]').addEventListener('click', () => this._reinitialiser());

    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.mode === 'plan') return;
      if (this.mode === 'maquette' && e.button === 0) {
        const obj = this._pickerObjet(e);
        if (obj) {
          this._selectionner(obj);
          const pt = this._pointSol(e);
          this.pointers.set(e.pointerId, {
            type: 'objet',
            x: e.clientX, y: e.clientY,
            obj,
            offset: pt ? new THREE.Vector3(obj.position.x - pt.x, 0, obj.position.z - pt.z) : new THREE.Vector3()
          });
          this.canvas.setPointerCapture(e.pointerId);
          this.el.classList.add('actif');
          this.elAstuce.classList.add('cache');
          return;
        }
        if (this.selection) this._selectionner(null);
      }
      this.canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
      this.el.classList.add('actif');
      this.elAstuce.classList.add('cache');
    });
    this.canvas.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      if (p.type === 'objet') {
        const pt = this._pointSol(e);
        if (pt && this.selection) {
          this.selection.position.x = clamp(pt.x + p.offset.x, 0.25, this.W - 0.25);
          this.selection.position.z = clamp(pt.z + p.offset.z, 0.25, this.D - 0.25);
          this._majAide();
        }
        p.x = e.clientX; p.y = e.clientY;
        return;
      }
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (this.mode === 'visite') {
        this.joueur.yaw -= dx * 0.0032;
        this.joueur.pitch = clamp(this.joueur.pitch - dy * 0.0026, -1.15, 0.95);
      } else if (this.mode === 'maquette') {
        this.angles.theta -= dx * 0.007;
        this.angles.phi = clamp(this.angles.phi + dy * 0.005, 0.22, 1.35);
      }
    });
    const fin = (e) => {
      const p = this.pointers.get(e.pointerId);
      if (p?.type === 'objet') this._sauvegarder();
      this.pointers.delete(e.pointerId);
    };
    this.canvas.addEventListener('pointerup', fin);
    this.canvas.addEventListener('pointercancel', fin);
    this.canvas.addEventListener('wheel', (e) => {
      if (this.mode !== 'maquette') return;
      e.preventDefault();
      this.angles.r = clamp(this.angles.r * (1 + e.deltaY * 0.0011), 8, 90);
    }, { passive: false });

    this._clavier = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        this._basculerNuit();
        e.preventDefault();
        return;
      }
      if (this.mode === 'maquette') {
        if (k === 'escape') { this._selectionner(null); return; }
        if (!this.selection) return;
        const step = e.shiftKey ? 0.35 : 0.12;
        if (k === 'arrowleft') { this._deplacerSelection(-step, 0); e.preventDefault(); }
        else if (k === 'arrowright') { this._deplacerSelection(step, 0); e.preventDefault(); }
        else if (k === 'arrowup') { this._deplacerSelection(0, -step); e.preventDefault(); }
        else if (k === 'arrowdown') { this._deplacerSelection(0, step); e.preventDefault(); }
        else if (k === 'r') { this._pivoterSelection(e.shiftKey ? Math.PI / 4 : Math.PI / 12); e.preventDefault(); }
        else if (k === 'delete' || k === 'backspace') { this._supprimerSelection(); e.preventDefault(); }
        return;
      }
      if (this.mode !== 'visite') return;
      if (['z', 'w', 'q', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) {
        this.touches.add(k);
        if (!['shift'].includes(k)) e.preventDefault();
      }
      if (k === 'escape' && this.pointers.size) { this.pointers.clear(); }
    };
    this._clavierUp = (e) => this.touches.delete(e.key.toLowerCase());
    window.addEventListener('keydown', this._clavier);
    window.addEventListener('keyup', this._clavierUp);

    // joystick tactile
    this._joy = { actif: false, x: 0, y: 0 };
    const stick = this.joystick;
    stick.addEventListener('pointerdown', (e) => {
      stick.setPointerCapture(e.pointerId);
      this._joy.actif = true; this._majStick(e, stick);
      e.stopPropagation();
    });
    stick.addEventListener('pointermove', (e) => {
      if (!this._joy.actif) return;
      this._majStick(e, stick);
      e.stopPropagation();
    });
    const stop = (e) => { this._joy.actif = false; this._joy.x = this._joy.y = 0; stick.querySelector('i').style.transform = ''; };
    stick.addEventListener('pointerup', stop);
    stick.addEventListener('pointercancel', stop);

    this._resize = () => this._dimensionner();
    window.addEventListener('resize', this._resize);
    this._dimensionner();
  }

  _majStick(e, stick) {
    const r = stick.getBoundingClientRect();
    const dx = clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2), -1, 1);
    const dy = clamp((e.clientY - (r.top + r.height / 2)) / (r.height / 2), -1, 1);
    this._joy.x = dx; this._joy.y = dy;
    stick.querySelector('i').style.transform = `translate(${dx * r.width * 0.28}px, ${dy * r.height * 0.28}px)`;
    this.el.classList.add('actif');
    this.elAstuce.classList.add('cache');
  }

  _dimensionner() {
    const r = this.el.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  _majHUD() {
    const p = this.joueur;
    const piece = this.pieces.find(x => p.x >= x.x && p.x <= x.x + x.w && p.z >= x.z && p.z <= x.z + x.d);
    if (piece) {
      this.elPiece.textContent = piece.nom;
      this.elPiece.dataset.type = piece.type;
    }
    // minimap
    const c = this.elMini;
    if (!c) return;
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    const pad = 12;
    const s = Math.min((W - pad * 2) / this.W, (H - pad * 2) / this.D);
    const ox = (W - this.W * s) / 2, oz = (H - this.D * s) / 2;
    ctx.fillStyle = 'rgba(255,255,255,.86)';
    ctx.fillRect(0, 0, W, H);
    this.pieces.forEach(pc => {
      ctx.fillStyle = pc.couleur;
      ctx.fillRect(ox + pc.x * s, oz + pc.z * s, pc.w * s, pc.d * s);
    });
    ctx.strokeStyle = '#26303F'; ctx.lineWidth = 3;
    this.niveauData.murs.forEach(m => {
      const { solides } = decouperMur(m, H_MUR);
      const L = Math.hypot(m.x2 - m.x1, m.z2 - m.z1);
      const ux = (m.x2 - m.x1) / L, uz = (m.z2 - m.z1) / L;
      solides.forEach(([a, b]) => {
        ctx.beginPath();
        ctx.moveTo(ox + (m.x1 + ux * a) * s, oz + (m.z1 + uz * a) * s);
        ctx.lineTo(ox + (m.x1 + ux * b) * s, oz + (m.z1 + uz * b) * s);
        ctx.stroke();
      });
    });
    // joueur
    const px = ox + this.joueur.x * s, pz = oz + this.joueur.z * s;
    const dirx = Math.sin(this.joueur.yaw) * -1, dirz = Math.cos(this.joueur.yaw) * -1;
    ctx.fillStyle = '#1B2433';
    ctx.beginPath();
    ctx.moveTo(px + dirx * 11, pz + dirz * 11);
    ctx.lineTo(px - dirz * 5.5 - dirx * 4, pz + dirx * 5.5 - dirz * 4);
    ctx.lineTo(px + dirz * 5.5 - dirx * 4, pz - dirx * 5.5 - dirz * 4);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(27,36,51,.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px, pz, 13, 0, Math.PI * 2); ctx.stroke();
  }

  _collision(x, z) {
    for (const c of this.collisions) {
      if (c.porte || c.ep <= 0) continue;
      const dx = c.x2 - c.x1, dz = c.z2 - c.z1;
      const l2 = dx * dx + dz * dz;
      if (l2 < 1e-6) continue;
      let t = ((x - c.x1) * dx + (z - c.z1) * dz) / l2;
      t = clamp(t, 0, 1);
      const qx = c.x1 + dx * t, qz = c.z1 + dz * t;
      const ex = x - qx, ez = z - qz;
      const dist = Math.hypot(ex, ez);
      const mini = R_JEU + c.ep / 2;
      if (dist < mini && dist > 1e-5) {
        x = qx + (ex / dist) * mini;
        z = qz + (ez / dist) * mini;
      }
    }
    return [x, z];
  }

  _marcher(dt) {
    const j = this.joueur;
    let av = 0, cote = 0;
    if (this.touches.has('w') || this.touches.has('z') || this.touches.has('arrowup')) av += 1;
    if (this.touches.has('s') || this.touches.has('arrowdown')) av -= 1;
    if (this.touches.has('a') || this.touches.has('q') || this.touches.has('arrowleft')) cote -= 1;
    if (this.touches.has('d') || this.touches.has('arrowright')) cote += 1;
    if (this._joy.actif) { av -= this._joy.y; cote += this._joy.x; }
    const len = Math.hypot(av, cote);
    if (len > 0.02) {
      av /= Math.max(1, len); cote /= Math.max(1, len);
      const v = this.vitesse * (this.touches.has('shift') ? 1.9 : 1) * dt;
      const sin = Math.sin(j.yaw), cos = Math.cos(j.yaw);
      // yaw 0 regarde vers -z
      let nx = j.x + (-sin * av + cos * cote) * v;
      let nz = j.z + (-cos * av - sin * cote) * v;
      // on résout d'abord X (le retour en Z ne doit pas écraser l'avancée), puis le point complet
      [nx] = this._collision(nx, j.z);
      [nx, nz] = this._collision(nx, nz);
      j.x = nx; j.z = nz;
    }
    this.camera.position.set(j.x, 1.64, j.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = j.yaw;
    this.camera.rotation.x = j.pitch;
  }

  _cadrerMaquette() {
    const a = this.angles;
    const cx = this.W / 2, cz = this.D / 2;
    const x = cx + Math.sin(a.theta) * Math.cos(a.phi) * a.r;
    const z = cz + Math.cos(a.theta) * Math.cos(a.phi) * a.r;
    const y = 1.2 + Math.sin(a.phi) * a.r * 0.9;
    this.camera.position.set(x, y, z);
    this.camera.lookAt(cx, 1.1, cz);
  }

  _boucle() {
    if (this.detruit) return;
    const maintenant = performance.now();
    const dt = Math.min(0.05, (maintenant - this.derniere) / 1000);
    this.derniere = maintenant;
    if (this.mode === 'visite') {
      this._marcher(dt);
      this.lumiereInterieure.position.set(this.joueur.x, 2.4, this.joueur.z);
      this._majHUD();
    } else if (this.mode === 'maquette') {
      this._cadrerMaquette();
    }
    if (!this.reduit && this.personnages?.length) {
      const t = maintenant / 1000;
      this.personnages.forEach((p, i) => {
        p.rotation.z = Math.sin(t * 0.55 + p.userData.phase) * p.userData.balance;
        p.position.y = (p.userData.baseY || 0) + Math.sin(t * 0.9 + p.userData.phase) * 0.006;
        p.rotation.x = Math.sin(t * 0.35 + i) * 0.008;
      });
    }
    if (this.selectionBox) this.selectionBox.update();
    this.renderer.render(this.scene, this.camera);
    this.nbFrames++;
    this._raf = requestAnimationFrame(() => this._boucle());
  }

  fermer() {
    this.detruit = true;
    cancelAnimationFrame(this._raf);
    window.removeEventListener('keydown', this._clavier);
    window.removeEventListener('keyup', this._clavierUp);
    window.removeEventListener('resize', this._resize);
    if (window.__visite3d === this) window.__visite3d = null;
    this.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
      }
    });
    this.renderer.dispose();
    this.racine.innerHTML = '';
    this.racine.dispatchEvent(new CustomEvent('v3d-fermer'));
  }
}

/* ══════════════════════════════════════════════════════════════════
   DÉTECTEUR DE PLAN (image ou SVG) → jeu de murs
   ══════════════════════════════════════════════════════════════════ */

/** dessine un plan "papier" sur un canvas (pour les exemples et l'export) */
export function dessinerPlanCanvas(plan, niveauIdx, ctx, largeur, hauteur, opts = {}) {
  const n = plan.niveaux[niveauIdx];
  const marge = 26;
  const s = Math.min((largeur - marge * 2) / n.largeur, (hauteur - marge * 2) / n.profondeur);
  const ox = (largeur - n.largeur * s) / 2, oz = (hauteur - n.profondeur * s) / 2;
  ctx.fillStyle = opts.fond || '#FFFFFF';
  ctx.fillRect(0, 0, largeur, hauteur);
  ctx.strokeStyle = '#111';
  ctx.lineWidth = Math.max(3, Math.round(s * 0.24));
  ctx.lineCap = 'butt';
  n.murs.forEach(m => {
    const { solides } = decouperMur(m, H_MUR);
    const L = Math.hypot(m.x2 - m.x1, m.z2 - m.z1);
    const ux = (m.x2 - m.x1) / L, uz = (m.z2 - m.z1) / L;
    solides.forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(ox + (m.x1 + ux * a) * s, oz + (m.z1 + uz * a) * s);
      ctx.lineTo(ox + (m.x1 + ux * b) * s, oz + (m.z1 + uz * b) * s);
      ctx.stroke();
    });
  });
  return { s, ox, oz, largeurPlan: n.largeur, profondeurPlan: n.profondeur };
}

/** détecte les murs d'une image (fond clair, murs sombres) */
export function analyserImagePlan(image, opts = {}) {
  const seuil = opts.seuil ?? 120;
  const maxDim = opts.maxDim ?? 1100;
  const w0 = image.naturalWidth || image.width;
  const h0 = image.naturalHeight || image.height;
  const echelle = Math.min(1, maxDim / Math.max(w0, h0));
  const w = Math.max(20, Math.round(w0 * echelle));
  const h = Math.max(20, Math.round(h0 * echelle));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const sombre = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    sombre[i] = (a > 40 && lum < seuil) ? 1 : 0;
  }

  // épaisseur de trait dominante : on cherche la bande horizontale la plus fréquente
  const brut = [];
  // segments horizontaux : bandes de lignes sombres consécutives
  const bandes = [];
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      if (!sombre[y * w + x]) { x++; continue; }
      let x2 = x;
      while (x2 + 1 < w && sombre[y * w + x2 + 1]) x2++;
      if (x2 - x + 1 >= Math.max(8, w * 0.02)) bandes.push({ y, x1: x, x2, ep: 1 });
      x = x2 + 1;
    }
  }
  // fusion verticale des bandes superposées → murs horizontaux
  const mursH = [];
  bandes.sort((a, b) => a.y - b.y || a.x1 - b.x1);
  bandes.forEach(b => {
    const cible = mursH.find(m =>
      Math.abs(m.y2 - b.y) <= 2 &&
      Math.min(m.x2, b.x2) - Math.max(m.x1, b.x1) > Math.min(m.x2 - m.x1, b.x2 - b.x1) * 0.6
    );
    if (cible) {
      cible.y2 = b.y;
      cible.x1 = Math.min(cible.x1, b.x1);
      cible.x2 = Math.max(cible.x2, b.x2);
      cible.ep = cible.y2 - cible.y1 + 1;
    } else {
      mursH.push({ y1: b.y, y2: b.y, x1: b.x1, x2: b.x2, ep: 1 });
    }
  });
  // segments verticaux
  const bandesV = [];
  for (let x = 0; x < w; x++) {
    let y = 0;
    while (y < h) {
      if (!sombre[y * w + x]) { y++; continue; }
      let y2 = y;
      while (y2 + 1 < h && sombre[(y2 + 1) * w + x]) y2++;
      if (y2 - y + 1 >= Math.max(8, h * 0.02)) bandesV.push({ x, y1: y, y2 });
      y = y2 + 1;
    }
  }
  const mursV = [];
  bandesV.sort((a, b) => a.x - b.x || a.y1 - b.y1);
  bandesV.forEach(b => {
    const cible = mursV.find(m =>
      Math.abs(m.x2 - b.x) <= 2 &&
      Math.min(m.y2, b.y2) - Math.max(m.y1, b.y1) > Math.min(m.y2 - m.y1, b.y2 - b.y1) * 0.6
    );
    if (cible) {
      cible.x2 = b.x;
      cible.y1 = Math.min(cible.y1, b.y1);
      cible.y2 = Math.max(cible.y2, b.y2);
      cible.ep = cible.x2 - cible.x1 + 1;
    } else {
      mursV.push({ x1: b.x, x2: b.x, y1: b.y1, y2: b.y2, ep: 1 });
    }
  });

  // nettoyage : garder les murs structurants
  const seuilLong = Math.max(14, Math.min(w, h) * 0.055);
  const Hs = mursH.filter(m => (m.x2 - m.x1) >= seuilLong);
  const Vs = mursV.filter(m => (m.y2 - m.y1) >= seuilLong);

  // échelle : largeur détectée → 12 m par défaut (paramétrable)
  const xs = [], ys = [];
  Hs.forEach(m => { xs.push(m.x1, m.x2); ys.push(m.y1, m.y2); });
  Vs.forEach(m => { xs.push(m.x1, m.x2); ys.push(m.y1, m.y2); });
  if (!xs.length) return { vide: true, murs: [], apercu: c, echellePx: 1 };
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const largeurPx = Math.max(20, maxX - minX);
  const cibleMetres = opts.largeurMetres || 12;
  const mParPx = cibleMetres / largeurPx;

  const toM = (x, y) => [+(((x - minX) * mParPx)).toFixed(3), +(((y - minY) * mParPx)).toFixed(3)];
  const murs = [];
  Hs.forEach(m => {
    const [x1, z1] = toM(m.x1, (m.y1 + m.y2) / 2);
    const [x2, z2] = toM(m.x2, (m.y1 + m.y2) / 2);
    murs.push({ x1, z1, x2, z2, ep: Math.max(0.12, m.ep * mParPx), ext: false, ouvertures: [] });
  });
  Vs.forEach(m => {
    const [x1, z1] = toM((m.x1 + m.x2) / 2, m.y1);
    const [x2, z2] = toM((m.x1 + m.x2) / 2, m.y2);
    murs.push({ x1, z1, x2, z2, ep: Math.max(0.12, m.ep * mParPx), ext: false, ouvertures: [] });
  });

  // murs extérieurs = sur la boîte englobante
  const W = (maxX - minX) * mParPx, D = (maxY - minY) * mParPx;
  murs.forEach(m => {
    const sur = (a, b) => Math.abs(a) < 0.25 || Math.abs(a - W) < 0.25 || Math.abs(b) < 0.25 || Math.abs(b - D) < 0.25;
    const hz = Math.abs(m.z1 - m.z2) < 1e-3;
    m.ext = (hz && sur(m.x1, m.z1)) || (!hz && Math.abs(m.x1 - m.x2) < 1e-3 && sur(m.x1, m.z1));
  });

  // pièces par remplissage de la grille libre
  const pieces = deduirePieces(murs, W, D);

  // aperçu : image + murs détectés
  const ap = document.createElement('canvas');
  ap.width = w; ap.height = h;
  const actx = ap.getContext('2d');
  actx.drawImage(image, 0, 0, w, h);
  actx.fillStyle = 'rgba(255,255,255,.55)';
  actx.fillRect(0, 0, w, h);
  actx.strokeStyle = '#E0573C';
  actx.lineWidth = Math.max(2, 3);
  actx.lineCap = 'round';
  murs.forEach(m => {
    actx.beginPath();
    actx.moveTo(minX + m.x1 / mParPx, minY + m.z1 / mParPx);
    actx.lineTo(minX + m.x2 / mParPx, minY + m.z2 / mParPx);
    actx.stroke();
  });
  murs.forEach(m => {
    const x = minX + ((m.x1 + m.x2) / 2) / mParPx, z = minY + ((m.z1 + m.z2) / 2) / mParPx;
    actx.beginPath(); actx.arc(x, z, 2.2, 0, Math.PI * 2); actx.fill();
  });

  return {
    vide: false, murs, pieces,
    largeur: +W.toFixed(2), profondeur: +D.toFixed(2),
    apercu: ap, echellePx: mParPx, bounds: { minX, minY, w, h }
  };
}

/** déduit des pièces rectangulaires par remplissage d'une grille */
function deduirePieces(murs, W, D) {
  const res = 0.24;
  const nx = Math.max(4, Math.ceil(W / res)), nz = Math.max(4, Math.ceil(D / res));
  const occ = new Uint8Array(nx * nz);
  const demi = (m) => Math.max(0.1, m.ep / 2) + 0.04;
  const marquer = (i, j) => { if (i >= 0 && j >= 0 && i < nx && j < nz) occ[j * nx + i] = 1; };
  murs.forEach(m => {
    const d = demi(m);
    const minx = Math.min(m.x1, m.x2) - d, maxx = Math.max(m.x1, m.x2) + d;
    const minz = Math.min(m.z1, m.z2) - d, maxz = Math.max(m.z1, m.z2) + d;
    for (let j = Math.floor(minz / res); j <= Math.ceil(maxz / res); j++) {
      for (let i = Math.floor(minx / res); i <= Math.ceil(maxx / res); i++) if (i >= 0 && j >= 0 && i < nx && j < nz) {
        const px = (i + 0.5) * res, pz = (j + 0.5) * res;
        if (px >= minx && px <= maxx && pz >= minz && pz <= maxz) marquer(i, j);
      }
    }
  });
  const vus = new Uint8Array(nx * nz);
  const pieces = [];
  const pile = [];
  for (let j = 1; j < nz - 1; j++) {
    for (let i = 1; i < nx - 1; i++) {
      if (occ[j * nx + i] || vus[j * nx + i]) continue;
      let minI = i, maxI = i, minJ = j, maxJ = j, n = 0;
      pile.length = 0; pile.push([i, j]); vus[j * nx + i] = 1;
      while (pile.length) {
        const [ci, cj] = pile.pop(); n++;
        minI = Math.min(minI, ci); maxI = Math.max(maxI, ci);
        minJ = Math.min(minJ, cj); maxJ = Math.max(maxJ, cj);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([di, dj]) => {
          const ni = ci + di, nj = cj + dj;
          if (ni < 1 || nj < 1 || ni >= nx - 1 || nj >= nz - 1) return;
          if (occ[nj * nx + ni] || vus[nj * nx + ni]) return;
          vus[nj * nx + ni] = 1; pile.push([ni, nj]);
        });
      }
      if (n * res * res < 3.2) continue;
      const w = (maxI - minI + 1) * res, d = (maxJ - minJ + 1) * res;
      if (w < 1.2 || d < 1.2) continue;
      pieces.push({
        x: +(minI * res).toFixed(2), z: +(minJ * res).toFixed(2),
        w: +w.toFixed(2), d: +d.toFixed(2),
        type: w * d > 22 ? 'sejour' : w * d > 13 ? 'chambre' : 'sdb',
        nom: w * d > 22 ? 'Séjour' : w * d > 13 ? 'Chambre' : 'Salle d’eau',
        couleur: w * d > 22 ? '#F4E9DA' : w * d > 13 ? '#EDE9F7' : '#E4F0F4'
      });
    }
  }
  pieces.sort((a, b) => b.w * b.d - a.w * a.d);
  return pieces.slice(0, 14);
}

/** analyse un SVG (contient rect / line / polyline) */
export function analyserSVGPlan(texte, opts = {}) {
  const doc = new DOMParser().parseFromString(texte, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) return { vide: true, murs: [] };
  const vb = (svg.getAttribute('viewBox') || '0 0 1000 700').split(/[\s,]+/).map(Number);
  const segs = [];
  const pousser = (x1, y1, x2, y2) => {
    if (Math.hypot(x2 - x1, y2 - y1) < 6) return;
    segs.push([x1, y1, x2, y2]);
  };
  doc.querySelectorAll('line').forEach(l => pousser(
    +l.getAttribute('x1'), +l.getAttribute('y1'), +l.getAttribute('x2'), +l.getAttribute('y2')));
  doc.querySelectorAll('rect').forEach(r => {
    const x = +r.getAttribute('x'), y = +r.getAttribute('y'), w = +r.getAttribute('width'), h = +r.getAttribute('height');
    pousser(x, y, x + w, y); pousser(x + w, y, x + w, y + h);
    pousser(x + w, y + h, x, y + h); pousser(x, y + h, x, y);
  });
  doc.querySelectorAll('polyline,polygon,path').forEach(p => {
    let d = p.getAttribute('points') || p.getAttribute('d') || '';
    if (p.tagName.toLowerCase() === 'path') {
      // uniquement les tracés rectilignes
      const nums = d.replace(/[MLHVZmlhvz]/g, ' ').trim().split(/[\s,]+/).map(Number);
      if (!nums.length || d.includes('C') || d.includes('c')) return;
      const pts = [];
      const cmds = d.match(/[MLHVZmlhvz][^MLHVZmlhvz]*/g) || [];
      let x = 0, y = 0;
      cmds.forEach(c => {
        const cmd = c[0];
        const a = c.slice(1).trim().split(/[\s,]+/).filter(Boolean).map(Number);
        if (cmd === 'M' || cmd === 'L') { for (let i = 0; i < a.length; i += 2) { x = a[i]; y = a[i + 1]; pts.push([x, y]); } }
        else if (cmd === 'H') { x = a[0]; pts.push([x, y]); }
        else if (cmd === 'V') { y = a[0]; pts.push([x, y]); }
      });
      for (let i = 1; i < pts.length; i++) pousser(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
    } else {
      const a = d.trim().split(/[\s,]+/).map(Number);
      for (let i = 2; i < a.length; i += 2) pousser(a[i - 2], a[i - 1], a[i], a[i + 1]);
    }
  });
  if (!segs.length) return { vide: true, murs: [] };
  const xs = segs.flatMap(s => [s[0], s[2]]), ys = segs.flatMap(s => [s[1], s[3]]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const largeurPx = Math.max(20, maxX - minX);
  const mParPx = (opts.largeurMetres || 12) / largeurPx;
  const murs = segs.map(([x1, y1, x2, y2]) => ({
    x1: (x1 - minX) * mParPx, z1: (y1 - minY) * mParPx,
    x2: (x2 - minX) * mParPx, z2: (y2 - minY) * mParPx,
    ep: 0.16, ext: false, ouvertures: []
  }));
  const W = (maxX - minX) * mParPx, D = (maxY - minY) * mParPx;
  murs.forEach(m => {
    const hz = Math.abs(m.z1 - m.z2) < 0.02;
    const sur = (v, max) => v < 0.22 || Math.abs(v - max) < 0.22;
    m.ext = hz ? sur(m.z1, D) : sur(m.x1, W);
  });
  const pieces = deduirePieces(murs, W, D);
  return {
    vide: false, murs, pieces,
    largeur: +W.toFixed(2), profondeur: +D.toFixed(2),
    echellePx: mParPx, apercu: null
  };
}

/** assemble un plan complet à partir de murs détectés */
export function planDepuisMurs(murs, W, D, { nom = 'Rez-de-chaussée' } = {}) {
  const pieces = deduirePieces(murs, W, D);
  if (!pieces.length) {
    pieces.push({ x: 0.2, z: 0.2, w: W - 0.4, d: D - 0.4, type: 'sejour', nom: 'Séjour', couleur: '#F4E9DA' });
  }
  return {
    niveaux: [{
      nom, largeur: +W.toFixed(2), profondeur: +D.toFixed(2),
      surface: +(W * D).toFixed(1),
      pieces, murs
    }],
    surface: Math.round(W * D),
    importe: true
  };
}
