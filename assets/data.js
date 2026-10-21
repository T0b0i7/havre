/* ══════════════════════════════════════════════════════════════════
   HAVRE — catalogue, plans, journal
   Les plans sont générés par un moteur déterministe (BSP) : le même
   objet {pieces, murs, ouvertures} alimente le plan 2D ET la maquette 3D.
   ══════════════════════════════════════════════════════════════════ */

const IMG = {
  ext: [
    'photo-1600585154340-be6161a56a0c','photo-1600596542815-ffad4c1539a9',
    'photo-1512917774080-9991f1c4c750','photo-1568605114967-8130f3a36994',
    'photo-1570129477492-45c003edd2be','photo-1580587771525-78b9dba3b914',
    'photo-1583608205776-bfd35f0d9f83','photo-1613490493576-7fde63acd811',
    'photo-1613977257363-707ba9348227','photo-1518780664697-55e3ad937233',
    'photo-1523217582562-09d0def993a6','photo-1564013799919-ab600027ffc6',
    'photo-1567496898669-ee935f5f647a','photo-1605146769289-440113cc3d00',
    'photo-1571508601891-ca5e7a713859','photo-1502005229762-cf1b2da7c5d6',
    'photo-1507089947368-19c1da9775ae','photo-1505873242700-f289a29e1e0f',
    'photo-1449844908441-8829872d2607','photo-1600047509807-ba8f99d2cdde'
  ],
  sejour: [
    'photo-1600607687939-ce8a6c25118c','photo-1600566753086-00f18fb6b3ea',
    'photo-1600210492486-724fe5c67fb0','photo-1600585154526-990dced4db0d',
    'photo-1560448204-e02f11c3d0e2','photo-1522708323590-d24dbb6b0267',
    'photo-1502672260266-1c1ef2d93688','photo-1493809842364-78817add7ffb',
    'photo-1600607687920-4e2a09cf159d','photo-1600607688969-a5bfcd646154',
    'photo-1618221195710-dd6b41faaea6','photo-1618219908412-a29a1bb7b86e',
    'photo-1615529182904-14819c35db37','photo-1598928506311-c55ded91a20c',
    'photo-1521401830884-6c03c1c87ebb','photo-1520607162513-77705c0f0d4a',
    'photo-1560185007-cde436f6a4d0','photo-1560185127-6ed189bf02f4',
    'photo-1605276374104-dee2a0ed3cd6','photo-1600585152220-90363fe7e115',
    'photo-1600573472592-401b489a3cdc','photo-1600607687644-c7171b42498f',
    'photo-1600047509358-9dc75507daeb','photo-1600585152915-d208bec867a1',
    'photo-1616137466211-f939a420be84','photo-1600585153490-76fb20a32601',
    'photo-1600566753151-384129cf4e3e','photo-1600585154363-67eb9e2e2099',
    'photo-1600607688066-890987f18a86','photo-1560184897-ae75f418493e',
    'photo-1501183638710-841dd1904471','photo-1484154218962-a197022b5858',
    'photo-1583845112203-29329902332e','photo-1600566753190-17f0baa2a6c3',
    'photo-1616486338812-3dadae4b4ace','photo-1594026112284-02bb6f3352fe'
  ],
  cuisine: ['photo-1556912173-3bb406ef7e77','photo-1556909212-d5b604d0c90d','photo-1600585154340-be6161a56a0c'],
  chambre: ['photo-1615874959474-d609969a20ed','photo-1505693416388-ac5ce068fe85','photo-1616594039964-ae9021a400a0'],
  bain: ['photo-1584622650111-993a426fbf0a','photo-1560185127-6ed189bf02f4','photo-1600566752355-35792bedcfea'],
  piscine: ['photo-1613977257363-707ba9348227','photo-1600607688960-e095ff83135c','photo-1600607687920-4e2a09cf159d'],
  journal: [
    'photo-1600585154340-be6161a56a0c','photo-1600607687939-ce8a6c25118c',
    'photo-1512917774080-9991f1c4c750','photo-1600566753190-17f0baa2a6c3',
    'photo-1583608205776-bfd35f0d9f83','photo-1600047509358-9dc75507daeb'
  ]
};

export const img = (id, w = 1600) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

/* ── aléatoire déterministe ── */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* ══════════════════════════════════════════════════════════════════
   MOTEUR DE PLAN — découpage binaire de l'espace (BSP)
   Produit : pièces rectangulaires, murs dédupliqués, ouvertures.
   ══════════════════════════════════════════════════════════════════ */
const TYPES_PIECE = {
  sejour: { nom: 'Séjour', couleur: '#F4E9DA' },
  cuisine: { nom: 'Cuisine', couleur: '#E8EFE6' },
  chambre: { nom: 'Chambre', couleur: '#EDE9F7' },
  suite: { nom: 'Suite parentale', couleur: '#E6E9F8' },
  sdb: { nom: 'Salle de bain', couleur: '#E4F0F4' },
  wc: { nom: 'WC', couleur: '#EAEEF3' },
  bureau: { nom: 'Bureau', couleur: '#F3EDE2' },
  entree: { nom: 'Entrée', couleur: '#F1EEE9' },
  escalier: { nom: 'Escalier', couleur: '#E9E4DB' },
  terrasse: { nom: 'Terrasse', couleur: '#E3EDE1' },
  dressing: { nom: 'Dressing', couleur: '#F0EAEA' },
  palier: { nom: 'Palier', couleur: '#F1EEE9' }
};

function decouper(zone, minCote, rnd, pioche) {
  const zones = [zone];
  let garde = 0;
  while (zones.length < pioche && garde++ < 80) {
    // la plus grande zone qui peut encore être coupée
    let idx = -1, aire = 0;
    zones.forEach((z, i) => {
      const a = z.w * z.d;
      const divisible = Math.max(z.w, z.d) > minCote * 2.05;
      if (divisible && a > aire) { aire = a; idx = i; }
    });
    if (idx < 0) break;
    const z = zones.splice(idx, 1)[0];
    const horiz = z.w >= z.d;
    const part = 0.38 + rnd() * 0.24;
    if (horiz) {
      const w1 = z.w * part;
      if (w1 < minCote || z.w - w1 < minCote) { zones.push(z); break; }
      zones.push({ x: z.x, z: z.z, w: w1, d: z.d });
      zones.push({ x: z.x + w1, z: z.z, w: z.w - w1, d: z.d });
    } else {
      const d1 = z.d * part;
      if (d1 < minCote || z.d - d1 < minCote) { zones.push(z); break; }
      zones.push({ x: z.x, z: z.z, w: z.w, d: d1 });
      zones.push({ x: z.x, z: z.z + d1, w: z.w, d: z.d - d1 });
    }
  }
  return zones;
}

