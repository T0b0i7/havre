/* ══════════════════════════════════════════════════════════════════
   HAVRE — application : catalogue, recherche, carte, fiches, journal
   ══════════════════════════════════════════════════════════════════ */
import { BIENS, ARTICLES, img, formatPrix, normaliser, distanceKm, VILLES, PAYS, TYPES, creerPlan } from './data.js';
import { Visite, planSVG, analyserImagePlan, analyserSVGPlan, planDepuisMurs, dessinerPlanCanvas } from './visite3d.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = new Intl.NumberFormat('fr-FR');
const PRIX = (b) => b.transaction === 'location' ? `${nf.format(b.prix)} € <small>/ mois</small>` : `${nf.format(b.prix)} €`;
const PAR_KM = (d) => `${nf.format(Math.round(d))} km`;

/* ── état global ── */
const etat = {
  route: '',
  position: null,
  positionDemandee: false,
  map: null,
  marqueurs: [],
  bounds: null,
  visite: null,
  leaflet: null,
  dernierFocus: null
};
window.__havreApp = etat;

/* ── accès aux biens ── */
const parId = (id) => BIENS.find(b => b.id === id);
const parRef = (ref) => BIENS.find(b => b.ref === ref);

function haystack(b) {
  return normaliser([
    b.titre, b.type, b.ville, b.quartier, b.pays, b.cp, b.ref, b.description,
    b.agent.nom, (b.equipements || []).join(' '), (b.points || []).join(' ')
  ].join(' '));
}
BIENS.forEach(b => b._hay = haystack(b));

function libelleType(t) {
  return ({ Appartement: 'Appartement', Villa: 'Villa', Maison: 'Maison', Loft: 'Loft', Penthouse: 'Penthouse', Duplex: 'Duplex', Chalet: 'Chalet' })[t] || t;
}

/* ══════════════════════════════════════════════════════════════════
   RECHERCHE
   ══════════════════════════════════════════════════════════════════ */
export function rechercher(q) {
  const texte = normaliser(q.q);
  const mots = texte ? texte.split(' ').filter(Boolean) : [];
  let out = BIENS.slice();

  if (q.transaction && q.transaction !== 'tout') out = out.filter(b => b.transaction === q.transaction);
  if (q.type && q.type !== 'tout') out = out.filter(b => b.type === q.type);
  if (q.pays) out = out.filter(b => b.pays === q.pays);
  if (q.ville) out = out.filter(b => b.ville === q.ville);
  if (+q.chambres > 0) out = out.filter(b => b.chambres >= +q.chambres);
  if (+q.surface > 0) out = out.filter(b => b.surface >= +q.surface);
  if (q.prixMax && +q.prixMax > 0) out = out.filter(b => b.prix <= +q.prixMax);
  if (q.prixMin && +q.prixMin > 0) out = out.filter(b => b.prix >= +q.prixMin);
  if (q.equipements) {
    const liste = q.equipements.split(',').filter(Boolean);
    out = out.filter(b => liste.every(e => b.equipements.includes(e)));
  }
  if (etat.position && q.autour) {
    const rayon = +(q.rayon || 50);
    out = out.filter(b => distanceKm(etat.position, b) <= rayon);
  }
  if (etat.bounds && q.zone) {
    out = out.filter(b => etat.bounds.contains([Number(b.lat), Number(b.lng)]));
  }
  if (mots.length) {
    out = out.filter(b => mots.every(m => b._hay.includes(m)));
  }
  // score de pertinence
  if (mots.length) {
    out = out.map(b => {
      let score = 0;
      const titre = normaliser(b.titre), ville = normaliser(b.ville), quartier = normaliser(b.quartier);
      mots.forEach(m => {
        if (ville === m) score += 60;
        if (quartier.includes(m)) score += 40;
        if (titre.includes(m)) score += 30;
        if (normaliser(b.type) === m) score += 25;
        if (normaliser(b.pays) === m) score += 20;
        if (normaliser(b.description).includes(m)) score += 6;
      });
      return { b, score };
    }).sort((a, b) => b.score - a.score).map(x => x.b);
  } else {
    out = out.slice().sort((a, b) => b.vues - a.vues);
  }

  if (etat.position) out = out.map(b => ({ ...b, distance: distanceKm(etat.position, b) }));

  const tri = q.tri || 'pertinence';
  if (tri === 'prix-asc') out.sort((a, b) => a.prix - b.prix);
  else if (tri === 'prix-desc') out.sort((a, b) => b.prix - a.prix);
  else if (tri === 'surface') out.sort((a, b) => b.surface - a.surface);
  else if (tri === 'recent') out.sort((a, b) => b.publie.localeCompare(a.publie));
  else if (tri === 'distance' && etat.position) out.sort((a, b) => a.distance - b.distance);
  else if (!mots.length) out.sort((a, b) => b.vues - a.vues);

  return out;
}

export function suggerer(texte) {
  const t = normaliser(texte || '');
  if (!t) return [];
  const res = [];
  const vues = new Set();
  const ajouter = (label, type, q, meta) => {
    const k = type + label;
    if (vues.has(k)) return;
    vues.add(k);
    res.push({ label, type, q, meta });
  };
  BIENS.forEach(b => {
    if (normaliser(b.ville).includes(t)) ajouter(b.ville, 'Ville', `ville:${b.ville}`, b.pays);
    if (normaliser(b.quartier).includes(t)) ajouter(b.quartier, 'Quartier', `quartier:${b.quartier}`, `${b.ville}, ${b.pays}`);
    if (normaliser(b.type).includes(t)) ajouter(b.type, 'Type', `type:${b.type}`, '');
    if (normaliser(b.pays).includes(t)) ajouter(b.pays, 'Pays', `pays:${b.pays}`, '');
  });
  return res.slice(0, 7);
}

/* ══════════════════════════════════════════════════════════════════
   ROUTEUR
   ══════════════════════════════════════════════════════════════════ */
function parserHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [chemin, query] = h.split('?');
  const seg = chemin.split('/').filter(Boolean);
  const params = new URLSearchParams(query || '');
  return { seg, params, h };
}

export function ouvrirRoute() {
  const { seg, params } = parserHash();
  const route = seg[0] || '';
  etat.route = route;
  etat.dernierFocus = document.activeElement;

  if (route === 'visite' && seg[1]) {
    const b = parId(seg[1]);
    if (b) { ouvrirVisite(b); return; }
  }
  if (route === 'bien' && seg[1]) {
    const b = parId(seg[1]);
    if (b) { rendreFiche(b); return; }
  }
  if (route === 'journal') { rendreJournal(); return; }
  if (route === 'article' && seg[1]) {
    const a = ARTICLES.find(x => x.id === seg[1]);
    if (a) { rendreArticle(a); return; }
  }
  if (route === 'reconstruire') { rendreReconstruction(); return; }
  if (route === 'catalogue') { rendreCatalogue(params); return; }
  fermerVue();
}

export function aller(hash) { location.hash = hash; }

function conteneur() {
  return $('#app-vue');
}
function preparerVue(classe) {
  const c = conteneur();
  if (etat.map) { etat.map.remove(); etat.map = null; etat.marqueurs = []; }
  c.hidden = false;
  c.className = 'vue ' + classe;
  if (!c.dataset.defileLie) {
    c.dataset.defileLie = '1';
    c.addEventListener('scroll', () => {
      c.classList.toggle('defile', c.scrollTop > 24);
    }, { passive: true });
  }
  document.body.classList.add('vue-ouverte');
  document.documentElement.classList.add('vue-ouverte');
  window.__havre?.lenis?.stop?.();
  return c;
}
function fermerVue() {
  const c = conteneur();
  if (c) { c.hidden = true; c.innerHTML = ''; c.className = 'vue'; }
  document.body.classList.remove('vue-ouverte');
  document.documentElement.classList.remove('vue-ouverte');
  window.__havre?.lenis?.start?.();
  if (etat.map) { etat.map.remove(); etat.map = null; etat.marqueurs = []; }
  if (etat.visite) {
    if (etat.surFermer) etat.visite.racine.removeEventListener('v3d-fermer', etat.surFermer);
    etat.surFermer = null;
    etat.visite.fermer();
    etat.visite = null;
  }
  const socle = $('#visite');
  if (socle) { socle.hidden = true; socle.innerHTML = ''; }
}

