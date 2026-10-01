"""Internal HTTP facade for the get_ad tool, not a general-purpose MCP server."""
import hmac
import json
import os
import re
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from adapter import get_ad, ImportFailure

busy = threading.BoundedSemaphore(1)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # Never print headers, tokens or third-party exceptions.

    def respond(self, status, data):
        payload = json.dumps(data, ensure_ascii=False, default=str).encode('utf8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        try:
            self.wfile.write(payload)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        if self.path == '/health':
            try:
                import lbc
                del lbc
                self.respond(200, {'status': 'ready'})
            except ImportError:
                self.respond(503, {'status': 'unavailable'})
            return
        token = os.environ.get('LEBONCOIN_SERVICE_TOKEN', '')
        if not token or not hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + token):
            self.respond(401, {'code': 'LEBONCOIN_SERVICE_UNAVAILABLE'})
            return
        match = re.fullmatch(r'/ads/([1-9]\d{0,19})', self.path)
        if not match:
            self.respond(400, {'code': 'LISTING_ID_NOT_FOUND'})
            return
        if not busy.acquire(blocking=False):
            self.respond(503, {'code': 'LEBONCOIN_SERVICE_UNAVAILABLE'})
            return
        try:
            self.respond(200, get_ad(match.group(1)))
        except ImportFailure as error:
            self.respond(error.status, {'code': error.code})
        except Exception:
            self.respond(503, {'code': 'LEBONCOIN_IMPORT_FAILED'})
        finally:
            busy.release()


if __name__ == '__main__':
    if len(os.environ.get('LEBONCOIN_SERVICE_TOKEN', '')) < 32:
        raise SystemExit('LEBONCOIN_SERVICE_TOKEN doit contenir au moins 32 caractères.')
    ThreadingHTTPServer((os.environ.get('HOST', '127.0.0.1'), int(os.environ.get('PORT', '8001'))), Handler).serve_forever()