function creerNiveau({ nom, surface, chambres, ratio, seed, etage }) {
  const rnd = mulberry32(seed);
  const W = Math.max(7.6, Math.sqrt((surface || 120) / ratio));
  const D = Math.max(6.4, (surface || 120) / W);

  // une villa a plus de pièces qu'un appartement de même surface
  const nb = Math.max(5, Math.min(11, 3 + Math.round(chambres * 1.9 + (etage ? 1.4 : 0.8))));
  const zones = decouper({ x: 0, z: 0, w: W, d: D }, 2.35, rnd, nb);

  // tri par proximité de l'entrée (angle bas-gauche)
  zones.sort((a, b) => (a.z * 0.7 + a.x * 0.3) - (b.z * 0.7 + b.x * 0.3));
  const pieces = [];
  const pris = new Set();
  const voisinEntree = zones[0];
  pieces.push({ ...voisinEntree, type: 'entree' }); pris.add(voisinEntree);

  const libres = zones.filter(z => !pris.has(z));
  const grande = libres.reduce((a, b) => (!a || a.w * a.d < b.w * b.d ? b : a), null);
  if (grande) { pieces.push({ ...grande, type: 'sejour' }); libres.splice(libres.indexOf(grande), 1); }
  const grande2 = libres.reduce((a, b) => (!a || a.w * a.d < b.w * b.d ? b : a), null);
  if (grande2) { pieces.push({ ...grande2, type: 'cuisine' }); libres.splice(libres.indexOf(grande2), 1); }

  // chambres : on prend les plus grandes restantes, la première devient suite
  const reste = libres.slice().sort((a, b) => b.w * b.d - a.w * a.d);
  let nbCh = 0;
  reste.forEach((z, i) => {
    const petite = z.w * z.d < 6.4;
    if (nbCh < chambres && !petite) { pieces.push({ ...z, type: nbCh === 0 ? 'suite' : 'chambre' }); nbCh++; }
    else if (petite) pieces.push({ ...z, type: 'sdb' });
    else if (!pieces.some(p => p.type === 'bureau') && i % 3 === 1) pieces.push({ ...z, type: 'bureau' });
    else pieces.push({ ...z, type: 'sdb' });
  });
  // WC + escalier/palier
  if (!pieces.some(p => p.type === 'sdb')) {
    pieces.push({ ...pieces[pieces.length - 1], type: 'sdb' });
  }
  if (etage && !pieces.some(p => p.type === 'escalier' || p.type === 'palier')) {
    pieces.push({ ...pieces[pieces.length - 1], type: 'palier' });
  }

  // mur mitoyen + murs extérieurs
  const murs = [];
  const index = new Map();
  const cle = (x1, z1, x2, z2) => {
    const a = `${x1.toFixed(3)},${z1.toFixed(3)}`, b = `${x2.toFixed(3)},${z2.toFixed(3)}`;
    return a < b ? a + '|' + b : b + '|' + a;
  };
  const ajouterMur = (x1, z1, x2, z2, ext) => {
    const k = cle(x1, z1, x2, z2);
    if (index.has(k)) { if (ext) murs[index.get(k)].ext = true; return index.get(k); }
    murs.push({ x1, z1, x2, z2, ep: ext ? 0.30 : 0.13, ext, ouvertures: [] });
    index.set(k, murs.length - 1);
    return murs.length - 1;
  };
  const surBord = (x, z) => x < 1e-4 || z < 1e-4 || Math.abs(x - W) < 1e-4 || Math.abs(z - D) < 1e-4;

  pieces.forEach(p => {
    const cotes = [
      [p.x, p.z, p.x + p.w, p.z],
      [p.x + p.w, p.z, p.x + p.w, p.z + p.d],
      [p.x + p.w, p.z + p.d, p.x, p.z + p.d],
      [p.x, p.z + p.d, p.x, p.z]
    ];
    cotes.forEach(([x1, z1, x2, z2]) => {
      const ext = surBord(x1, z1) && surBord(x2, z2);
      ajouterMur(x1, z1, x2, z2, ext);
    });
  });

  // portes entre pièces adjacentes (segments partagés)
  const partage = (p, q) => {
    const eps = 1e-4;
    const chevauche = (a1, a2, b1, b2) => Math.min(a2, b2) - Math.max(a1, b1);
    // murs verticaux communs
    if (Math.abs(p.x + p.w - q.x) < eps || Math.abs(q.x + q.w - p.x) < eps) {
      const x = Math.abs(p.x + p.w - q.x) < eps ? p.x + p.w : p.x;
      const ov = chevauche(p.z, p.z + p.d, q.z, q.z + q.d);
      if (ov > 1.5) return { x1: x, z1: Math.max(p.z, q.z), x2: x, z2: Math.min(p.z + p.d, q.z + q.d), len: ov };
    }
    if (Math.abs(p.z + p.d - q.z) < eps || Math.abs(q.z + q.d - p.z) < eps) {
      const z = Math.abs(p.z + p.d - q.z) < eps ? p.z + p.d : p.z;
      const ov = chevauche(p.x, p.x + p.w, q.x, q.x + q.w);
      if (ov > 1.5) return { x1: Math.max(p.x, q.x), z1: z, x2: Math.min(p.x + p.w, q.x + q.w), z2: z, len: ov };
    }
    return null;
  };
  const dejaPorte = new Set();
  const ajouterPorte = (p, q, w = 0.92) => {
    const s = partage(p, q); if (!s) return false;
    const k = cle(s.x1, s.z1, s.x2, s.z2);
    if (dejaPorte.has(k)) return true;
    const i = index.get(k); if (i === undefined) return false;
    const t = 0.5;
    murs[i].ouvertures.push({ type: 'porte', t, largeur: w, hauteur: 2.12 });
    dejaPorte.add(k);
    return true;
  };
  // arbre de connexion : chaque pièce rejoint une déjà connectée
  const liees = [pieces.find(p => p.type === 'entree') || pieces[0]];
  const restantes = pieces.filter(p => !liees.includes(p));
  let garde = 0;
  while (restantes.length && garde++ < 60) {
    let meilleur = null, cible = null, best = -1;
    restantes.forEach(p => liees.forEach(q => {
      const s = partage(p, q); if (s && s.len > best) { best = s.len; meilleur = p; cible = q; }
    }));
    if (!meilleur) break;
    ajouterPorte(meilleur, cible);
    liees.push(meilleur);
    restantes.splice(restantes.indexOf(meilleur), 1);
  }
  // portes supplémentaires cuisine/séjour
  const sej = pieces.find(p => p.type === 'sejour');
  const cui = pieces.find(p => p.type === 'cuisine');
  if (sej && cui) ajouterPorte(sej, cui, 1.15);

  // fenêtres sur les murs extérieurs
  murs.forEach(m => {
    if (!m.ext) return;
    const len = Math.hypot(m.x2 - m.x1, m.z2 - m.z1);
    if (len < 2.2) return;
    const nbF = len > 6 ? 2 : 1;
    for (let i = 0; i < nbF; i++) {
      const t = nbF === 1 ? 0.5 : (i === 0 ? 0.3 : 0.7);
      m.ouvertures.push({
        type: 'fenetre', t, largeur: Math.min(2.1, Math.max(1.1, len * 0.22)),
        hauteur: 1.45, allege: 0.92
      });
    }
  });
  // baie vitrée dans le séjour
  if (sej) {
    const cotes = murs.filter(m => m.ext);
    // choisir le mur extérieur le plus proche du séjour
    let best = null, bd = 1e9;
    cotes.forEach(m => {
      const cx = (m.x1 + m.x2) / 2, cz = (m.z1 + m.z2) / 2;
      const d = Math.hypot(cx - (sej.x + sej.w / 2), cz - (sej.z + sej.d / 2));
      if (d < bd) { bd = d; best = m; }
    });
    if (best) {
      best.ouvertures = best.ouvertures.filter(o => o.type !== 'fenetre');
      best.ouvertures.push({ type: 'baie', t: 0.5, largeur: Math.min(3.6, Math.hypot(best.x2 - best.x1, best.z2 - best.z1) * 0.55), hauteur: 2.25, allege: 0.05 });
    }
  }

  return {
    nom: nom || (etage ? `Étage ${etage}` : 'Rez-de-chaussée'),
    largeur: +W.toFixed(2), profondeur: +D.toFixed(2),
    surface: +(W * D).toFixed(1),
    pieces: pieces.map(p => ({
      nom: (TYPES_PIECE[p.type] || TYPES_PIECE.chambre).nom,
      type: p.type,
      couleur: (TYPES_PIECE[p.type] || TYPES_PIECE.chambre).couleur,
      x: +p.x.toFixed(3), z: +p.z.toFixed(3),
      w: +p.w.toFixed(3), d: +p.d.toFixed(3)
    })),
    murs
  };
}

