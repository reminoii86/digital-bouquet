"""Local dev server for testing on a phone over Wi-Fi: python3 tools/serve.py [port]

Sends Cache-Control: no-store so iOS Safari never reuses an old styles.css or module.
"""
import functools
import http.server
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class NoStoreHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


http.server.ThreadingHTTPServer.request_queue_size = 128  # many parallel ES module requests
server = http.server.ThreadingHTTPServer(("", PORT), functools.partial(NoStoreHandler, directory=str(ROOT)))
print(f"Serving {ROOT} on port {PORT} (no-store)")
server.serve_forever()
