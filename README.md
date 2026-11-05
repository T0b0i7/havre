# Havre

**Prototype de site immobilier immersif** : page d’accueil, catalogue de biens, fiches, journal, recherche géolocalisée et visite 3D reconstruite à partir d’un plan.

> **Démo / prototype :** les biens et informations d’agence sont des exemples. Ce dépôt n’est pas celui d’une agence immobilière réelle et ne doit pas être utilisé comme site commercial tant que les informations légales, les coordonnées et le traitement des formulaires ne sont pas configurés et vérifiés.

- **Démo :** [havre-olive.vercel.app](https://havre-olive.vercel.app)
- **Technologies :** HTML, CSS, JavaScript, Three.js, GSAP, Lenis, Leaflet et OpenStreetMap
- **Build :** aucune étape de compilation ; le site statique est servi directement

## Fonctionnalités

- Catalogue de biens et fiches détaillées
- Journal et articles
- Recherche cartographique
- Import de plans (image, SVG ou JSON) et aperçu de visite 3D

## Structure

```text
index.html            page d’accueil et styles principaux
assets/data.js        données de démonstration (biens, articles et plans)
assets/app.js         navigation et vues du catalogue, des fiches et du journal
assets/visite3d.js    visite 3D, collisions et analyse des plans
assets/style-app.css  styles des vues
serve_lan.py          serveur local de développement
```

## Lancer localement

```bash
python3 serve_lan.py 8080
```

Puis ouvre <http://127.0.0.1:8080>.

## À configurer avant toute utilisation réelle

- Remplacer les données d’exemple et fournir des informations exactes sur les biens.
- Renseigner l’identité de l’agence, ses coordonnées et les mentions légales applicables.
- Configurer et tester un endpoint serveur pour les formulaires. Sans endpoint, ceux-ci ne transmettent pas les demandes.
- Vérifier les droits d’utilisation des images et contenus publiés.

Photographies de démonstration : Unsplash. Cartes : OpenStreetMap via Leaflet.
