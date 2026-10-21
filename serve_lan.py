#!/usr/bin/env python3
"""Serveur statique local pour AURA-immo.

  python3 serve_lan.py [port]

Le HTML utilise des imports ESM depuis un CDN : il faut passer par HTTP,
un double-clic sur index.html echoue (origine file://).
"""
import http.server
import os
import socket
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
RACINE = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=RACINE, **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


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
        print(f"HAVRE — servi sur http://{ip_locale()}:{PORT}/")
        srv.serve_forever()