export function creerPlan({ seed, surface, chambres = 4, type = 'villa' }) {
  const s = typeof seed === 'string' ? hash(seed) : seed;
  const ratio = 1.12 + ((s % 100) / 100) * 0.55;
  const niveaux = [];
  const rdcSurface = Math.round(surface * (type === 'villa' || type === 'maison' || type === 'chalet' ? 0.62 : 1));
  niveaux.push(creerNiveau({
    nom: 'Rez-de-chaussée', surface: rdcSurface, chambres: Math.max(1, Math.round(chambres * 0.55)),
    ratio, seed: s
  }));
  const multi = ['villa', 'maison', 'chalet', 'duplex'].includes(type);
  if (multi) {
    niveaux.push(creerNiveau({
      nom: 'Étage', surface: Math.max(42, surface - rdcSurface), chambres,
      ratio, seed: s + 77, etage: 1
    }));
  }
  const total = niveaux.reduce((a, n) => a + n.surface, 0);
  return { niveaux, surface: Math.round(total), chambresEffectives: chambres };
}

/* ══════════════════════════════════════════════════════════════════
   LE CATALOGUE
   ══════════════════════════════════════════════════════════════════ */
const A = [
  {
    id: 'hotel-particulier-marais', ref: 'HV-101', titre: "Hôtel particulier du Marais",
    type: 'Maison', transaction: 'vente', prix: 4850000, surface: 320, terrain: 0,
    pieces: 9, chambres: 5, sdb: 3, niveaux: 2, annee: 1782, dpe: 'D', ges: 'E',
    pays: 'France', ville: 'Paris', quartier: 'Le Marais', cp: '75003',
    adresse: '12 rue de Thorigny', lat: 48.8593, lng: 2.3625, vues: 4820,
    images: ['photo-1600585154340-be6161a56a0c','photo-1600607687939-ce8a6c25118c','photo-1616594039964-ae9021a400a0','photo-1556912173-3bb406ef7e77','photo-1584622650111-993a426fbf0a'],
    badge: 'Exclusivité', description: "Entre la place de Vosges et le musée Picasso, un hôtel particulier sur deux niveaux révèle des poutres d'origine, deux cheminées en marbre et une cour pavée plantée d'un magnolia. Restauration signée par un architecte du patrimoine, sans concession sur le confort contemporain.",
    points: ['Cour pavée de 42 m²', 'Poutres et parquet d’origine', 'Cuisine sur mesure en chêne', 'Deux cheminées classées', 'Cave voûtée'],
    equipements: ['Cheminée', 'Parquet massif', 'Cave', 'Cour', 'Digicode', 'Fibre']
  },
  {
    id: 'villa-belvedere-biarritz', ref: 'HV-102', titre: 'Villa Belvédère',
    type: 'Villa', transaction: 'vente', prix: 3690000, surface: 245, terrain: 1180,
    pieces: 7, chambres: 4, sdb: 3, niveaux: 2, annee: 1928, dpe: 'C', ges: 'C',
    pays: 'France', ville: 'Biarritz', quartier: 'Saint-Charles', cp: '64200',
    adresse: '4 avenue du Belvédère', lat: 43.4832, lng: -1.5586, vues: 3910,
    images: ['photo-1600596542815-ffad4c1539a9','photo-1600566753086-00f18fb6b3ea','photo-1615874959474-d609969a20ed','photo-1556912173-3bb406ef7e77','photo-1613977257363-707ba9348227'],
    badge: 'Vue océan', description: "Une villa balnéaire de 1928, blanche et lignes tendues, à trois minutes à pied de la Grande Plage. Le séjour traverse la maison d'est en ouest ; la terrasse haute regarde l'océan par-dessus les pins.",
    points: ['Vue océan dégagée', 'Terrasse de 38 m²', 'Jardin de 1 180 m²', 'Piscine chauffée', 'Deux places de parking'],
    equipements: ['Piscine', 'Jardin', 'Terrasse', 'Cheminée', 'Garage', 'Vue mer']
  },
  {
    id: 'loft-canal-bordeaux', ref: 'HV-103', titre: 'Loft du canal',
    type: 'Loft', transaction: 'vente', prix: 890000, surface: 168, terrain: 0,
    pieces: 4, chambres: 2, sdb: 2, niveaux: 1, annee: 2019, dpe: 'B', ges: 'A',
    pays: 'France', ville: 'Bordeaux', quartier: 'Bacalan', cp: '33300',
    adresse: '31 quai de Bacalan', lat: 44.8652, lng: -0.5541, vues: 2280,
    images: ['photo-1600607687939-ce8a6c25118c','photo-1502672260266-1c1ef2d93688','photo-1600585154526-990dced4db0d','photo-1556912173-3bb406ef7e77','photo-1584622650111-993a426fbf0a'],
    badge: 'Coup de cœur', description: "Ancien atelier de tonnelier converti en loft de 168 m², verrière plein nord et béton ciré. Un volume unique où la cuisine s'installe sous la mezzanine, face aux grues du port.",
    points: ['Verrière de 9 m', 'Hauteur sous plafond 4,6 m', 'Mezzanine bureau', 'Béton ciré', 'Quai à vélo'],
    equipements: ['Verrière', 'Mezzanine', 'Ascenseur', 'Local vélo', 'Fibre']
  },
  {
    id: 'villa-dune-hossegor', ref: 'HV-104', titre: 'Villa des Dunes',
    type: 'Villa', transaction: 'location', prix: 6800, surface: 190, terrain: 940,
    pieces: 6, chambres: 4, sdb: 2, niveaux: 1, annee: 2021, dpe: 'A', ges: 'A',
    pays: 'France', ville: 'Hossegor', quartier: 'La Gravière', cp: '40150',
    adresse: '8 allée des Oyats', lat: 43.6646, lng: -1.3977, vues: 1640,
    images: ['photo-1613490493576-7fde63acd811','photo-1600210492486-724fe5c67fb0','photo-1505693416388-ac5ce068fe85','photo-1556909212-d5b604d0c90d','photo-1613977257363-707ba9348227'],
    badge: 'Location saisonnière', description: "Plain-pied entre les pins et la plage de la Gravière. Menuiseries noires, bois brûlé, piscine de débordement : la maison est pensée pour vivre dehors, du petit-déjeuner au dernier bain de soleil.",
    points: ['Piscine de débordement', 'Terrasse en ipé', 'Cuisine d’été', 'À 300 m de la plage', 'Ménage inclus'],
    equipements: ['Piscine', 'Climatisation', 'Jardin', 'Terrasse', 'Parking']
  },
  {
    id: 'penthouse-croisette', ref: 'HV-105', titre: 'Penthouse Croisette',
    type: 'Penthouse', transaction: 'vente', prix: 7200000, surface: 210, terrain: 0,
    pieces: 6, chambres: 3, sdb: 3, niveaux: 1, annee: 2023, dpe: 'A', ges: 'A',
    pays: 'France', ville: 'Cannes', quartier: 'La Croisette', cp: '06400',
    adresse: '45 boulevard de la Croisette', lat: 43.5501, lng: 7.0174, vues: 6120,
    images: ['photo-1512917774080-9991f1c4c750','photo-1600607687920-4e2a09cf159d','photo-1616594039964-ae9021a400a0','photo-1556912173-3bb406ef7e77','photo-1584622650111-993a426fbf0a'],
    badge: 'Dernier étage', description: "Le dernier étage d'une résidence de 1962 entièrement réinventée. 210 m² en façade, une terrasse filante de 90 m² face aux îles de Lérins, et une baignoire posée devant la baie.",
    points: ['Terrasse de 90 m²', 'Vue mer panoramique', 'Ascenseur privatif', 'Domotique Crestron', 'Deux caves'],
    equipements: ['Terrasse', 'Vue mer', 'Ascenseur', 'Climatisation', 'Cave', 'Conciergerie']
  },
  {
    id: 'maison-pierre-annecy', ref: 'HV-106', titre: 'Maison de pierre',
    type: 'Maison', transaction: 'vente', prix: 1980000, surface: 215, terrain: 2600,
    pieces: 8, chambres: 4, sdb: 2, niveaux: 2, annee: 1904, dpe: 'E', ges: 'F',
    pays: 'France', ville: 'Annecy', quartier: 'Talloires', cp: '74290',
    adresse: 'Chemin du Lavoir', lat: 45.8412, lng: 6.2140, vues: 2890,
    images: ['photo-1580587771525-78b9dba3b914','photo-1600566753086-00f18fb6b3ea','photo-1615874959474-d609969a20ed','photo-1556909212-d5b604d0c90d','photo-1584622650111-993a426fbf0a'],
    badge: 'Vue lac', description: "À quinze minutes du lac, une bâtisse en pierre du pays posée sur 2 600 m² de prairie. Les fenêtres à meneaux cadrent les Aravis ; le four à pain et le lavoir d'origine ont été conservés.",
    points: ['Vue sur les Aravis', 'Terrain de 2 600 m²', 'Four à pain', 'Grangier attenant', 'Potager'],
    equipements: ['Jardin', 'Cheminée', 'Grange', 'Vue montagne', 'Parking']
  },
  {
    id: 'appartement-saint-germain', ref: 'HV-107', titre: 'Appartement Saint-Germain',
    type: 'Appartement', transaction: 'vente', prix: 2150000, surface: 118, terrain: 0,
    pieces: 5, chambres: 2, sdb: 2, niveaux: 1, annee: 1880, dpe: 'D', ges: 'D',
    pays: 'France', ville: 'Paris', quartier: 'Saint-Germain-des-Prés', cp: '75006',
    adresse: '18 rue de Seine', lat: 48.8539, lng: 2.3387, vues: 5030,
    images: ['photo-1600607687939-ce8a6c25118c','photo-1600585154526-990dced4db0d','photo-1616594039964-ae9021a400a0','photo-1556912173-3bb406ef7e77','photo-1584622650111-993a426fbf0a'],
    badge: 'Exclusivité', description: "Au troisième étage d'un immeuble de 1880, un appartement traversant de 118 m². Moulures, parquet à bâtons rompus et deux balcons sur cour : l'adresse que l'on garde pour soi.",
    points: ['Traversant est-ouest', 'Deux balcons', 'Parquet à bâtons rompus', 'Moulures d’origine', 'Gardienne'],
    equipements: ['Balcon', 'Ascenseur', 'Parquet', 'Gardien', 'Cave']
  },
  {
    id: 'villa-pinede-saint-tropez', ref: 'HV-108', titre: 'Villa Pinède',
    type: 'Villa', transaction: 'vente', prix: 8900000, surface: 280, terrain: 3200,
    pieces: 9, chambres: 6, sdb: 4, niveaux: 2, annee: 2015, dpe: 'B', ges: 'A',
    pays: 'France', ville: 'Saint-Tropez', quartier: 'Les Parcs', cp: '83990',
    adresse: 'Allée des Pins Parasols', lat: 43.2727, lng: 6.6407, vues: 7410,
    images: ['photo-1600596542815-ffad4c1539a9','photo-1600607687920-4e2a09cf159d','photo-1505693416388-ac5ce068fe85','photo-1556909212-d5b604d0c90d','photo-1613977257363-707ba9348227'],
    badge: 'Vue mer', description: "Dans le domaine privé des Parcs, une villa signée par un architecte niçois : linéaire, calcaire, ouverte sur la Méditerranée. Le patio central distribue six chambres et un séjour de 70 m² qui s'efface derrière ses baies.",
    points: ['Domaine gardienné', 'Piscine à débordement', 'Patio central', 'Vue mer', 'Studio indépendant'],
    equipements: ['Piscine', 'Vue mer', 'Jardin', 'Studio', 'Climatisation', 'Garage']
  },
  {
    id: 'duplex-montmartre', ref: 'HV-109', titre: 'Duplex Montmartre',
    type: 'Duplex', transaction: 'vente', prix: 1290000, surface: 96, terrain: 0,
    pieces: 4, chambres: 2, sdb: 2, niveaux: 2, annee: 1931, dpe: 'E', ges: 'E',
    pays: 'France', ville: 'Paris', quartier: 'Montmartre', cp: '75018',
    adresse: '7 rue des Abbesses', lat: 48.8845, lng: 2.3380, vues: 3320,
    images: ['photo-1600585154526-990dced4db0d','photo-1600607687939-ce8a6c25118c','photo-1616594039964-ae9021a400a0','photo-1556912173-3bb406ef7e77','photo-1584622650111-993a426fbf0a'],
    badge: 'Vue Sacré-Cœur', description: "Un duplex d'angle au sixième étage, avec une terrasse de 12 m² qui regarde le Sacré-Cœur. En bas, la rue des Abbesses ; en haut, le silence des toits.",
    points: ['Terrasse de 12 m²', 'Vue Sacré-Cœur', 'Dernier étage', 'Cheminée', 'Fort potentiel'],
    equipements: ['Terrasse', 'Cheminée', 'Ascenseur', 'Vue monument', 'Cave']
  },
  {
    id: 'villa-megève', ref: 'HV-110', titre: 'Chalet des Aiguilles',
    type: 'Chalet', transaction: 'vente', prix: 4350000, surface: 260, terrain: 1500,
    pieces: 8, chambres: 5, sdb: 4, niveaux: 2, annee: 2018, dpe: 'C', ges: 'C',
    pays: 'France', ville: 'Megève', quartier: 'Le Jaillet', cp: '74120',
    adresse: '410 chemin des Aiguilles', lat: 45.8569, lng: 6.6178, vues: 4110,
    images: ['photo-1583608205776-bfd35f0d9f83','photo-1600210492486-724fe5c67fb0','photo-1615874959474-d609969a20ed','photo-1556909212-d5b604d0c90d','photo-1584622650111-993a426fbf0a'],
    badge: 'Ski-in / ski-out', description: "Mélèze patiné, pierre de Bourgogne, triple vitrage : un chalet contemporain à 80 m des pistes du Jaillet. Le séjour double hauteur s'ouvre sur le Mont-Blanc par une baie de sept mètres.",
    points: ['Départ ski aux pieds', 'Spa et sauna', 'Séjour double hauteur', 'Garage 2 voitures', 'Cave à vin'],
    equipements: ['Spa', 'Sauna', 'Cheminée', 'Garage', 'Vue montagne', 'Cave à vin']
  },
  {
    id: 'maison-verger-lyon', ref: 'HV-111', titre: 'Maison du verger',
    type: 'Maison', transaction: 'vente', prix: 1150000, surface: 185, terrain: 720,
    pieces: 7, chambres: 4, sdb: 2, niveaux: 2, annee: 1976, dpe: 'D', ges: 'D',
    pays: 'France', ville: 'Lyon', quartier: 'Saint-Rambert', cp: '69009',
    adresse: '22 rue du Verger', lat: 45.8003, lng: 4.7956, vues: 1470,
    images: ['photo-1568605114967-8130f3a36994','photo-1600566753086-00f18fb6b3ea','photo-1505693416388-ac5ce068fe85','photo-1556912173-3bb406ef7e77','photo-1584622650111-993a426fbf0a'],
    badge: 'Nouveau', description: "Sur les hauteurs de Saint-Rambert, une maison familiale des années 70 remise au goût du jour : toit-terrasse, verger de six arbres et atelier en fond de jardin.",
    points: ['Verger de 6 arbres', 'Atelier de 28 m²', 'Toit-terrasse', 'Panneaux solaires', 'Quartier familial'],
    equipements: ['Jardin', 'Terrasse', 'Atelier', 'Cheminée', 'Parking']
  },
  {
    id: 'appartement-vieux-port-marseille', ref: 'HV-112', titre: 'Appartement Vieux-Port',
    type: 'Appartement', transaction: 'location', prix: 2400, surface: 84, terrain: 0,
    pieces: 3, chambres: 2, sdb: 1, niveaux: 1, annee: 1900, dpe: 'E', ges: 'E',
    pays: 'France', ville: 'Marseille', quartier: 'Vieux-Port', cp: '13002',
    adresse: '9 quai de Rive-Neuve', lat: 43.2930, lng: 5.3710, vues: 2210,
    images: ['photo-1522708323590-d24dbb6b0267','photo-1600585154526-990dced4db0d','photo-1616594039964-ae9021a400a0','photo-1556909212-d5b604d0c90d','photo-1584622650111-993a426fbf0a'],
    badge: 'Vue port', description: "Face au Vieux-Port, un appartement de 84 m² au deuxième étage, balcon filant et carrelage à l'ancienne. Les bateaux entrent dans le cadre du séjour au petit matin.",
    points: ['Balcon sur le port', 'Carrelage d’origine', 'Deux chambres', 'Quartier piéton', 'Libre immédiatement'],
    equipements: ['Balcon', 'Ascenseur', 'Vue port', 'Fibre']
  },
  {
    id: 'villa-ibiza', ref: 'HV-113', titre: 'Villa Ses Salines',
    type: 'Villa', transaction: 'vente', prix: 5400000, surface: 300, terrain: 4200,
    pieces: 8, chambres: 5, sdb: 5, niveaux: 1, annee: 2020, dpe: 'A', ges: 'A',
    pays: 'Espagne', ville: 'Ibiza', quartier: 'Ses Salines', cp: '07818',
    adresse: 'Camí de sa Marina', lat: 38.9067, lng: 1.4206, vues: 6890,
    images: ['photo-1613490493576-7fde63acd811','photo-1600607687920-4e2a09cf159d','photo-1616594039964-ae9021a400a0','photo-1556912173-3bb406ef7e77','photo-1613977257363-707ba9348227'],
    badge: 'Vue mer', description: "Une villa blanche posée entre les pins et les salines. Cinq suites ouvertes sur le jardin sec, une piscine de 18 mètres et un toit-terrasse pour les soirs où le vent tombe.",
    points: ['Piscine de 18 m', 'Toit-terrasse', 'Cinq suites', 'Panorama salines', 'Licence touristique'],
    equipements: ['Piscine', 'Vue mer', 'Climatisation', 'Jardin', 'Suite parentale', 'Parking']
  },
  {
    id: 'appartement-alfama', ref: 'HV-114', titre: 'Appartement Alfama',
    type: 'Appartement', transaction: 'vente', prix: 620000, surface: 92, terrain: 0,
    pieces: 4, chambres: 2, sdb: 1, niveaux: 1, annee: 1912, dpe: 'C', ges: 'C',
    pays: 'Portugal', ville: 'Lisbonne', quartier: 'Alfama', cp: '1100-341',
    adresse: 'Rua dos Remédios 84', lat: 38.7139, lng: -9.1289, vues: 1830,
    images: ['photo-1600585154526-990dced4db0d','photo-1522708323590-d24dbb6b0267','photo-1505693416388-ac5ce068fe85','photo-1556909212-d5b604d0c90d','photo-1584622650111-993a426fbf0a'],
    badge: 'Vue Tage', description: "Au cœur d'Alfama, un appartement de 92 m² avec azulejos d'origine et fenêtres sur le Tage. Les ruelles descendent vers le fleuve ; la maison, elle, garde la fraîcheur des murs épais.",
    points: ['Azulejos d’origine', 'Vue sur le Tage', 'Deux chambres', 'Rénové 2022', 'Quartier historique'],
    equipements: ['Vue fleuve', 'Climatisation', 'Parquet', 'Fibre']
  },
  {
    id: 'villa-marbella', ref: 'HV-115', titre: 'Villa La Concha',
    type: 'Villa', transaction: 'vente', prix: 3950000, surface: 340, terrain: 2100,
    pieces: 9, chambres: 5, sdb: 5, niveaux: 2, annee: 2008, dpe: 'B', ges: 'B',
    pays: 'Espagne', ville: 'Marbella', quartier: 'Sierra Blanca', cp: '29602',
    adresse: 'Calle Sierra Blanca 14', lat: 36.5101, lng: -4.8824, vues: 3480,
    images: ['photo-1600596542815-ffad4c1539a9','photo-1600607687939-ce8a6c25118c','photo-1615874959474-d609969a20ed','photo-1556912173-3bb406ef7e77','photo-1584622650111-993a426fbf0a'],
    badge: 'Nouveau', description: "Marbre, chaux et fer forgé : une villa andalouse contemporaine dans le domaine fermé de Sierra Blanca. Le patio à orangers mène au séjour, puis à la piscine et à la mer, en contrebas.",
    points: ['Patio à orangers', 'Piscine chauffée', 'Cinq suites', 'Vue mer', 'Domaine fermé'],
    equipements: ['Piscine', 'Vue mer', 'Jardin', 'Climatisation', 'Garage', 'Sécurité']
  },
  {
    id: 'penthouse-como', ref: 'HV-116', titre: 'Attique du lac',
    type: 'Penthouse', transaction: 'vente', prix: 2750000, surface: 155, terrain: 0,
    pieces: 5, chambres: 3, sdb: 2, niveaux: 1, annee: 2016, dpe: 'A', ges: 'A',
    pays: 'Italie', ville: 'Côme', quartier: 'Lungolario Trento', cp: '22100',
    adresse: 'Via Lungolario Trento 6', lat: 45.8081, lng: 9.0852, vues: 2640,
    images: ['photo-1512917774080-9991f1c4c750','photo-1600210492486-724fe5c67fb0','photo-1505693416388-ac5ce068fe85','photo-1556909212-d5b604d0c90d','photo-1613977257363-707ba9348227'],
    badge: 'Vue lac', description: "Le lac de Côme en ligne de mire depuis une terrasse de 55 m². Trois chambres, des sols en travertin et un ascenseur qui ouvre directement dans l'appartement.",
    points: ['Terrasse de 55 m²', 'Vue lac', 'Ascenseur privatif', 'Travertin', 'Mooring possible'],
    equipements: ['Terrasse', 'Vue lac', 'Ascenseur', 'Climatisation', 'Cave']
  },
  {
    id: 'maison-deauville', ref: 'HV-117', titre: 'Villa des Planches',
    type: 'Villa', transaction: 'vente', prix: 2380000, surface: 205, terrain: 860,
    pieces: 7, chambres: 4, sdb: 3, niveaux: 2, annee: 1911, dpe: 'D', ges: 'D',
    pays: 'France', ville: 'Deauville', quartier: 'Les Planches', cp: '14800',
    adresse: '15 rue Jean Mermoz', lat: 49.3600, lng: 0.0750, vues: 1970,
    images: ['photo-1580587771525-78b9dba3b914','photo-1600566753086-00f18fb6b3ea','photo-1615874959474-d609969a20ed','photo-1556912173-3bb406ef7e77','photo-1584622650111-993a426fbf0a'],
    badge: 'Coup de cœur', description: "Une villa normande en colombages, à 200 m des Planches. Les pièces de vie gardent leurs tomettes et leurs cheminées ; le jardin clos abrite un pavillon d'amis.",
    points: ['À 200 m de la plage', 'Jardin clos', 'Pavillon d’amis', 'Colombages d’origine', 'Cheminée'],
    equipements: ['Jardin', 'Cheminée', 'Dépendance', 'Parking', 'Proche plage']
  },
  {
    id: 'appartement-montorgueil', ref: 'HV-118', titre: 'Appartement Montorgueil',
    type: 'Appartement', transaction: 'location', prix: 3100, surface: 76, terrain: 0,
    pieces: 3, chambres: 1, sdb: 1, niveaux: 1, annee: 1905, dpe: 'E', ges: 'E',
    pays: 'France', ville: 'Paris', quartier: 'Montorgueil', cp: '75002',
    adresse: '42 rue Montorgueil', lat: 48.8655, lng: 2.3469, vues: 2760,
    images: ['photo-1600607687939-ce8a6c25118c','photo-1600585154526-990dced4db0d','photo-1616594039964-ae9021a400a0','photo-1556912173-3bb406ef7e77','photo-1584622650111-993a426fbf0a'],
    badge: 'Meublé', description: "Au-dessus des étals de la rue Montorgueil, un appartement meublé de 76 m², moulures et cuisine ouverte. Le marché en bas, le Louvre à dix minutes.",
    points: ['Meublé design', 'Cuisine ouverte', 'Moulures', 'Marché en bas', 'Libre de suite'],
    equipements: ['Meublé', 'Ascenseur', 'Parquet', 'Fibre']
  },
  {
    id: 'villa-lac-annecy', ref: 'HV-119', titre: 'Villa du lac',
    type: 'Villa', transaction: 'vente', prix: 3250000, surface: 220, terrain: 1900,
    pieces: 7, chambres: 4, sdb: 3, niveaux: 2, annee: 2022, dpe: 'A', ges: 'A',
    pays: 'France', ville: 'Annecy', quartier: 'Veyrier-du-Lac', cp: '74290',
    adresse: 'Chemin de la Rive', lat: 45.8677, lng: 6.1902, vues: 3120,
    images: ['photo-1600585154340-be6161a56a0c','photo-1600607687920-4e2a09cf159d','photo-1505693416388-ac5ce068fe85','photo-1556909212-d5b604d0c90d','photo-1613977257363-707ba9348227'],
    badge: 'Bord de lac', description: "Les pieds dans l'eau, une villa contemporaine en bois et verre. Ponton privé, piscine miroir et séjour ouvert sur le lac : le lac est dans la maison.",
    points: ['Ponton privé', 'Piscine miroir', 'Vue lac', 'Bois et verre', 'Bord de lac'],
    equipements: ['Piscine', 'Vue lac', 'Ponton', 'Terrasse', 'Garage']
  },
  {
    id: 'loft-berlin', ref: 'HV-120', titre: 'Loft Kreuzberg',
    type: 'Loft', transaction: 'vente', prix: 980000, surface: 175, terrain: 0,
    pieces: 4, chambres: 2, sdb: 1, niveaux: 1, annee: 1927, dpe: 'C', ges: 'C',
    pays: 'Allemagne', ville: 'Berlin', quartier: 'Kreuzberg', cp: '10997',
    adresse: 'Oranienstraße 190', lat: 52.5010, lng: 13.4280, vues: 1510,
    images: ['photo-1502672260266-1c1ef2d93688','photo-1522708323590-d24dbb6b0267','photo-1600585154526-990dced4db0d','photo-1556912173-3bb406ef7e77','photo-1584622650111-993a426fbf0a'],
    badge: 'Nouveau', description: "Ancien atelier d'imprimerie, 175 m² en rez-de-chaussée sur cour. Le béton brut, la fonte et les grandes ouvertures industrielles sont restés ; le confort est neuf.",
    points: ['Cour intérieure', 'Béton brut', 'Grandes ouvertures', 'Atelier d’artiste', 'Transport à 2 min'],
    equipements: ['Cour', 'Local vélo', 'Fibre', 'Parquet']
  },
  {
    id: 'villa-algarve', ref: 'HV-121', titre: 'Villa Falésia',
    type: 'Villa', transaction: 'location', prix: 5200, surface: 240, terrain: 1600,
    pieces: 7, chambres: 4, sdb: 3, niveaux: 1, annee: 2019, dpe: 'A', ges: 'A',
    pays: 'Portugal', ville: 'Albufeira', quartier: 'Falésia', cp: '8200-593',
    adresse: 'Rua da Falésia 22', lat: 37.0889, lng: -8.2412, vues: 1280,
    images: ['photo-1613490493576-7fde63acd811','photo-1600210492486-724fe5c67fb0','photo-1616594039964-ae9021a400a0','photo-1556912173-3bb406ef7e77','photo-1613977257363-707ba9348227'],
    badge: 'Vue océan', description: "Une villa basse posée sur les falaises de l'Algarve. Quatre chambres, une piscine à débordement et un chemin privé qui descend vers la plage.",
    points: ['Accès plage privé', 'Piscine à débordement', 'Vue océan', 'Quatre chambres', 'Jardin méditerranéen'],
    equipements: ['Piscine', 'Vue mer', 'Climatisation', 'Jardin', 'Parking']
  },
  {
    id: 'maison-campagne-luberon', ref: 'HV-122', titre: 'Bastide du Luberon',
    type: 'Maison', transaction: 'vente', prix: 1790000, surface: 230, terrain: 4800,
    pieces: 8, chambres: 5, sdb: 3, niveaux: 2, annee: 1680, dpe: 'E', ges: 'E',
    pays: 'France', ville: 'Gordes', quartier: 'Les Hauts', cp: '84220',
    adresse: 'Chemin des Restanques', lat: 43.9110, lng: 5.2000, vues: 2240,
    images: ['photo-1580587771525-78b9dba3b914','photo-1600566753086-00f18fb6b3ea','photo-1615874959474-d609969a20ed','photo-1556909212-d5b604d0c90d','photo-1613977257363-707ba9348227'],
    badge: 'Exclusivité', description: "Une bastide du XVIIe en pierre sèche, lavande et oliviers sur 4 800 m². Piscine sous les chênes, four à pain et cuisine d'été composent un art de vivre très provençal.",
    points: ['Terrain 4 800 m²', 'Piscine sous les chênes', 'Four à pain', 'Lavande et oliviers', 'Cuisine d’été'],
    equipements: ['Piscine', 'Jardin', 'Cheminée', 'Four à pain', 'Terrasse', 'Dépendance']
  },
  {
    id: 'appartement-notting-hill', ref: 'HV-123', titre: 'Maison Notting Hill',
    type: 'Maison', transaction: 'vente', prix: 4120000, surface: 195, terrain: 0,
    pieces: 6, chambres: 4, sdb: 3, niveaux: 3, annee: 1864, dpe: 'C', ges: 'C',
    pays: 'Royaume-Uni', ville: 'Londres', quartier: 'Notting Hill', cp: 'W11',
    adresse: '52 Lansdowne Road', lat: 51.5092, lng: -0.2050, vues: 3040,
    images: ['photo-1600585154340-be6161a56a0c','photo-1600607687939-ce8a6c25118c','photo-1616594039964-ae9021a400a0','photo-1556912173-3bb406ef7e77','photo-1584622650111-993a426fbf0a'],
    badge: 'Nouveau', description: "Une maison victorienne sur trois niveaux, façade pastel et jardinet arrière. Le salon de réception occupe tout le premier étage, comme il se doit à Notting Hill.",
    points: ['Trois niveaux', 'Jardin arrière', 'Salon de réception', 'Cuisine extension verre', 'Proche Portobello'],
    equipements: ['Jardin', 'Cheminée', 'Terrasse', 'Fibre', 'Proche métro']
  },
  {
    id: 'villa-ski-courchevel', ref: 'HV-124', titre: 'Chalet Bellecôte',
    type: 'Chalet', transaction: 'vente', prix: 6900000, surface: 300, terrain: 900,
    pieces: 9, chambres: 6, sdb: 5, niveaux: 3, annee: 2014, dpe: 'B', ges: 'B',
    pays: 'France', ville: 'Courchevel', quartier: 'Bellecôte', cp: '73120',
    adresse: 'Rue du Bellecôte', lat: 45.4150, lng: 6.6340, vues: 5890,
    images: ['photo-1583608205776-bfd35f0d9f83','photo-1600607687920-4e2a09cf159d','photo-1615874959474-d609969a20ed','photo-1556909212-d5b604d0c90d','photo-1584622650111-993a426fbf0a'],
    badge: 'Ski-in / ski-out', description: "Sur trois niveaux, un chalet de 300 m² habillé de vieux bois et de pierre. Piscine intérieure, cave à vin, six chambres : la montagne sans compromis.",
    points: ['Piscine intérieure', 'Ski aux pieds', 'Six chambres', 'Cave à vin', 'Ascenseur'],
    equipements: ['Piscine', 'Spa', 'Cheminée', 'Ascenseur', 'Garage', 'Vue montagne']
  },
  {
    id: 'maison-oslo', ref: 'HV-125', titre: 'House Frogner',
    type: 'Maison', transaction: 'vente', prix: 2450000, surface: 210, terrain: 540,
    pieces: 7, chambres: 4, sdb: 2, niveaux: 2, annee: 1938, dpe: 'B', ges: 'B',
    pays: 'Norvège', ville: 'Oslo', quartier: 'Frogner', cp: '0263',
    adresse: 'Nobels gate 18', lat: 59.9180, lng: 10.7000, vues: 1120,
    images: ['photo-1568605114967-8130f3a36994','photo-1600566753086-00f18fb6b3ea','photo-1505693416388-ac5ce068fe85','photo-1556912173-3bb406ef7e77','photo-1584622650111-993a426fbf0a'],
    badge: 'Nouveau', description: "Une maison fonctionnaliste de 1938, chêne clair et grandes fenêtres, dans le quartier des ambassades. Jardin clos, atelier et sauna : l'art de vivre norvégien.",
    points: ['Jardin clos', 'Sauna', 'Atelier', 'Chêne clair', 'Quartier calme'],
    equipements: ['Jardin', 'Sauna', 'Terrasse', 'Cheminée', 'Parking']
  },
  {
    id: 'villa-mykonos', ref: 'HV-126', titre: 'Villa Ornos',
    type: 'Villa', transaction: 'location', prix: 9500, surface: 260, terrain: 2000,
    pieces: 8, chambres: 5, sdb: 5, niveaux: 1, annee: 2021, dpe: 'A', ges: 'A',
    pays: 'Grèce', ville: 'Mykonos', quartier: 'Ornos', cp: '84600',
    adresse: 'Ornos Bay', lat: 37.4180, lng: 25.3300, vues: 2110,
    images: ['photo-1613490493576-7fde63acd811','photo-1600607687920-4e2a09cf159d','photo-1616594039964-ae9021a400a0','photo-1556909212-d5b604d0c90d','photo-1613977257363-707ba9348227'],
    badge: 'Vue mer', description: "Chaux blanche, volets bleus, cinq suites en ligne face à la baie d'Ornos. La piscine semble continuer la mer ; le coucher de soleil, lui, entre dans le séjour.",
    points: ['Vue baie', 'Piscine', 'Cinq suites', 'Cuisine d’été', 'Plage à 5 min'],
    equipements: ['Piscine', 'Vue mer', 'Climatisation', 'Terrasse', 'Ménage inclus']
  },
  {
    id: 'appartement-vienne', ref: 'HV-127', titre: 'Appartement Ringstrasse',
    type: 'Appartement', transaction: 'vente', prix: 1650000, surface: 145, terrain: 0,
    pieces: 5, chambres: 3, sdb: 2, niveaux: 1, annee: 1898, dpe: 'D', ges: 'D',
    pays: 'Autriche', ville: 'Vienne', quartier: 'Innere Stadt', cp: '1010',
    adresse: 'Schubertring 9', lat: 48.2030, lng: 16.3760, vues: 1340,
    images: ['photo-1600607687939-ce8a6c25118c','photo-1600585154526-990dced4db0d','photo-1616594039964-ae9021a400a0','photo-1556912173-3bb406ef7e77','photo-1584622650111-993a426fbf0a'],
    badge: 'Exclusivité', description: "Sur le Ring, un appartement de 145 m² au plafond de 3,6 m. Parquet en point de Hongrie, doubles portes et vue sur la ville impériale.",
    points: ['Plafond 3,6 m', 'Point de Hongrie', 'Doubles portes', 'Vue Ring', 'Cave'],
    equipements: ['Ascenseur', 'Parquet', 'Cheminée', 'Cave', 'Vue ville']
  },
  {
    id: 'villa-tulum', ref: 'HV-128', titre: 'Casa Tulum',
    type: 'Villa', transaction: 'vente', prix: 1250000, surface: 220, terrain: 3000,
    pieces: 7, chambres: 4, sdb: 4, niveaux: 1, annee: 2022, dpe: 'A', ges: 'A',
    pays: 'Mexique', ville: 'Tulum', quartier: 'Jungle', cp: '77780',
    adresse: 'Carretera Tulum-Boca Paila', lat: 20.2114, lng: -87.4654, vues: 980,
    images: ['photo-1600596542815-ffad4c1539a9','photo-1600210492486-724fe5c67fb0','photo-1616594039964-ae9021a400a0','photo-1556909212-d5b604d0c90d','photo-1613977257363-707ba9348227'],
    badge: 'Nouveau', description: "Bois, chaux et végétation : une villa de jungle à dix minutes de la mer. Quatre suites, une piscine naturelle et un toit-terrasse pour les étoiles.",
    points: ['Piscine naturelle', 'Quatre suites', 'Toit-terrasse', 'Jardin tropical', 'Proche cenote'],
    equipements: ['Piscine', 'Jardin', 'Climatisation', 'Terrasse', 'Parking']
  }
];

