from concurrent.futures import ThreadPoolExecutor
from email.message import EmailMessage
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse
import base64
import json
import mimetypes
import os
import re
import threading
import time
import urllib.error
import urllib.request
import webbrowser


APP_DIR = Path(__file__).resolve().parent
CREDENTIALS_PATH = APP_DIR / "credentials.json"
TOKEN_PATH = APP_DIR / "token.json"
PORT = int(os.environ.get("RETRO_MAIL_PORT", "8765"))
REDIRECT_URI = f"http://localhost:{PORT}/oauth2callback"
SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
]
SCOPE = " ".join(SCOPES)
FOLDERS = {
    "Inbox": {"labelIds": ["INBOX"], "query": "-in:chats"},
    "Starred": {"labelIds": ["STARRED"], "query": "-in:chats"},
    "Sent": {"labelIds": ["SENT"], "query": "-in:chats"},
    "Drafts": {"labelIds": ["DRAFT"], "query": "-in:chats"},
    "Spam": {"labelIds": ["SPAM"], "query": "-in:chats"},
    "Archive": {"labelIds": [], "query": "-in:inbox -in:sent -in:drafts -in:trash -in:spam -in:chats"},
    "All": {"labelIds": [], "query": "-in:trash -in:spam -in:chats"},
}
LIST_WORKERS = 12
_counts_cache = {"time": 0.0, "data": {}}
_token_lock = threading.Lock()


def read_json(path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path, data):
    with path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2)


def credentials():
    if not CREDENTIALS_PATH.exists():
        raise RuntimeError("credentials.json bulunamadı")
    raw = read_json(CREDENTIALS_PATH)
    return raw.get("installed") or raw.get("web") or raw


def token():
    if not TOKEN_PATH.exists():
        return None
    with _token_lock:
        data = read_json(TOKEN_PATH)
        existing_scope = set(data.get("scope", "").split())
        if not set(SCOPES).issubset(existing_scope):
            return None
        if data.get("expires_at", 0) - 60 > time.time():
            return data
        return refresh_token(data)


def refresh_token(data):
    if not data.get("refresh_token"):
        return None
    client = credentials()
    try:
        refreshed = post_form(
            "https://oauth2.googleapis.com/token",
            {
                "client_id": client["client_id"],
                "client_secret": client["client_secret"],
                "refresh_token": data["refresh_token"],
                "grant_type": "refresh_token",
            },
        )
    except urllib.error.HTTPError as exc:
        if exc.code in (400, 401):
            if TOKEN_PATH.exists():
                TOKEN_PATH.unlink()
            return None
        raise
    data.update(refreshed)
    data["expires_at"] = time.time() + int(refreshed.get("expires_in", 3600))
    write_json(TOKEN_PATH, data)
    return data


def request_json(url, method="GET", data=None, params=None):
    current = token()
    if not current:
        raise PermissionError("Gmail bağlantısı yok")
    query = f"?{urlencode(params or {}, doseq=True)}" if params else ""
    body = json.dumps(data).encode("utf-8") if data is not None else None
    headers = {"Authorization": f"Bearer {current['access_token']}"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url + query, data=body, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=30) as response:
        raw = response.read().decode("utf-8")
        return json.loads(raw) if raw else {}


def post_form(url, values):
    body = urlencode(values).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def gmail(path, method="GET", data=None, params=None):
    return request_json(f"https://gmail.googleapis.com/gmail/v1/users/me/{path}", method, data, params)


def decode_part(data):
    if not data:
        return ""
    padded = data + "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8", "replace")


def plain_body(payload):
    if payload.get("mimeType") == "text/plain":
        return decode_part(payload.get("body", {}).get("data"))
    for part in payload.get("parts", []) or []:
        body = plain_body(part)
        if body:
            return body
    if payload.get("mimeType") == "text/html":
        html = decode_part(payload.get("body", {}).get("data"))
        return re.sub(r"<[^>]+>", " ", html)
    return ""


def find_parts(payload, mime_type, found=None):
    if found is None:
        found = []
    if payload.get("mimeType") == mime_type:
        found.append(payload)
    for part in payload.get("parts", []) or []:
        find_parts(part, mime_type, found)
    return found