/* ══════════════════════════════════════════════════════════════════
   EN-TÊTE DES VUES
   ══════════════════════════════════════════════════════════════════ */
function enteteVue({ actif = 'catalogue', retour = '' } = {}) {
  return `
  <header class="v-tete">
    <a class="v-marque" href="#accueil" data-retour>Havre</a>
    <nav class="v-nav" aria-label="Navigation principale">
      <a href="#/catalogue" class="${actif === 'catalogue' ? 'actif' : ''}">Propriétés</a>
      <a href="#processus" data-retour>Le processus</a>
      <a href="#agence" data-retour>L'agence</a>
      <a href="#/journal" class="${actif === 'journal' ? 'actif' : ''}">Journal</a>
      <a href="#/reconstruire" class="${actif === 'reconstruire' ? 'actif' : ''}">Plan → 3D</a>
      <a href="#contact" data-retour>Contact</a>
    </nav>
    <div class="v-tete-actions">
      <button class="bouton" type="button" data-modale="alerte">Créer une alerte</button>
    </div>
    <button class="burger v-burger" type="button" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="menuMobile"><i></i><i></i><i></i></button>
  </header>`;
}

function piedVue() {
  return `
  <footer class="v-pied">
    <div class="pied-grille">
      <div>
        <a class="marque" href="#accueil" data-retour>Havre</a>
        <p style="margin-top:.7rem">Agence immobilière indépendante. Paris, Biarritz, Hossegor.</p>
      </div>
      <nav aria-label="Liens de pied de page">
        <a href="#/catalogue">Propriétés</a>
        <a href="#processus" data-retour>Le processus</a>
        <a href="#agence" data-retour>L'agence</a>
        <a href="#/journal">Journal</a>
        <a href="#/reconstruire">Plan → 3D</a>
        <a href="#contact" data-retour>Contact</a>
      </nav>
      <p>© 2026 Havre. Toutes les adresses sont visitées avant publication.</p>
    </div>
    <div class="signature" aria-hidden="true">Havre</div>
  </footer>`;
}

/* ══════════════════════════════════════════════════════════════════
   CATALOGUE
   ══════════════════════════════════════════════════════════════════ */
function etatDepuisParams(params) {
  return {
    q: params.get('q') || '',
    transaction: params.get('t') || 'tout',
    type: params.get('type') || 'tout',
    pays: params.get('pays') || '',
    ville: params.get('ville') || '',
    chambres: params.get('ch') || '',
    surface: params.get('s') || '',
    prixMin: params.get('pmin') || '',
    prixMax: params.get('pmax') || '',
    tri: params.get('tri') || 'pertinence',
    rayon: params.get('rayon') || '50',
    autour: params.get('autour') === '1',
    zone: params.get('zone') === '1',
    carte: params.get('carte') === '1'
  };
}