/* enrichissement : images, plan, agent, points calculés */
const AGENTS = [
  { nom: 'Camille Ferrand', tel: '+33 1 84 80 20 21', mail: 'camille@havre.fr', initiales: 'CF' },
  { nom: 'Basile Andrieu', tel: '+33 1 84 80 20 22', mail: 'basile@havre.fr', initiales: 'BA' },
  { nom: 'Noor El Mansouri', tel: '+33 1 84 80 20 23', mail: 'noor@havre.fr', initiales: 'NE' },
  { nom: 'Elias Vandenberghe', tel: '+33 1 84 80 20 24', mail: 'elias@havre.fr', initiales: 'EV' }
];

function etoiles(i) { return AGENTS[i % AGENTS.length]; }

export const BIENS = A.map((b, i) => {
  const photos = Array.from(new Set(b.images));
  const plan = creerPlan({ seed: b.id, surface: b.surface, chambres: b.chambres, type: b.type });
  const prixM2 = b.transaction === 'vente' ? Math.round(b.prix / b.surface) : null;
  const loyerM2 = b.transaction === 'location' ? Math.round(b.prix / b.surface) : null;
  return {
    ...b,
    photos,
    couverture: photos[0],
    plan,
    agent: etoiles(i),
    prixM2, loyerM2,
    chambresEffectives: plan.chambresEffectives,
    publie: `2026-0${(i % 9) + 1}-${String((i * 7) % 27 + 1).padStart(2, '0')}`,
    disponible: b.transaction === 'location' ? 'Immédiatement' : 'À la vente'
  };
});