def html_body(payload):
    parts = find_parts(payload, "text/html")
    if not parts:
        return ""
    return decode_part(parts[0].get("body", {}).get("data"))


def urlsafe_to_standard_b64(data):
    padded = data + "=" * (-len(data) % 4)
    raw = base64.urlsafe_b64decode(padded.encode("utf-8"))
    return base64.b64encode(raw).decode("ascii")


def to_data_url(mime_type, urlsafe_b64_data):
    return f"data:{mime_type};base64,{urlsafe_to_standard_b64(urlsafe_b64_data)}"


def collect_inline_images(payload, message_id, mapping=None):
    if mapping is None:
        mapping = {}
    headers = payload.get("headers", [])
    content_id = header(headers, "Content-ID").strip("<>")
    mime_type = payload.get("mimeType", "")
    if content_id and mime_type.startswith("image/"):
        body = payload.get("body", {})
        try:
            if body.get("data"):
                mapping[content_id] = to_data_url(mime_type, body["data"])
            elif body.get("attachmentId"):
                attachment = gmail(f"messages/{message_id}/attachments/{body['attachmentId']}")
                if attachment.get("data"):
                    mapping[content_id] = to_data_url(mime_type, attachment["data"])
        except Exception:
            pass
    for part in payload.get("parts", []) or []:
        collect_inline_images(part, message_id, mapping)
    return mapping


def sanitize_html(html):
    html = re.sub(r"(?is)<script.*?>.*?</script>", "", html)
    html = re.sub(r"(?i)\son\w+\s*=\s*(\"[^\"]*\"|'[^']*'|[^\s>]+)", "", html)
    html = re.sub(r"(?i)(href|src)\s*=\s*(\"javascript:[^\"]*\"|'javascript:[^']*')", r'\1="#"', html)
    return html


def message_detail(message_id):
    message = gmail(f"messages/{message_id}", params={"format": "full"})
    payload = message.get("payload", {})
    text = plain_body(payload)
    html = html_body(payload)
    if html:
        html = sanitize_html(html)
        images = collect_inline_images(payload, message_id)
        if images:
            html = re.sub(r"cid:([^\"'\s)]+)", lambda m: images.get(m.group(1), m.group(0)), html)
    return {"id": message_id, "text": text, "html": html}


def header(headers, name):
    for item in headers or []:
        if item.get("name", "").lower() == name.lower():
            return item.get("value", "")
    return ""


def extract_email(value):
    match = re.search(r"<([^>]+)>", value or "")
    return (match.group(1) if match else value).strip()


def label_count(label_id):
    try:
        label = gmail(f"labels/{label_id}")
        return int(label.get("messagesTotal", 0))
    except Exception:
        return 0


def search_count(query):
    try:
        result = gmail("messages", params={"q": query, "maxResults": 1})
        return int(result.get("resultSizeEstimate", 0))
    except Exception:
        return 0


def folder_counts():
    now = time.time()
    if _counts_cache["data"] and now - _counts_cache["time"] < 15:
        return _counts_cache["data"]
    tasks = {
        "Inbox": lambda: label_count("INBOX"),
        "Starred": lambda: label_count("STARRED"),
        "Sent": lambda: label_count("SENT"),
        "Drafts": lambda: label_count("DRAFT"),
        "Spam": lambda: label_count("SPAM"),
        "Archive": lambda: search_count(FOLDERS["Archive"]["query"]),
        "All": lambda: search_count(FOLDERS["All"]["query"]),
    }
    with ThreadPoolExecutor(max_workers=len(tasks)) as pool:
        futures = {name: pool.submit(fn) for name, fn in tasks.items()}
        result = {name: future.result() for name, future in futures.items()}
    _counts_cache["data"] = result
    _counts_cache["time"] = now
    return result