async function rendreCatalogue(params) {
  const c = preparerVue('vue-catalogue');
  const q = etatDepuisParams(params);
  c.innerHTML = `
    ${enteteVue({ actif: 'catalogue', retour: '#accueil' })}
    <div class="cat-intro">
      <p class="surtitre-v">Catalogue · ${BIENS.length} adresses visitées</p>
      <h1 class="cat-titre">Trouver la <em>juste</em> adresse.</h1>
      <p class="cat-sous">Recherchez par pays, ville, quartier ou type de bien. Votre position, si vous l'acceptez, classe les adresses par distance — puis « Autour de moi » resserre le rayon.</p>
    </div>
    <form class="rech" id="formRecherche" autocomplete="off">
      <div class="rech-ligne">
        <div class="rech-champ">
          <span class="rech-ico" aria-hidden="true">⌕</span>
          <input id="champRecherche" name="q" type="search" placeholder="Paris, Le Marais, villa, Biarritz, Portugal…" value="${esc(q.q)}" aria-label="Rechercher un bien">
          <div class="rech-suggestions" id="suggestions" hidden></div>
        </div>
        <button type="button" class="btn-geo ${etat.position ? 'actif' : ''}" id="btnGeo" title="Utiliser ma position">
          <i aria-hidden="true">◎</i><span>${etat.position ? 'Autour de moi' : 'Me localiser'}</span>
        </button>
        <button class="btn-rech" type="submit">Rechercher</button>
        <button type="button" class="btn-carte ${q.carte ? 'actif' : ''}" id="btnCarte" aria-pressed="${q.carte}">
          <i aria-hidden="true">▦</i><span>Carte</span>
        </button>
      </div>
      <div class="rech-filtres">
        <div class="filtre-seg" role="group" aria-label="Transaction">
          ${[['tout', 'Tout'], ['vente', 'Acheter'], ['location', 'Louer']].map(([v, l]) =>
            `<button type="button" data-t="${v}" class="${q.transaction === v ? 'actif' : ''}">${l}</button>`).join('')}
        </div>
        <label class="filtre">Type
          <select name="type">
            <option value="tout">Tous les types</option>
            ${TYPES.map(t => `<option value="${t}" ${q.type === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </label>
        <label class="filtre">Pays
          <select name="pays">
            <option value="">Tous les pays</option>
            ${PAYS.map(p => `<option value="${p}" ${q.pays === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </label>
        <label class="filtre">Ville
          <select name="ville">
            <option value="">Toutes les villes</option>
            ${VILLES.map(v => `<option value="${v}" ${q.ville === v ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </label>
        <label class="filtre">Chambres
          <select name="chambres">
            <option value="">–</option>
            ${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${q.chambres == n ? 'selected' : ''}>${n}+</option>`).join('')}
          </select>
        </label>
        <label class="filtre">Surface min.
          <select name="surface">
            <option value="">–</option>
            ${[60, 80, 100, 150, 200, 250].map(n => `<option value="${n}" ${q.surface == n ? 'selected' : ''}>${n} m²</option>`).join('')}
          </select>
        </label>
        <label class="filtre">Budget max.
          <select name="prixMax">
            <option value="">–</option>
            ${[800, 1500, 3000, 5000, 900000, 1500000, 2500000, 4000000, 10000000].map(n =>
              `<option value="${n}" ${q.prixMax == n ? 'selected' : ''}>${n <= 5000 ? nf.format(n) + ' €/mois' : nf.format(n) + ' €'}</option>`).join('')}
          </select>
        </label>
        <button type="button" class="filtre-plus" id="filtrePlus">Plus de critères</button>
      </div>
      <div class="rech-avances" id="avances" hidden>
        <label class="filtre">Budget min.
          <input name="prixMin" type="number" min="0" step="1000" placeholder="—" value="${esc(q.prixMin)}">
        </label>
        <label class="filtre">Rayon autour de moi
          <input name="rayon" type="range" min="5" max="500" step="5" value="${q.rayon}" id="rayon" ${etat.position ? '' : 'disabled'}>
          <output for="rayon" id="rayonSortie">${q.rayon} km</output>
        </label>
        <label class="filtre filtre-check">
          <input type="checkbox" name="zone" value="1" ${q.zone ? 'checked' : ''}> Limiter à la zone de la carte
        </label>
        <button type="button" class="lien-simple" id="reinitFiltres">Réinitialiser</button>
      </div>
      <div class="rech-etat">
        <p id="resumeResultats">—</p>
        <label class="tri">Trier par
          <select id="tri">
            ${[['pertinence', 'Pertinence'], ['prix-asc', 'Prix croissant'], ['prix-desc', 'Prix décroissant'], ['surface', 'Surface'], ['recent', 'Plus récentes'], ['distance', 'Distance']]
              .map(([v, l]) => `<option value="${v}" ${q.tri === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </label>
      </div>
    </form>
    <main class="cat-corps">
      <div class="cat-liste" id="resultats"></div>
      <aside class="cat-carte" id="panneauCarte" hidden>
        <div id="carte"></div>
        <div class="carte-bas">
          <button type="button" class="btn-zone" id="btnZone">Rechercher dans cette zone</button>
          <button type="button" class="lien-simple" id="btnZoneOff">Toute la carte</button>
        </div>
      </aside>
    </main>
    ${piedVue()}`;

  c.scrollTop = 0;
  activerRecherche(c, q);
  if (q.carte) await basculerCarte(c, true);
  document.title = 'Catalogue — HAVRE';
  window.__havre?.rafraichirEntete?.();
}

function construireRequete(c, q) {
  const f = $('#formRecherche', c);
  const d = new FormData(f);
  const sortie = {
    q: (d.get('q') || '').toString().trim(),
    transaction: q.transaction,
    type: d.get('type') || 'tout',
    pays: d.get('pays') || '',
    ville: d.get('ville') || '',
    chambres: d.get('chambres') || '',
    surface: d.get('surface') || '',
    prixMax: d.get('prixMax') || '',
    prixMin: d.get('prixMin') || '',
    tri: $('#tri', c)?.value || 'pertinence',
    rayon: d.get('rayon') || '50',
    autour: f.dataset.autour === '1',
    zone: !!d.get('zone'),
    carte: q.carte
  };
  return sortie;
}

function activerRecherche(c, q) {
  let requete = q;
  const champ = $('#champRecherche', c);
  const sug = $('#suggestions', c);
  const form = $('#formRecherche', c);
  form.dataset.autour = q.autour ? '1' : '0';

  const mettreAJour = (majUrl = true) => {
    requete = construireRequete(c, requete);
    const res = rechercher(requete);
    afficherResultats(c, res, requete);
    if (majUrl) synchroUrl(requete);
    if (etat.map) majMarqueurs(res);
    actualiserBoutons(c, requete);
  };

  $('#formRecherche', c).addEventListener('submit', (e) => {
    e.preventDefault(); sug.hidden = true; mettreAJour();
    c.scrollTo({ top: 0, behavior: 'smooth' });
  });
  $$('[data-t]', c).forEach(b => b.addEventListener('click', () => {
    requete.transaction = b.dataset.t;
    $$('[data-t]', c).forEach(x => x.classList.toggle('actif', x === b));
    mettreAJour();
  }));
  ['type', 'pays', 'ville', 'chambres', 'surface', 'prixMax'].forEach(n => {
    const el = c.querySelector(`[name="${n}"]`);
    el?.addEventListener('change', () => {
      if (n === 'pays') {
        requete.ville = '';
        const sel = c.querySelector('[name="ville"]');
        if (sel) sel.value = '';
      }
      mettreAJour();
    });
  });
  $('#tri', c)?.addEventListener('change', (e) => { requete.tri = e.target.value; mettreAJour(); });
  $('#rayon', c)?.addEventListener('input', (e) => {
    requete.rayon = e.target.value;
    const out = $('#rayonSortie', c); if (out) out.textContent = e.target.value + ' km';
    if (etat.position) {
      form.dataset.autour = '1';
      mettreAJour();
    }
  });
  $('#filtrePlus', c)?.addEventListener('click', () => {
    const a = $('#avances', c); a.hidden = !a.hidden;
    $('#filtrePlus', c).textContent = a.hidden ? 'Plus de critères' : 'Moins de critères';
  });
  $('#reinitFiltres', c)?.addEventListener('click', () => {
    aller('#/catalogue');
  });
  c.querySelector('[name="zone"]')?.addEventListener('change', (e) => {
    requete.zone = e.target.checked; mettreAJour();
  });

  // suggestions
  champ.addEventListener('input', () => {
    const s = suggerer(champ.value);
    if (!s.length) { sug.hidden = true; return; }
    sug.innerHTML = s.map(x => `<button type="button" data-q="${esc(x.q)}"><b>${esc(x.label)}</b><span>${x.type}${x.meta ? ' · ' + esc(x.meta) : ''}</span></button>`).join('');
    sug.hidden = false;
  });
  sug.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-q]');
    if (!b) return;
    const [type, val] = b.dataset.q.split(':');
    if (type === 'ville') { requete.ville = val; c.querySelector('[name="ville"]').value = val; champ.value = ''; }
    else if (type === 'quartier') { champ.value = val; requete.ville = ''; }
    else if (type === 'type') { requete.type = val; c.querySelector('[name="type"]').value = val; champ.value = ''; }
    else if (type === 'pays') { requete.pays = val; c.querySelector('[name="pays"]').value = val; champ.value = ''; }
    sug.hidden = true;
    mettreAJour();
  });
  document.addEventListener('click', function dehors(e) {
    if (!c.isConnected) { document.removeEventListener('click', dehors); return; }
    if (!e.target.closest('.rech-champ')) sug.hidden = true;
  });

  // carte
  $('#btnCarte', c).addEventListener('click', async () => {
    q.carte = !q.carte; requete.carte = q.carte;
    await basculerCarte(c, q.carte);
    mettreAJour();
  });
  $('#btnZone', c)?.addEventListener('click', () => {
    if (etat.map) {
      etat.bounds = etat.map.getBounds();
      requete.zone = true;
      const cb = c.querySelector('[name="zone"]'); if (cb) cb.checked = true;
      mettreAJour();
      toast('Recherche limitée à la zone visible de la carte.');
    }
  });
  $('#btnZoneOff', c)?.addEventListener('click', () => {
    etat.bounds = null; requete.zone = false;
    const cb = c.querySelector('[name="zone"]'); if (cb) cb.checked = false;
    if (etat.map) etat.map.setView([46.6, 2.3], 5);
    mettreAJour();
  });

  // géolocalisation : un clic active « autour de moi », un second l'enlève
  $('#btnGeo', c).addEventListener('click', () => {
    if (form.dataset.autour === '1') {
      form.dataset.autour = '0';
      mettreAJour();
      toast('Rayon désactivé — tout le catalogue est de nouveau affiché.');
      return;
    }
    if (etat.position) {
      activerAutour(c);
    } else {
      localiser(c, true);
    }
  });
  if (!etat.position && !etat.positionDemandee) localiser(c, false);

  // délégation : cartes
  $('#resultats', c).addEventListener('click', (e) => {
    const carte = e.target.closest('[data-bien]');
    if (carte) aller(`#/bien/${carte.dataset.bien}`);
  });
  $('#resultats', c).addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('[data-bien]')) aller(`#/bien/${e.target.dataset.bien}`);
  });

  mettreAJour(false);
}

function actualiserBoutons(c, q) {
  const g = $('#btnGeo', c);
  if (g) {
    const actif = !!etat.position && !!q.autour;
    g.classList.toggle('actif', actif);
    g.setAttribute('aria-pressed', String(actif));
    g.querySelector('span').textContent = etat.position || q.autour ? 'Autour de moi' : 'Me localiser';
  }
  const rayon = $('#rayon', c);
  if (rayon) rayon.disabled = !etat.position;
  const cb = $('#btnCarte', c);
  if (cb) { cb.classList.toggle('actif', !!q.carte); cb.setAttribute('aria-pressed', String(!!q.carte)); }
}

function synchroUrl(q) {
  const p = new URLSearchParams();
  const aj = (k, v) => { if (v && v !== 'tout') p.set(k, v); };
  aj('q', q.q); aj('t', q.transaction); aj('type', q.type); aj('pays', q.pays); aj('ville', q.ville);
  aj('ch', q.chambres); aj('s', q.surface); aj('pmin', q.prixMin); aj('pmax', q.prixMax);
  aj('tri', q.tri !== 'pertinence' ? q.tri : '');
  if (q.autour) { p.set('autour', '1'); aj('rayon', q.rayon); }
  if (q.zone) p.set('zone', '1');
  if (q.carte) p.set('carte', '1');
  const h = '#/catalogue' + (p.toString() ? '?' + p.toString() : '');
  if (location.hash !== h) history.replaceState(null, '', h);
}

function afficherResultats(c, res, q) {
  const zone = $('#resultats', c);
  const resume = $('#resumeResultats', c);
  if (!zone) return;
  const pos = etat.position;
  if (resume) {
    const precision = pos ? (q.autour ? ` · rayon ${q.rayon} km` : ' · triés par distance') : '';
    resume.innerHTML = res.length
      ? `<b>${res.length}</b> bien${res.length > 1 ? 's' : ''} ${q.q ? `pour « ${esc(q.q)} »` : ''}${precision}`
      : `<b>0</b> bien ne correspond — élargissez la recherche.`;
  }
  if (!res.length) {
    zone.innerHTML = `
      <div class="vide">
        <p class="vide-ico">⌕</p>
        <h2>Aucune adresse ne correspond.</h2>
        <p>Essayez un autre quartier, retirez un filtre, ou lancez la recherche autour de vous.</p>
        <div class="vide-actions">
          <button class="btn-rech" data-vide="reset">Tout afficher</button>
          ${pos ? `<button class="lien-simple" data-vide="rayon">Élargir à 500 km</button>` : ''}
        </div>
      </div>`;
    zone.querySelector('[data-vide="reset"]').onclick = () => aller('#/catalogue');
    zone.querySelector('[data-vide="rayon"]')?.addEventListener('click', () => {
      const r = c.querySelector('[name="rayon"]'); if (r) { r.value = 500; r.dispatchEvent(new Event('input')); }
    });
    return;
  }
  zone.innerHTML = res.map((b, i) => `
    <article class="bien-carte ${i === 0 && !q.q ? 'bien-carte--vedette' : ''}" data-bien="${b.id}" tabindex="0" role="link" aria-label="${esc(b.titre)}">
      <div class="bien-visuel">
        <img src="${img(b.couverture, i === 0 && !q.q ? 1800 : 900)}" alt="" loading="${i < 3 ? 'eager' : 'lazy'}" decoding="async">
        <span class="bien-badge">${esc(b.badge)}</span>
        <span class="bien-transac">${b.transaction === 'location' ? 'Location' : 'Vente'}</span>
        <span class="bien-distance">${b.distance != null ? PAR_KM(b.distance) : ''}</span>
      </div>
      <div class="bien-corps">
        <div class="bien-prix">${PRIX(b)}${b.prixM2 ? `<small>${nf.format(b.prixM2)} €/m²</small>` : b.loyerM2 ? `<small>${nf.format(b.loyerM2)} €/m²</small>` : ''}</div>
        <h2>${esc(b.titre)}</h2>
        <p class="bien-lieu">${esc(b.quartier)} · ${esc(b.ville)}, ${esc(b.pays)} <span>${esc(b.ref)}</span></p>
        <ul class="bien-specs">
          <li><b>${b.surface}</b> m²</li>
          <li><b>${b.chambres}</b> ch.</li>
          <li><b>${b.sdb}</b> sdb</li>
          <li>${esc(b.type)}</li>
        </ul>
        <span class="bien-fleche" aria-hidden="true">Voir la fiche ↗</span>
      </div>
    </article>`).join('');
}

/* ══════════════════════════════════════════════════════════════════
   GÉOLOCALISATION
   ══════════════════════════════════════════════════════════════════ */
function activerAutour(c) {
  const form = $('#formRecherche', c);
  const champ = c.querySelector('[name="rayon"]');
  if (champ) {
    champ.disabled = false;
    if (!champ.dataset.touche) champ.value = 300;
    const out = $('#rayonSortie', c);
    if (out) out.textContent = champ.value + ' km';
  }
  form.dataset.autour = '1';
  form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  const n = c.querySelectorAll('#resultats .bien-carte').length;
  toast(`Autour de vous — ${n} bien${n > 1 ? 's' : ''} dans un rayon de ${champ ? champ.value : 300} km.`);
}

function localiser(c, manuel) {
  etat.positionDemandee = true;
  const g = $('#btnGeo', c);
  if (g) { g.classList.add('charge'); g.querySelector('span').textContent = 'Localisation…'; }
  if (!navigator.geolocation) {
    if (g) { g.classList.remove('charge'); g.querySelector('span').textContent = 'Me localiser'; }
    if (manuel) toast('La géolocalisation n’est pas disponible sur cet appareil. Utilisez la recherche par ville.');
    return;
  }
  let repondu = false;
  const echec = (message) => {
    if (repondu) return;
    repondu = true;
    etat.position = null;
    const bg = c.querySelector('#btnGeo');
    if (bg) { bg.classList.remove('charge'); bg.querySelector('span').textContent = 'Me localiser'; }
    if (manuel && message) toast(message);
  };
  // filet de sécurité : certains navigateurs n'appellent jamais le callback si la demande reste en attente
  setTimeout(() => {
    if (!repondu) echec('La localisation ne répond pas. Cherchez par ville, quartier ou pays.');
  }, 10500);
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      if (repondu || !c.isConnected) return;
      repondu = true;
      etat.position = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const g2 = c.querySelector('#btnGeo');
      if (g2) g2.classList.remove('charge');
      if (manuel) {
        activerAutour(c);
      } else {
        const tri = c.querySelector('#tri');
        if (tri) tri.value = 'distance';
        c.querySelector('#formRecherche')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        const badge = document.createElement('div');
        badge.className = 'toast-geo';
        badge.textContent = 'Position détectée — adresses triées par distance.';
        document.body.appendChild(badge);
        setTimeout(() => badge.remove(), 4600);
      }
      if (etat.map) {
        etat.map.setView([etat.position.lat, etat.position.lng], 9);
        majMarqueurs(rechercher(etatDepuisParams(new URLSearchParams(location.hash.split('?')[1] || ''))));
      }
    },
    (err) => {
      echec(err.code === 1
        ? 'Localisation refusée. Vous pouvez chercher par ville, quartier ou pays.'
        : 'Position indisponible. Réessayez ou cherchez par ville.');
    },
    { enableHighAccuracy: false, timeout: 9000, maximumAge: 300000 }
  );
}

