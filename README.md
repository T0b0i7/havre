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

## Déploiement

Site statique : aucun build. Sur Vercel, le dossier racine est publié directement.

## Crédits

Photographies : Unsplash. Fond de carte : OpenStreetMap / Leaflet.