def message_to_view(message, folder):
    payload = message.get("payload", {})
    headers = payload.get("headers", [])
    labels = set(message.get("labelIds", []))
    return {
        "id": message.get("id"),
        "threadId": message.get("threadId"),
        "folder": folder,
        "from": header(headers, "From"),
        "to": header(headers, "To"),
        "subject": header(headers, "Subject"),
        "date": header(headers, "Date"),
        "preview": message.get("snippet", ""),
        "unread": "UNREAD" in labels,
        "starred": "STARRED" in labels,
        "labels": list(labels),
    }


def list_messages(folder="Inbox", limit=50, search="", page_token=""):
    profile = gmail("profile")
    config = FOLDERS.get(folder, FOLDERS["Inbox"])
    query = " ".join(part for part in [config["query"], search] if part).strip()
    params = {"maxResults": max(1, min(limit, 100))}
    if config["labelIds"]:
        params["labelIds"] = config["labelIds"]
    if query:
        params["q"] = query
    if page_token:
        params["pageToken"] = page_token
    listing = gmail("messages", params=params)
    items = listing.get("messages", [])
    detail_params = {"format": "metadata", "metadataHeaders": ["From", "To", "Subject", "Date"]}
    messages = [None] * len(items)

    def fetch(index, item):
        message = gmail(f"messages/{item['id']}", params=detail_params)
        messages[index] = message_to_view(message, folder)

    if items:
        with ThreadPoolExecutor(max_workers=min(LIST_WORKERS, len(items))) as pool:
            list(pool.map(lambda pair: fetch(*pair), enumerate(items)))
    return {
        "email": profile.get("emailAddress", ""),
        "folder": folder,
        "counts": folder_counts(),
        "messages": messages,
        "nextPageToken": listing.get("nextPageToken", ""),
    }


def modify_message(message_id, add=None, remove=None):
    return gmail(
        f"messages/{message_id}/modify",
        method="POST",
        data={"addLabelIds": add or [], "removeLabelIds": remove or []},
    )


def raw_email(to_address, subject, body, sender=None):
    message = EmailMessage()
    message["To"] = to_address
    if sender:
        message["From"] = sender
    message["Subject"] = subject
    message.set_content(body)
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
    return raw