/* ══════════════════════════════════════════════════════════════════
   CARTE LEAFLET
   ══════════════════════════════════════════════════════════════════ */
function chargerLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (etat.leaflet) return etat.leaflet;
  etat.leaflet = new Promise((res, rej) => {
    if (!document.querySelector('link[data-leaflet]')) {
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      l.dataset.leaflet = '1';
      document.head.appendChild(l);
    }
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = () => res(window.L);
    s.onerror = () => rej(new Error('Leaflet indisponible'));
    document.head.appendChild(s);
  });
  return etat.leaflet;
}

async function basculerCarte(c, visible) {
  const p = $('#panneauCarte', c);
  if (!p) return;
  p.hidden = !visible;
  c.classList.toggle('avec-carte', visible);
  if (visible) {
    await activerCarte();
    setTimeout(() => { etat.map?.invalidateSize(); }, 120);
  }
}

async function activerCarte() {
  const el = $('#carte');
  if (!el) return;
  try {
    const L = await chargerLeaflet();
    if (!etat.map) {
      const centre = etat.position ? [etat.position.lat, etat.position.lng] : [46.8, 2.4];
      etat.map = L.map(el, { zoomControl: true, scrollWheelZoom: true, attributionControl: true })
        .setView(centre, etat.position ? 9 : 5);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '© OpenStreetMap'
      }).addTo(etat.map);
      etat.map.on('moveend', () => { if ($('#panneauCarte')?.hidden === false) { /* zone manuelle */ } });
      if (etat.position) {
        L.circleMarker([etat.position.lat, etat.position.lng], {
          radius: 8, color: '#1B2433', weight: 2, fillColor: '#fff', fillOpacity: 1
        }).addTo(etat.map).bindTooltip('Vous êtes ici');
      }
    }
    setTimeout(() => etat.map?.invalidateSize(), 80);
    majMarqueurs(rechercher(etatDepuisParams(new URLSearchParams(location.hash.split('?')[1] || ''))));
  } catch (e) {
    el.innerHTML = `<div class="carte-erreur"><p>La carte n'a pas pu être chargée.</p><p>La recherche par liste reste disponible.</p></div>`;
  }
}

