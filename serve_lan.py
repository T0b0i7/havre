#!/usr/bin/env python3
"""Serveur de développement local pour HAVRE avec pont IA Vision.

  python3 serve_lan.py [port]

Prend en charge la route POST /api/analyser-plan pour vectoriser
un plan d'architecte via Google Gemini 1.5 Flash (ou fallback automatique).
"""
import http.server
import json
import os
import re
import socket
import socketserver
import sys
import urllib.error
import urllib.request

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
RACINE = os.path.dirname(os.path.abspath(__file__))
GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "").strip()


def appeler_gemini_vision(image_bytes, mime_type, largeur_ref=12.0, hauteur_mur=2.75):
    """Interroge Gemini 3.5 Flash Lite pour extraire les murs et pièces au format JSON."""
    if not GEMINI_KEY:
        return None, "Clé GEMINI_API_KEY absente."

    import base64
    b64_image = base64.b64encode(image_bytes).decode("utf-8")

    prompt = f"""Tu es un architecte métreur expert et un moteur de conversion de plans en maquettes 3D immersives.
Analyse précisément ce plan architectural d'habitation et convertis-le en une maquette géométrique 3D normalisée avec murs, ouvertures réelles et pièces.

Largeur totale estimée : environ {largeur_ref:.1f} mètres (mais si des cotes ou surfaces sont écrites sur le plan, utilise l'échelle réelle déduite du plan).
Hauteur standard des murs : {hauteur_mur:.2f} mètres.

Consignes impératives :
1. Repère orthogonal en mètres : l'origine (x=0, z=0) est située au coin supérieur gauche de la boîte englobante du plan.
   - x croît vers la droite (largeur).
   - z croît vers le bas (profondeur).
2. Détecte les murs principaux (extérieurs et refends intérieurs).
   - Chaque mur a deux points : x1, z1, x2, z2.
   - Épaisseur "ep" : 0.25 à 0.35m pour les murs extérieurs ("ext": true), 0.10 à 0.15m pour les cloisons intérieures ("ext": false).
3. OUVERTURES SUR LES MURS (CRUCIAL) :
   - Pour chaque mur ayant une porte ou une fenêtre, ajoute la liste "ouvertures".
   - Chaque ouverture a :
     * "type" : 'porte', 'fenetre' ou 'baie'
     * "t" : position relative le long du mur entre 0.0 (début x1,z1) et 1.0 (fin x2,z2). Ex: 0.5 = au milieu.
     * "largeur" : largeur en mètres (ex: 0.90 pour une porte standard, 1.20 à 1.60 pour une fenêtre, 2.0 à 3.0 pour une baie).
     * "hauteur" : hauteur de l'ouverture (ex: 2.12 pour une porte, 1.40 pour une fenêtre, 2.20 pour une baie).
     * "allege" : 0 pour une porte ou baie vitrée, 0.85 à 0.95 pour une fenêtre standard.
4. PIÈCES :
   - Détecte les pièces principales avec leur type ('sejour', 'chambre', 'cuisine', 'sdb', 'entree', 'couloir', 'terrasse').
   - Position de la boîte englobante de la pièce : x, z, w (largeur), d (profondeur).

Réponds STRICTEMENT par un objet JSON valide, sans markdown, avec cette structure :
{{
  "largeur": 12.0,
  "profondeur": 9.5,
  "echelleDeduisible": true,
  "murs": [
    {{
      "x1": 0.0, "z1": 0.0, "x2": 12.0, "z2": 0.0, "ep": 0.30, "ext": true,
      "ouvertures": [
        {{ "type": "fenetre", "t": 0.25, "largeur": 1.4, "hauteur": 1.4, "allege": 0.9 }},
        {{ "type": "baie", "t": 0.75, "largeur": 2.4, "hauteur": 2.2, "allege": 0.0 }}
      ]
    }},
    {{
      "x1": 0.0, "z1": 0.0, "x2": 0.0, "z2": 9.5, "ep": 0.30, "ext": true,
      "ouvertures": [
        {{ "type": "porte", "t": 0.5, "largeur": 0.95, "hauteur": 2.12, "allege": 0.0 }}
      ]
    }}
  ],
  "pieces": [
    {{ "nom": "Séjour", "type": "sejour", "x": 0.3, "z": 0.3, "w": 6.5, "d": 5.0, "couleur": "#F4E9DA" }},
    {{ "nom": "Chambre 1", "type": "chambre", "x": 7.0, "z": 0.3, "w": 4.5, "d": 4.0, "couleur": "#EDE9F7" }}
  ]
}}"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key={GEMINI_KEY}"
    payload = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {"inline_data": {"mime_type": mime_type, "data": b64_image}}
            ]
        }],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json"
        }
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            texte = data["candidates"][0]["content"]["parts"][0]["text"]
            # Nettoyage d'éventuels backticks markdown
            texte = re.sub(r"^```(?:json)?\s*", "", texte.strip(), flags=re.MULTILINE)
            texte = re.sub(r"```$", "", texte.strip(), flags=re.MULTILINE)
            resultat = json.loads(texte)
            return resultat, None
    except Exception as e:
        return None, str(e)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=RACINE, **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass

    def do_POST(self):
        if self.path == "/api/analyser-plan":
            longueur = int(self.headers.get("Content-Length", 0))
            corps = self.rfile.read(longueur)
            try:
                donnees = json.loads(corps.decode("utf-8"))
                image_base64 = donnees.get("image", "")
                mime = donnees.get("mime", "image/jpeg")
                largeur = float(donnees.get("largeur", 12.0))
                hauteur = float(donnees.get("hauteur", 2.75))

                import base64
                if "," in image_base64:
                    entete, b64 = image_base64.split(",", 1)
                    if "image/png" in entete:
                        mime = "image/png"
                    elif "image/webp" in entete:
                        mime = "image/webp"
                else:
                    b64 = image_base64

                image_bytes = base64.b64decode(b64)

                res, erreur = appeler_gemini_vision(image_bytes, mime, largeur, hauteur)
                if res:
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"ok": True, "plan": res, "moteur": "gemini-1.5-flash"}).encode("utf-8"))
                else:
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "ok": False,
                        "erreur": erreur,
                        "fallback": True
                    }).encode("utf-8"))
            except Exception as e:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "erreur": str(e)}).encode("utf-8"))
            return

        super().do_POST()


class Serveur(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def ip_locale():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


if __name__ == "__main__":
    with Serveur(("0.0.0.0", PORT), Handler) as srv:
        cle_statut = "activée" if GEMINI_KEY else "non configurée (mode fallback local)"
        print(f"HAVRE — servi sur http://{ip_locale()}:{PORT}/ [IA Gemini: {cle_statut}]")
        srv.serve_forever()