def send_mail(to_address, subject, body):
    if not to_address:
        raise ValueError("Alıcı adresi gerekli")
    return gmail("messages/send", method="POST", data={"raw": raw_email(to_address, subject, body)})


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(APP_DIR), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/messages":
            self.handle_messages(parsed)
            return
        if parsed.path == "/api/message":
            self.handle_message_detail(parsed)
            return
        if parsed.path == "/auth/start":
            self.handle_auth_start()
            return
        if parsed.path == "/oauth2callback":
            self.handle_oauth_callback(parsed)
            return
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/action":
            self.handle_action()
            return
        self.send_json(404, {"error": "not_found"})

    def body_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def handle_auth_start(self):
        try:
            client = credentials()
            url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(
                {
                    "client_id": client["client_id"],
                    "redirect_uri": REDIRECT_URI,
                    "response_type": "code",
                    "scope": SCOPE,
                    "access_type": "offline",
                    "prompt": "consent",
                    "include_granted_scopes": "true",
                }
            )
            self.send_response(302)
            self.send_header("Location", url)
            self.end_headers()
        except Exception as exc:
            self.send_text(500, f"Auth başlatılamadı: {exc}")

    def handle_oauth_callback(self, parsed):
        params = parse_qs(parsed.query)
        code = params.get("code", [None])[0]
        if not code:
            self.send_text(400, "Google yetki kodu gelmedi.")
            return
        try:
            client = credentials()
            data = post_form(
                "https://oauth2.googleapis.com/token",
                {
                    "code": code,
                    "client_id": client["client_id"],
                    "client_secret": client["client_secret"],
                    "redirect_uri": REDIRECT_URI,
                    "grant_type": "authorization_code",
                },
            )
            data["expires_at"] = time.time() + int(data.get("expires_in", 3600))
            data["scope"] = data.get("scope", SCOPE)
            write_json(TOKEN_PATH, data)
            self.send_html(200, success_html())
        except Exception as exc:
            self.send_text(500, f"Token alınamadı: {exc}")

    def handle_messages(self, parsed):
        try:
            params = parse_qs(parsed.query)
            limit = int(params.get("limit", ["50"])[0])
            folder = params.get("folder", ["Inbox"])[0]
            search = params.get("search", [""])[0]
            page_token = params.get("pageToken", [""])[0]
            self.send_json(200, list_messages(folder, limit, search, page_token))
        except PermissionError:
            self.send_json(401, {"error": "not_connected", "authUrl": "/auth/start"})
        except urllib.error.HTTPError as exc:
            self.send_json(exc.code, {"error": exc.read().decode("utf-8", "replace")})
        except Exception as exc:
            self.send_json(500, {"error": str(exc)})

    def handle_message_detail(self, parsed):
        try:
            params = parse_qs(parsed.query)
            message_id = params.get("id", [""])[0]
            if not message_id:
                self.send_json(400, {"error": "id_required"})
                return
            self.send_json(200, message_detail(message_id))
        except PermissionError:
            self.send_json(401, {"error": "not_connected", "authUrl": "/auth/start"})
        except urllib.error.HTTPError as exc:
            self.send_json(exc.code, {"error": exc.read().decode("utf-8", "replace")})
        except Exception as exc:
            self.send_json(500, {"error": str(exc)})

    def handle_action(self):
        try:
            data = self.body_json()
            action = data.get("action")
            message_id = data.get("id")
            if action == "markRead":
                modify_message(message_id, remove=["UNREAD"])
                self.send_json(200, {"ok": True})
                return
            if action == "markUnread":
                modify_message(message_id, add=["UNREAD"])
                self.send_json(200, {"ok": True})
                return
            if action == "star":
                modify_message(message_id, add=["STARRED"] if data.get("starred") else [], remove=[] if data.get("starred") else ["STARRED"])
                self.send_json(200, {"ok": True})
                return
            if action == "archive":
                modify_message(message_id, remove=["INBOX"])
                self.send_json(200, {"ok": True})
                return
            if action == "send":
                send_mail(data.get("to", ""), data.get("subject", ""), data.get("body", ""))
                self.send_json(200, {"ok": True})
                return
            if action == "disconnect":
                if TOKEN_PATH.exists():
                    TOKEN_PATH.unlink()
                self.send_json(200, {"ok": True})
                return
            self.send_json(400, {"error": "unknown_action"})
        except PermissionError:
            self.send_json(401, {"error": "not_connected", "authUrl": "/auth/start"})
        except urllib.error.HTTPError as exc:
            self.send_json(exc.code, {"error": exc.read().decode("utf-8", "replace")})
        except Exception as exc:
            self.send_json(500, {"error": str(exc)})

    def send_json(self, status, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_text(self, status, text):
        body = text.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_html(self, status, html):
        body = html.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def guess_type(self, path):
        guessed = mimetypes.guess_type(path)[0]
        return guessed or super().guess_type(path)


def success_html():
    return """<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="2; url=/">
  <title>Retro Mail 95</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #008080; font: 12px "MS Sans Serif", Tahoma, Arial, sans-serif; }
    .box { width: min(420px, calc(100vw - 24px)); padding: 14px; background: #c0c0c0; border-top: 2px solid #fff; border-left: 2px solid #fff; border-right: 2px solid #404040; border-bottom: 2px solid #404040; box-shadow: 2px 2px 0 rgba(0,0,0,.45); }
    h1 { margin: 0 0 10px; padding: 4px 6px; color: #fff; background: #000080; font-size: 12px; }
    a { color: #000080; font-weight: 700; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Retro Mail 95</h1>
    <p>Gmail bağlandı. Inbox yükleniyor...</p>
    <p>Otomatik dönmezse <a href="/">Retro Mail 95'e dön</a>.</p>
  </div>
</body>
</html>"""


def main():
    print(f"Retro Mail 95 calisiyor: http://localhost:{PORT}")
    print("Gmail baglamak icin: http://localhost:%s/auth/start" % PORT)
    webbrowser.open(f"http://localhost:{PORT}")
    ThreadingHTTPServer(("localhost", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