function majMarqueurs(res) {
  if (!etat.map || !window.L) return;
  const L = window.L;
  etat.marqueurs.forEach(m => etat.map.removeLayer(m));
  etat.marqueurs = [];
  res.forEach(b => {
    const prix = b.transaction === 'location' ? `${nf.format(b.prix)} €` : `${nf.format(Math.round(b.prix / 1000))} k€`;
    const icone = L.divIcon({
      className: 'pastille-carte',
      html: `<span>${prix}</span>`,
      iconSize: [74, 30], iconAnchor: [37, 15]
    });
    const m = L.marker([b.lat, b.lng], { icon: icone, title: b.titre })
      .addTo(etat.map)
      .bindPopup(`
        <a class="pop" href="#/bien/${b.id}">
          <img src="${img(b.couverture, 560)}" alt="">
          <b>${esc(b.titre)}</b>
          <span>${esc(b.ville)} · ${b.surface} m² · ${b.chambres} ch.</span>
          <em>${PRIX(b)}</em>
        </a>`, { closeButton: true, maxWidth: 260 });
    etat.marqueurs.push(m);
  });
  if (res.length && !etat.position && !etat.bounds) {
    const pts = res.map(b => [b.lat, b.lng]);
    etat.map.fitBounds(pts, { padding: [50, 50], maxZoom: 11 });
  }
}

/* ══════════════════════════════════════════════════════════════════
   FICHE BIEN
   ══════════════════════════════════════════════════════════════════ */
function rendreFiche(b) {
  const c = preparerVue('vue-fiche');
  const photos = b.photos;
  const plan = b.plan;
  document.title = `${b.titre} — HAVRE`;
  c.innerHTML = `
    ${enteteVue({ actif: 'catalogue', retour: '#/catalogue' })}
    <article class="v-fiche">
      <a class="v-fil" href="#/catalogue">← Toutes les propriétés</a>
      <div class="fiche-galerie">
        <div class="gal-principale">
          <img id="galImage" src="${img(photos[0], 2000)}" alt="${esc(b.titre)}">
          <div class="gal-compteur"><span id="galIndex">1</span> / ${photos.length}</div>
          <button class="gal-nav gal-prec" data-gal="-1" aria-label="Photo précédente">←</button>
          <button class="gal-nav gal-suis" data-gal="1" aria-label="Photo suivante">→</button>
        </div>
        <div class="gal-vignettes">
          ${photos.slice(1, 5).map((p, i) => `<button data-vignette="${i + 1}" aria-label="Photo ${i + 2}"><img src="${img(p, 400)}" alt="" loading="lazy"></button>`).join('')}
          <button class="gal-tout" id="galTout">Toutes les photos <span>${photos.length}</span></button>
        </div>
      </div>

      <div class="fiche-entete">
        <div class="fiche-titre">
          <p class="v-sur">${esc(b.quartier)} · ${esc(b.ville)}, ${esc(b.pays)} · ${esc(b.ref)}</p>
          <h1>${esc(b.titre)}</h1>
          <p class="fiche-sous">${esc(b.type)} · ${b.surface} m² · ${b.chambres} chambres · ${b.sdb} salles d'eau</p>
        </div>
        <div class="fiche-prix">
          <b>${PRIX(b)}</b>
          <span>${b.prixM2 ? `${nf.format(b.prixM2)} €/m²` : b.loyerM2 ? `${nf.format(b.loyerM2)} €/m² · charges comprises` : ''}</span>
          <div class="fiche-cta">
            <a class="btn-3d" href="#/visite/${b.id}"><i aria-hidden="true">◈</i> Visite 3D</a>
            <button class="btn-contact" data-contact>Demander une visite</button>
          </div>
        </div>
      </div>

      <div class="fiche-chiffres">
        ${[['Surface', b.surface + ' m²'], ['Pièces', b.pieces], ['Chambres', b.chambres], ['Salles d’eau', b.sdb],
           ['Niveaux', b.niveaux], ['Terrain', b.terrain ? nf.format(b.terrain) + ' m²' : '—'],
           ['Année', b.annee], ['DPE', b.dpe + ' / ' + b.ges]]
          .map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}
      </div>

      <div class="fiche-grille">
        <div class="fiche-texte">
          <h2>Le lieu</h2>
          <p class="fiche-desc">${esc(b.description)}</p>
          <h2>Ce qui distingue cette adresse</h2>
          <ul class="fiche-points">${b.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
          <h2>Équipements</h2>
          <ul class="fiche-tags">${b.equipements.map(e => `<li>${esc(e)}</li>`).join('')}</ul>
          <div class="fiche-energie">
            <h2>Diagnostics</h2>
            <div class="energie"><span>DPE</span><div class="jauge">${'ABCDEFG'.split('').map(l =>
              `<i class="${l === b.dpe ? 'ici' : ''} ${'ABCDE'.includes(l) ? 'bon' : 'mauvais'}">${l}</i>`).join('')}</div></div>
            <div class="energie"><span>GES</span><div class="jauge">${'ABCDEFG'.split('').map(l =>
              `<i class="${l === b.ges ? 'ici' : ''} ${'ABCDE'.includes(l) ? 'bon' : 'mauvais'}">${l}</i>`).join('')}</div></div>
            <p class="mentions">Diagnostics réalisés en 2026. Prix hors honoraires pour la vente ; loyer charges comprises pour la location.</p>
          </div>
        </div>
        <aside class="fiche-contact">
          <div class="agent">
            <div class="agent-pastille">${b.agent.initiales}</div>
            <div><b>${esc(b.agent.nom)}</b><span>Conseiller·ère · ${esc(b.ville)}</span></div>
          </div>
          <a class="lien-simple" href="tel:${b.agent.tel.replace(/\s/g, '')}">${esc(b.agent.tel)}</a>
          <form class="mini-form" id="formVisite">
            <label>Votre nom<input name="nom" required placeholder="Nom"></label>
            <label>Votre e-mail<input name="mail" type="email" required placeholder="vous@exemple.fr"></label>
            <label>Votre message<textarea name="message" rows="3">Bonjour, je souhaite visiter ${esc(b.titre)} (${b.ref}).</textarea></label>
            <button type="submit">Envoyer la demande</button>
            <p class="mini-note">Réponse sous 24 h ouvrées. Aucune donnée revendue.</p>
          </form>
        </aside>
      </div>

      <section class="fiche-plan">
        <div class="fp-tete">
          <div>
            <p class="v-sur">Plan d'origine · reconstruction</p>
            <h2>Le plan, et la maquette qui en découle.</h2>
            <p>Le même jeu de données produit le dessin coté et la visite 3D. Aucune retouche manuelle entre les deux.</p>
          </div>
          <div class="fp-onglets">
            ${plan.niveaux.map((n, i) => `<button data-niveau-plan="${i}" class="${i === 0 ? 'actif' : ''}">${n.nom}</button>`).join('')}
          </div>
        </div>
        <div class="fp-corps">
          <div class="fp-dessin" id="planDessin">${planSVG(plan, { niveau: 0 })}</div>
          <div class="fp-infos">
            <div class="fp-stat"><span>Niveaux</span><b>${plan.niveaux.length}</b></div>
            <div class="fp-stat"><span>Surface développée</span><b>${plan.surface} m²</b></div>
            <div class="fp-stat"><span>Murs porteurs</span><b>${plan.niveaux[0].murs.filter(m => m.ext).length}</b></div>
            <div class="fp-stat"><span>Ouvertures</span><b>${plan.niveaux.reduce((a, n) => a + n.murs.reduce((s, m) => s + m.ouvertures.length, 0), 0)}</b></div>
            <a class="btn-3d btn-3d--large" href="#/visite/${b.id}"><i aria-hidden="true">◈</i> Entrer dans la maison</a>
            <p class="fp-note">Murs de 30 cm en périphérie, 13 cm en cloison. Hauteur 2,75 m. Mobilier à l'échelle.</p>
          </div>
        </div>
      </section>

      <section class="fiche-sim">
        <h2>Dans le même esprit</h2>
        <div class="sim-grille">
          ${BIENS.filter(x => x.id !== b.id && (x.ville === b.ville || x.type === b.type)).slice(0, 3).map(x => `
            <a class="sim-carte" href="#/bien/${x.id}">
              <img src="${img(x.couverture, 700)}" alt="" loading="lazy">
              <div><b>${esc(x.titre)}</b><span>${esc(x.ville)} · ${x.surface} m²</span><em>${PRIX(x)}</em></div>
            </a>`).join('') || BIENS.filter(x => x.id !== b.id).slice(0, 3).map(x => `
            <a class="sim-carte" href="#/bien/${x.id}">
              <img src="${img(x.couverture, 700)}" alt="" loading="lazy">
              <div><b>${esc(x.titre)}</b><span>${esc(x.ville)} · ${x.surface} m²</span><em>${PRIX(x)}</em></div>
            </a>`).join('')}
        </div>
      </section>
    </article>
    ${piedVue()}`;

  c.scrollTop = 0;
  // galerie
  let idx = 0;
  const majGal = (n) => {
    idx = (n + photos.length) % photos.length;
    $('#galImage').src = img(photos[idx], 2000);
    $('#galIndex').textContent = idx + 1;
  };
  c.querySelectorAll('[data-gal]').forEach(btn => btn.addEventListener('click', () => majGal(idx + +btn.dataset.gal)));
  c.querySelectorAll('[data-vignette]').forEach(btn => btn.addEventListener('click', () => majGal(+btn.dataset.vignette)));
  $('#galTout')?.addEventListener('click', () => { idx = 0; majGal(0); c.querySelector('.fiche-galerie').classList.toggle('ouvert'); });
  // niveaux de plan
  c.querySelectorAll('[data-niveau-plan]').forEach(btn => btn.addEventListener('click', () => {
    c.querySelectorAll('[data-niveau-plan]').forEach(x => x.classList.toggle('actif', x === btn));
    $('#planDessin').innerHTML = planSVG(plan, { niveau: +btn.dataset.niveauPlan });
  }));
  // formulaire
  $('#formVisite')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const btn = f.querySelector('button');
    btn.textContent = 'Demande envoyée ✓';
    btn.disabled = true;
    toast(`Demande transmise à ${b.agent.nom}. Réponse sous 24 h.`);
    setTimeout(() => { btn.textContent = 'Envoyer la demande'; btn.disabled = false; f.reset(); }, 4000);
  });
  c.querySelector('[data-contact]')?.addEventListener('click', () => {
    $('#formVisite')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => $('#formVisite [name="nom"]')?.focus({ preventScroll: true }), 500);
  });
}

