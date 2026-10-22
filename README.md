# Havre

Site immobilier « grand format » : landing immersive, catalogue de biens, fiches, journal, recherche géolocalisée et visite 3D reconstruite depuis un plan.

## Stack

- HTML natif, CSS
- Three.js r170 (visite 3D)
- GSAP ScrollTrigger 3.12.5 + Lenis 1.1.0 (landing)
- Leaflet + OpenStreetMap (carte)
- Aucune étape de build : le site est servi tel quel.

## Structure

```
index.html            landing (scène 3D, styles de référence)
assets/data.js        28 biens, 6 articles, plans, générateur de plans
assets/app.js         routeur, catalogue, fiche, journal, labo plan → 3D
assets/visite3d.js    moteur plan → 3D, collisions, HUD, analyseurs SVG/JSON/image
assets/style-app.css  styles des vues applicatives
serve_lan.py          petit serveur local (python3 serve_lan.py 8080)
```

## Routes

- `#/mentions` (mentions légales, confidentialité, honoraires)
- `#/catalogue`
- `#/bien/:id`
- `#/journal`
- `#/article/:id`
- `#/reconstruire` (import de plan : image, SVG ou JSON)
- `#/visite/:id`

## Lancer en local

```bash
python3 serve_lan.py 8080
# http://127.0.0.1:8080
```

## En ligne

**https://havre-olive.vercel.app**

## Déploiement

Site statique : aucun build. Sur Vercel, le dossier racine est publié directement.

## Points à compléter avant mise en ligne

| Où | Quoi |
|---|---|
| `assets/data.js` → `AGENCE.tel` | numéro de téléphone réel (valeur actuelle : démonstration) |
| `assets/data.js` → `AGENCE.mentions` | raison sociale, SIRET, carte professionnelle, éditeur, hébergeur |
| `index.html` → `AGENCE_TEL` | même numéro, source unique pour les liens `data-tel` |
| `index.html` → `ENDPOINT_FORMULAIRE` | URL d'envoi (route serveur, Resend, Formspree). Vide = aucun envoi, un avertissement s'affiche |
| `#/mentions`, section Équipe (`#agence`) | noms, photos, rôles |
| `AGENCE.contact` | nom, adresse postale et e-mail de contact |

Tant que `ENDPOINT_FORMULAIRE` est vide, les formulaires **n'envoient rien** et le disent explicitement à l'utilisateur (pas de faux message de succès).

## Crédits

Photographies : Unsplash. Fond de carte : OpenStreetMap / Leaflet.