/* ══════════════════════════════════════════════════════════════════
   JOURNAL
   ══════════════════════════════════════════════════════════════════ */
export const ARTICLES = [
  {
    id: 'plan-maquette', rubrique: 'Architecture', date: '2026-10-12', lecture: 7,
    titre: 'Du trait à la maquette : comment nous reconstruisons un plan en 3D',
    chapeau: "Un plan architectural contient déjà tout : épaisseurs de murs, ouvertures, circulations. Notre moteur les lit, les extrude et restitue une maison à l'échelle, sans approximation.",
    image: 'photo-1600585154340-be6161a56a0c',
    auteur: 'Camille Ferrand',
    corps: [
      "Un plan n'est pas un dessin. C'est une coupe horizontale à un mètre du sol, normée : les murs porteurs y sont plus épais que les cloisons, les baies s'y interrompent, les trémies d'escalier s'y dessinent en pointillés. Toute la géométrie de la maison est là, en deux dimensions.",
      "Notre moteur commence par vectoriser ce plan : il extrait les segments horizontaux et verticaux, élimine le mobilier et les cotes, puis reconstitue un réseau de murs. Chaque segment reçoit une épaisseur (30 cm en extérieur, 13 cm en cloison) et une hauteur, paramétrables.",
      "Vient ensuite la lecture des vides. Un mur n'est pas plein : il s'interrompt pour une porte (2,12 m), une fenêtre (allège 0,92 m), une baie (2,25 m). Nous détectons ces interruptions comme des trous dans le tracé, ce qui permet de les percer dans la maquette au bon endroit, à la bonne hauteur.",
      "Les pièces sont déduites par remplissage des zones fermées. Chacune reçoit une nature — séjour, chambre, salle d'eau — et un sol différencié. C'est ce même jeu de données qui alimente le plan 2D et la visite 3D : jamais deux sources, donc jamais d'écart entre le document et la maquette.",
      "La fidélité n'est pas une question de réalisme photométrique. Elle tient à trois choses : l'échelle exacte, la position exacte des ouvertures, et la circulation. Si la porte est à trente centimètres près, l'espace sonne juste quand on le traverse."
    ]
  },
  {
    id: 'acheter-biarritz', rubrique: 'Marché', date: '2026-09-28', lecture: 5,
    titre: 'Biarritz : ce que change la nouvelle ligne de tram',
    chapeau: "Les quartiers Saint-Charles et La Négresse gagnent dix minutes sur le centre. Sur le terrain, les prix suivent déjà.",
    image: 'photo-1600596542815-ffad4c1539a9',
    auteur: 'Basile Andrieu',
    corps: [
      "La mise en service de la ligne de tram a recomposé la carte des trajets quotidiens. Les maisons de Saint-Charles, jusqu'ici pénalisées par la distance à la Grande Plage, se retrouvent à huit minutes du centre.",
      "Conséquence directe : les biens familiaux de 150 à 220 m² avec jardin sont les plus recherchés. Le stock est faible, les délais de vente se raccourcissent sous soixante jours pour les biens bien présentés.",
      "Notre conseil reste le même : privilégier la lumière et le jardin plutôt que la vue, plus volatile. Et demander systématiquement le plan au format vectoriel — c'est ce qui permet de vérifier une surface avant l'offre."
    ]
  },
  {
    id: 'lumiere-naturelle', rubrique: 'Décoration', date: '2026-09-14', lecture: 6,
    titre: 'La lumière naturelle, premier matériau d’une maison',
    chapeau: "Orientation, allège, profondeur de la pièce : trois réglages qui changent tout, bien avant la peinture.",
    image: 'photo-1600607687939-ce8a6c25118c',
    auteur: 'Noor El Mansouri',
    corps: [
      "Une fenêtre n'éclaire pas une pièce : elle éclaire une zone. La règle empirique dit qu'une ouverture éclaire une profondeur égale à deux fois sa hauteur. Une fenêtre de 1,45 m sous plafond porte donc à environ trois mètres.",
      "D'où l'importance de l'allège : la baisser de trente centimètres agrandit la tache lumineuse au sol. À l'inverse, une fenêtre haute donne une lumière plus diffuse, idéale pour un bureau ou une salle d'eau.",
      "Enfin, la couleur des murs ne fait pas la lumière : elle la redistribue. Un blanc chaud (R 245, V 242, B 235) renvoie mieux la lumière du nord qu'un blanc pur, qui la refroidit."
    ]
  },
  {
    id: 'investir-location', rubrique: 'Investissement', date: '2026-08-30', lecture: 8,
    titre: 'Location meublée : la checklist avant l’offre',
    chapeau: "Rendement, DPE, règlement de copropriété, fiscalité : quatre dossiers à ouvrir avant de signer quoi que ce soit.",
    image: 'photo-1512917774080-9991f1c4c750',
    auteur: 'Elias Vandenberghe',
    corps: [
      "Le rendement brut se calcule, le rendement net se vérifie. Entre les charges de copropriété, la taxe foncière, l'assurance et la vacance, un écart de deux points est fréquent sur les annonces.",
      "Le DPE est devenu un critère de financement autant que de confort. Les logements classés F et G sortent progressivement du marché locatif : intégrer le coût des travaux dans le prix d'achat, pas après.",
      "Enfin, vérifier le règlement de copropriété avant toute promesse : certaines clauses interdisent la location meublée courte durée, d'autres limitent le nombre de lots loués simultanément."
    ]
  },
  {
    id: 'materiaux-locaux', rubrique: 'Architecture', date: '2026-08-16', lecture: 5,
    titre: 'Pierre, chaux, bois : construire avec ce qui est là',
    chapeau: "Trois matériaux présents à moins de cent kilomètres d'un chantier suffisent souvent à réduire son empreinte de moitié.",
    image: 'photo-1583608205776-bfd35f0d9f83',
    auteur: 'Camille Ferrand',
    corps: [
      "La pierre massive locale a une conductivité médiocre, mais une inertie exceptionnelle : elle lisse les écarts de température entre le jour et la nuit. En rénovation, on la conserve et on isole par l'intérieur avec des matériaux perspirants.",
      "La chaux laisse passer la vapeur d'eau, contrairement au ciment. Sur un mur ancien, c'est la condition pour éviter les remontées capillaires et les désordres d'humidité.",
      "Le bois, enfin, n'est intéressant que s'il vient de forêts gérées proches. Un châtaignier du Limousin vaut mieux qu'un ipé exotique, à performance égale."
    ]
  },
  {
    id: 'visite-a-distance', rubrique: 'Méthode', date: '2026-07-29', lecture: 4,
    titre: 'Visiter à distance sans se tromper',
    chapeau: "Une visite 3D ne remplace pas une visite physique, mais elle élimine 80 % des déplacements inutiles. À condition de savoir quoi regarder.",
    image: 'photo-1600566753190-17f0baa2a6c3',
    auteur: 'Noor El Mansouri',
    corps: [
      "Commencer par les circulations : un couloir trop étroit ou une entrée qui débouche dans le séjour se voient immédiatement en 3D, et jamais sur les photos.",
      "Mesurer ensuite les pièces à l'échelle du plan, en vérifiant l'emplacement des ouvertures. Un lit de 160 ne passe pas partout ; une porte de 70 cm non plus.",
      "Terminer par l'orientation : le soleil du matin et celui du soir changent l'usage d'une pièce. Le plan, lui, ne ment pas sur ce point."
    ]
  }
];

/* aide à la recherche : normalisation */
export function normaliser(t) {
  return (t || '')
    .toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

export const VILLES = [...new Set(BIENS.map(b => b.ville))].sort((a, b) => a.localeCompare(b, 'fr'));
export const PAYS = [...new Set(BIENS.map(b => b.pays))].sort((a, b) => a.localeCompare(b, 'fr'));
export const TYPES = [...new Set(BIENS.map(b => b.type))].sort((a, b) => a.localeCompare(b, 'fr'));

export function distanceKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function formatPrix(b) {
  if (b.transaction === 'location') {
    return new Intl.NumberFormat('fr-FR').format(b.prix) + ' € / mois';
  }
  return new Intl.NumberFormat('fr-FR').format(b.prix) + ' €';
}