/* ══════════════════════════════════════════════════════════════════
   VISITE 3D
   ══════════════════════════════════════════════════════════════════ */
function ouvrirVisite(b, planImpose) {
  const socle = $('#visite');
  if (!socle) return;
  // on ne détruit pas la vue applicative : elle reste montée sous la visite
  if (etat.visite) {
    if (etat.surFermer) etat.visite.racine.removeEventListener('v3d-fermer', etat.surFermer);
    etat.surFermer = null;
    etat.visite.fermer();
    etat.visite = null;
  }
  etat.route = 'visite';
  document.body.classList.add('vue-ouverte');
  document.documentElement.classList.add('vue-ouverte');
  window.__havre?.lenis?.stop?.();
  socle.hidden = false;
  socle.innerHTML = '';
  document.title = `Visite 3D — ${b.titre}`;
  const bien = planImpose ? { ...b, plan: planImpose } : b;
  try {
    etat.visite = new Visite(socle, bien);
    const surFermer = () => {
      socle.hidden = true;
      socle.innerHTML = '';
      etat.visite = null;
      etat.surFermer = null;
      document.body.classList.add('vue-ouverte');
      document.documentElement.classList.add('vue-ouverte');
      window.__havre?.lenis?.stop?.();
      // retour au labo : on restitue la vue telle quelle (plan importé conservé)
      if (planImpose && location.hash.startsWith('#/reconstruire')) return;
      history.replaceState(null, '', planImpose ? '#/reconstruire' : `#/bien/${b.id}`);
      ouvrirRoute();
    };
    etat.surFermer = surFermer;
    etat.visite.racine.addEventListener('v3d-fermer', surFermer);
    // masque de chargement
    setTimeout(() => socle.querySelector('.v3d-charge')?.classList.add('fini'), 550);
    setTimeout(() => socle.querySelector('.v3d-charge')?.remove(), 1400);
  } catch (err) {
    socle.innerHTML = `<div class="v3d-erreur"><h2>La maquette n'a pas pu être générée.</h2><p>${esc(err.message)}</p><a href="#/catalogue">Retour au catalogue</a></div>`;
  }
}

/* ══════════════════════════════════════════════════════════════════
   JOURNAL
   ══════════════════════════════════════════════════════════════════ */
function rendreJournal() {
  const c = preparerVue('vue-journal');
  document.title = 'Journal — HAVRE';
  c.innerHTML = `
    ${enteteVue({ actif: 'journal', retour: '#accueil' })}
    <div class="j-intro">
      <p class="surtitre-v">Journal · architecture, marché, méthode</p>
      <h1 class="cat-titre">Ce que nous apprenons<br><em>des maisons.</em></h1>
      <p class="cat-sous">Notes de chantier, lectures de plans, marché. Écrites par celles et ceux qui visitent.</p>
    </div>
    <div class="j-liste">
      ${ARTICLES.map((a, i) => `
        <a class="j-carte ${i === 0 ? 'j-carte--une' : ''}" href="#/article/${a.id}">
          <img src="${img(a.image, i === 0 ? 1600 : 900)}" alt="" loading="${i < 2 ? 'eager' : 'lazy'}">
          <div class="j-corps">
            <p class="j-rub"><span>${esc(a.rubrique)}</span> · ${a.lecture} min</p>
            <h2>${esc(a.titre)}</h2>
            <p>${esc(a.chapeau)}</p>
            <span class="j-lien">Lire l'article <i>→</i></span>
          </div>
        </a>`).join('')}
    </div>
    ${piedVue()}`;
  c.scrollTop = 0;
}

function rendreArticle(a) {
  const c = preparerVue('vue-article');
  document.title = `${a.titre} — HAVRE`;
  const autres = ARTICLES.filter(x => x.id !== a.id).slice(0, 2);
  c.innerHTML = `
    ${enteteVue({ actif: 'journal', retour: '#/journal' })}
    <article class="article">
      <a class="v-fil" href="#/journal">← Journal</a>
      <p class="surtitre-v">${esc(a.rubrique)} · ${a.lecture} min de lecture</p>
      <h1>${esc(a.titre)}</h1>
      <p class="article-chapeau">${esc(a.chapeau)}</p>
      <div class="article-meta"><span>${esc(a.auteur)}</span><span>${new Date(a.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
      <img class="article-image" src="${img(a.image, 1800)}" alt="">
      <div class="article-corps">
        ${a.corps.map((p, i) => `<p ${i === 0 ? 'class="lettrine"' : ''}>${esc(p)}</p>`).join('')}
        <blockquote>Le plan ne ment pas. Il dit la lumière, les circulations, la place de chacun.</blockquote>
      </div>
      <div class="article-suite">
        ${autres.map(x => `<a href="#/article/${x.id}"><span>${esc(x.rubrique)}</span><b>${esc(x.titre)}</b></a>`).join('')}
      </div>
    </article>
    ${piedVue()}`;
  c.scrollTop = 0;
}

