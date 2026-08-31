# Submission — Retro Mail 95

**Repository:** https://github.com/YOUR-USERNAME/retro-mail-95
**Live demo:** https://YOUR-USERNAME.github.io/retro-mail-95/

---

## One-liner (for a title field)

A Gmail client that looks like Windows 95 and runs entirely on your own machine — in a single dependency-free Python file.

---

## Short description (~60 words)

Retro Mail 95 is a local-first Gmail client wrapped in a pixel-faithful Windows 95 interface. It reads, searches, sends, replies, forwards, archives and stars real mail through the Gmail API — with no delete path anywhere in the code. The frontend is vanilla HTML/CSS/JS; the backend is one Python file using nothing but the standard library.

---

## Full description

**Retro Mail 95** is a working Gmail client with the interface of a 1995 desktop application: a blue title bar, beveled buttons, dropdown menus, a folder pane, a reading pane and a status bar — all rebuilt in plain CSS, with no UI framework and no images.

Behind the nostalgia it is a real mail client. It authenticates with Google over OAuth 2.0 and uses the Gmail REST API to list and search messages across Inbox, Starred, Sent, Drafts, Spam, Archive and All Mail; render plain-text and HTML bodies (sanitized, sandboxed, with inline images inlined as data URLs); compose, reply and forward; archive, star and mark read/unread; and poll for new mail in the background.

Two constraints shaped the project:

1. **Zero dependencies.** The entire backend is one Python file built on the standard library — `http.server`, `urllib`, `base64`, `email`. There is no `pip install`, no Node build step and no framework. Cloning the repo and running `python server.py` is the whole setup.

2. **Nothing leaves your machine.** There is no hosted backend. The server binds to `localhost`, OAuth tokens are written to a git-ignored file next to the script, and the app requests only the `gmail.modify` and `gmail.send` scopes — so by construction it cannot delete a message or empty your trash, no matter what goes wrong.

The live demo runs the exact same frontend against sample messages, so you can explore the interface — folders, search, reading pane, compose, archive, star — without connecting an account.

**Built with:** Vanilla JavaScript · CSS · Python 3 (standard library only) · Gmail API v1 · OAuth 2.0

---

## Try it in 30 seconds

Open the demo, double-click around the window: switch folders in the left pane, click a message, use the menu bar (File / Edit / View / Message / Tools), type in the search box, press **New** to compose, or close the window with the ✕ and reopen it from the desktop icon.