/* ══════════════════════════════════════════════════════════════════
   RECONSTRUCTION DE PLAN
   ══════════════════════════════════════════════════════════════════ */
function rendreReconstruction() {
  const c = preparerVue('vue-reconstruire');
  document.title = 'Plan → 3D — HAVRE';
  c.innerHTML = `
    ${enteteVue({ actif: 'reconstruire', retour: '#accueil' })}
    <div class="r-intro">
      <p class="surtitre-v">Moteur de reconstruction · v2</p>
      <h1 class="cat-titre">Un plan. <em>Une maison.</em></h1>
      <p class="cat-sous">Déposez un plan architectural (image, SVG, ou jeu de données). Le moteur lit les murs, repère les ouvertures, déduit les pièces et génère la maquette à l'échelle. Le même plan produit le dessin coté et la visite.</p>
    </div>
    <div class="r-grille">
      <section class="r-panneau">
        <div class="r-depot" id="depot">
          <input type="file" id="fichierPlan" accept="image/*,.svg,.json" hidden>
          <div class="r-ico" aria-hidden="true">⌗</div>
          <h2>Déposer un plan</h2>
          <p>PNG, JPG, SVG ou JSON — 20 Mo max.</p>
          <button type="button" class="btn-rech" id="btnParcourir">Choisir un fichier</button>
          <p class="r-note">Le fichier reste sur votre appareil : aucun envoi serveur.</p>
        </div>
        <div class="r-exemples">
          <p class="v-sur">Ou essayer un plan du catalogue</p>
          <div class="r-boutons">
            <button data-exemple="villa-belvedere-biarritz">Villa · Biarritz</button>
            <button data-exemple="loft-canal-bordeaux">Loft · Bordeaux</button>
            <button data-exemple="appartement-saint-germain">Appartement · Paris</button>
          </div>
        </div>
        <div class="r-reglages">
          <label>Hauteur des murs <output id="outH">2,75 m</output>
            <input type="range" id="regH" min="2.2" max="3.6" step="0.05" value="2.75">
          </label>
          <label>Largeur de référence <output id="outL">12 m</output>
            <input type="range" id="regL" min="5" max="40" step="0.5" value="12">
          </label>
          <label>Seuil de détection <output id="outS">120</output>
            <input type="range" id="regS" min="60" max="200" step="5" value="120">
          </label>
        </div>
      </section>
      <section class="r-resultat">
        <div class="r-onglets">
          <button class="actif" data-r="apercu">Détection</button>
          <button data-r="plan2d">Plan reconstruit</button>
          <button data-r="stats">Analyse</button>
        </div>
        <div class="r-zone">
          <div class="r-vide" id="rVide">
            <p class="r-vide-ico">⌗</p>
            <h2>En attente d'un plan</h2>
            <p>Les murs détectés apparaîtront ici, superposés au document d'origine.</p>
          </div>
          <canvas id="rApercu" hidden></canvas>
          <div class="r-plan2d" id="rPlan2d" hidden></div>
          <div class="r-stats" id="rStats" hidden></div>
        </div>
        <div class="r-pied">
          <p id="rMessage">Aucun plan chargé.</p>
          <button class="btn-3d" id="btnGenerer" disabled>Générer la maquette 3D →</button>
        </div>
      </section>
    </div>
    <section class="r-explique">
      <h2>Comment ça marche</h2>
      <div class="r-etapes">
        <div><span>01</span><h3>Vectorisation</h3><p>Le document est binarisé, puis les traits horizontaux et verticaux sont extraits, fusionnés et débruités. Chaque trait devient un mur.</p></div>
        <div><span>02</span><h3>Ouvertures</h3><p>Les interruptions du tracé sont interprétées : porte (2,12 m), fenêtre (allège 0,92 m), baie. Elles sont percées dans la maquette à la bonne hauteur.</p></div>
        <div><span>03</span><h3>Pièces</h3><p>Les volumes fermés sont remplis, mesurés et nommés. Le sol reçoit un matériau distinct selon l'usage.</p></div>
        <div><span>04</span><h3>Maquette</h3><p>Extrusion des murs, linteaux, allèges, vitrages, mobilier à l'échelle, puis visite déambulatoire avec collisions.</p></div>
      </div>
    </section>
    ${piedVue()}`;

  c.scrollTop = 0;
  let planImporte = null;
  let analyse = null;
  let modeVue = 'apercu';
  const elApercu = $('#rApercu', c);
  const elPlan = $('#rPlan2d', c);
  const elStats = $('#rStats', c);
  const elVide = $('#rVide', c);
  const elMsg = $('#rMessage', c);
  const btnGen = $('#btnGenerer', c);

  const afficherMode = (m) => {
    modeVue = m;
    c.querySelectorAll('[data-r]').forEach(b => b.classList.toggle('actif', b.dataset.r === m));
    elApercu.hidden = !(m === 'apercu' && analyse);
    elPlan.hidden = !(m === 'plan2d' && planImporte);
    elStats.hidden = !(m === 'stats' && analyse);
    elVide.hidden = !!(analyse || planImporte);
  };

  const appliquer = (res, source, nomFichier) => {
    analyse = res;
    if (res.vide) {
      elMsg.textContent = 'Aucun mur détecté. Essayez un trait plus foncé, un scan plus net, ou ajustez le seuil.';
      btnGen.disabled = true;
      afficherMode('apercu');
      return;
    }
    const hauteur = +$('#regH', c).value;
    planImporte = planDepuisMurs(res.murs, res.largeur, res.profondeur, { nom: 'Plan importé' });
    planImporte.niveaux[0].murs.forEach(m => { /* hauteur appliquée à la construction */ });
    planImporte._hauteur = hauteur;
    elPlan.innerHTML = planSVG(planImporte, { niveau: 0 });
    if (res.apercu) {
      elApercu.hidden = false;
      elApercu.width = res.apercu.width;
      elApercu.height = res.apercu.height;
      elApercu.getContext('2d').drawImage(res.apercu, 0, 0);
    }
    const nbPortes = 0;
    elStats.innerHTML = `
      <div class="r-stat"><span>Source</span><b>${esc(nomFichier)}</b></div>
      <div class="r-stat"><span>Emprise détectée</span><b>${res.largeur} × ${res.profondeur} m</b></div>
      <div class="r-stat"><span>Surface</span><b>${Math.round(res.largeur * res.profondeur)} m²</b></div>
      <div class="r-stat"><span>Murs vectorisés</span><b>${res.murs.length}</b></div>
      <div class="r-stat"><span>Pièces déduites</span><b>${res.pieces.length}</b></div>
      <div class="r-stat"><span>Échelle</span><b>${(res.echellePx).toFixed(4)} m/px</b></div>
      <div class="r-stat"><span>Niveaux</span><b>1 (import)</b></div>
      <div class="r-stat"><span>Fidélité géométrique</span><b>100 % du tracé retenu</b></div>`;
    elMsg.innerHTML = `Plan analysé : <b>${res.murs.length} murs</b>, <b>${res.pieces.length} pièces</b>. Vérifiez la détection avant de générer.`;
    btnGen.disabled = false;
    afficherMode('apercu');
  };

  const lireFichier = async (file) => {
    elMsg.textContent = 'Analyse du fichier…';
    const nom = file.name;
    try {
      if (/\.json$/i.test(nom)) {
        const txt = await file.text();
        const data = JSON.parse(txt);
        if (!data.niveaux || !data.niveaux[0]?.murs) throw new Error('JSON non reconnu : attendu { niveaux:[{ murs, pieces }] }');
        planImporte = data;
        analyse = { largeur: data.niveaux[0].largeur, profondeur: data.niveaux[0].profondeur, murs: data.niveaux[0].murs, pieces: data.niveaux[0].pieces, echellePx: 0 };
        elPlan.innerHTML = planSVG(planImporte, { niveau: 0 });
        elMsg.textContent = 'Jeu de données chargé. Génération directe, sans vectorisation.';
        elVide.hidden = true;
        btnGen.disabled = false;
        afficherMode('plan2d');
        return;
      }
      if (/\.svg$/i.test(nom)) {
        const txt = await file.text();
        const res = analyserSVGPlan(txt, { largeurMetres: +$('#regL', c).value });
        appliquer(res, 'svg', nom);
        return;
      }
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.src = url;
      await im.decode();
      const res = analyserImagePlan(im, { seuil: +$('#regS', c).value, largeurMetres: +$('#regL', c).value });
      URL.revokeObjectURL(url);
      appliquer(res, 'image', nom);
    } catch (e) {
      elMsg.textContent = 'Lecture impossible : ' + e.message;
      btnGen.disabled = true;
    }
  };

  // dépôt
  const depot = $('#depot', c);
  $('#btnParcourir', c).addEventListener('click', () => $('#fichierPlan', c).click());
  $('#fichierPlan', c).addEventListener('change', (e) => {
    if (e.target.files[0]) lireFichier(e.target.files[0]);
  });
  ['dragenter', 'dragover'].forEach(ev => depot.addEventListener(ev, (e) => { e.preventDefault(); depot.classList.add('survol'); }));
  ['dragleave', 'drop'].forEach(ev => depot.addEventListener(ev, (e) => { e.preventDefault(); depot.classList.remove('survol'); }));
  depot.addEventListener('drop', (e) => {
    const f = e.dataTransfer?.files?.[0];
    if (f) lireFichier(f);
  });

  // exemples : vrai aller-retour plan → image → détection
  c.querySelectorAll('[data-exemple]').forEach(btn => btn.addEventListener('click', async () => {
    const bien = parId(btn.dataset.exemple);
    if (!bien) return;
    elMsg.textContent = 'Rastérisation du plan du catalogue, puis détection…';
    const cv = document.createElement('canvas');
    cv.width = 1400; cv.height = 1000;
    const ctx = cv.getContext('2d');
    const meta = dessinerPlanCanvas(bien.plan, 0, ctx, cv.width, cv.height, { fond: '#FFFFFF' });
    const im = new Image();
    im.src = cv.toDataURL('image/png');
    await im.decode();
    const res = analyserImagePlan(im, {
      seuil: +$('#regS', c).value,
      largeurMetres: bien.plan.niveaux[0].largeur
    });
    appliquer(res, 'exemple', `${bien.ref} — ${bien.titre} (plan rastérisé)`);
  }));

  c.querySelectorAll('[data-r]').forEach(b => b.addEventListener('click', () => afficherMode(b.dataset.r)));
  ['regH', 'regL', 'regS'].forEach(id => {
    const el = $('#' + id, c);
    el.addEventListener('input', () => {
      if (id === 'regH') $('#outH', c).textContent = (+el.value).toFixed(2).replace('.', ',') + ' m';
      if (id === 'regL') $('#outL', c).textContent = el.value + ' m';
      if (id === 'regS') $('#outS', c).textContent = el.value;
    });
    el.addEventListener('change', () => {
      if (analyse && modeVue === 'apercu' && id === 'regS') {
        c.querySelector('[data-exemple].actif')?.click?.();
      }
    });
  });

  btnGen.addEventListener('click', () => {
    if (!planImporte) return;
    const bien = {
      id: 'import', ref: 'PLAN-IMPORT', titre: 'Plan importé',
      ville: 'Votre plan', quartier: 'reconstruction locale',
      type: 'Maison', surface: planImporte.surface, chambres: 3, sdb: 2,
      plan: planImporte
    };
    // hauteur paramétrée : on l'applique en redimensionnant les murs via la visite
    ouvrirVisite(bien, planImporte);
  });
}

/* ══════════════════════════════════════════════════════════════════
   TOAST
   ══════════════════════════════════════════════════════════════════ */
let toastTimer = null;
function toast(msg) {
  let el = $('#toastHavre');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toastHavre';
    el.className = 'toast-havre';
    document.body.appendChild(el);
  }
  el.innerHTML = `<span>${esc(msg)}</span>`;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 4200);
}
window.__havreToast = toast;

/* ══════════════════════════════════════════════════════════════════
   DÉMARRAGE
   ══════════════════════════════════════════════════════════════════ */
export function demarrer() {
  window.addEventListener('hashchange', ouvrirRoute);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.getElementById('voile')?.classList.contains('ouvert') && !document.getElementById('menuMobile')?.classList.contains('ouvert') && (location.hash.startsWith('#/catalogue') || location.hash.startsWith('#/journal') || location.hash.startsWith('#/bien') || location.hash.startsWith('#/article') || location.hash.startsWith('#/reconstruire'))) {
      aller('#accueil');
    }
  });
  // retour vers les ancres de la page d'accueil : on ferme la vue
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-retour]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (href && href.startsWith('#')) {
      fermerVue();
    }
  });
  // chrome des vues : menu mobile global et modales de la landing
  document.addEventListener('click', (e) => {
    const mlink = e.target.closest('#menuMobileLiens a');
    if (mlink && !(mlink.getAttribute('href') || '').startsWith('#/')) {
      const h = mlink.getAttribute('href');
      if (h) history.replaceState(null, '', h);
      fermerVue();
    }
    if (e.target.closest('.v-burger')) {
      window.__havre?.ouvrirMenu?.(true);
      return;
    }
    const m = e.target.closest('.vue [data-modale]');
    if (m) {
      e.preventDefault();
      window.__havre?.ouvrirModale?.(m.dataset.modale);
    }
  });
  // injecte quelques adresses en vitrine sur la page d'accueil
  const vitrine = $('#vitrineAdresses');
  if (vitrine) {
    vitrine.innerHTML = BIENS.slice(0, 3).map(b => `
      <a class="vitrine-carte" href="#/bien/${b.id}">
        <img src="${img(b.couverture, 900)}" alt="" loading="lazy">
        <div class="vitrine-corps">
          <p>${esc(b.quartier)} · ${esc(b.ville)}</p>
          <h3>${esc(b.titre)}</h3>
          <span>${b.surface} m² · ${b.chambres} ch. · ${esc(b.type)}</span>
          <b>${PRIX(b)}</b>
        </div>
      </a>`).join('');
  }
  const jAccueil = $('#journalAccueil');
  if (jAccueil) {
    jAccueil.innerHTML = ARTICLES.slice(0, 3).map(a => `
      <a class="j-carte j-carte--accueil" href="#/article/${a.id}">
        <img src="${img(a.image, 800)}" alt="" loading="lazy">
        <div class="j-corps">
          <p class="j-rub"><span>${esc(a.rubrique)}</span> · ${a.lecture} min</p>
          <h2>${esc(a.titre)}</h2>
        </div>
      </a>`).join('');
  }
  // compteurs
  $$('[data-compte]').forEach(el => {
    const k = el.dataset.compte;
    el.textContent = k === 'biens' ? BIENS.length : k === 'pays' ? PAYS.length : k === 'articles' ? ARTICLES.length : '';
  });
  // recherche depuis la page d'accueil
  $('#rechercheAccueil')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = e.target.querySelector('input').value.trim();
    aller('#/catalogue' + (v ? '?q=' + encodeURIComponent(v) : ''));
  });
  if (location.hash.startsWith('#/')) ouvrirRoute();
}
