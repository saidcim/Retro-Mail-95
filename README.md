# Retro Mail 95

A Gmail client that looks like it shipped on a floppy disk in 1995 — and runs entirely on your own machine.

**[Live demo](https://saidcim.github.io/Retro-Mail-95/)**

![Retro Mail 95](docs/screenshot.png)

## What it is

Retro Mail 95 is a fully local email viewer I designed based on my own tastes, drawing inspiration from Windows 95. It connects to your email via the Gmail API, allowing you to read, search, send, reply, forward, archive, star, and mark messages. It requires no third-party dependencies; it runs via a single Python script and opens in your browser.

## Why

Modern email clients are often too plain and simple; while this might appeal to some—or even most—users, it triggers my attachment to retro style. Besides, being old doesn't always mean being bad—never judge a book by its cover :)

## Features

- All buttons are operational and fully functional: Archive, star/unstar, mark as read/unread.
- We also have the same folders here as in Gmail: Inbox, Starred, Sent, Drafts, Spam, Archive, All Mail.
- There is no problem with displaying HTML emails either. both plain-text and HTML mail are readable
- Auto-refresh polling for new mail (toggleable), pauses when the tab is hidden or a compose window is open
- Navigation can be done by using arrow keys on the keyboard
- We can compose, reply to, and forward messages using the Gmail API.

| Layer | Stack |
| --- | --- |
| Frontend | Vanilla HTML, CSS and JavaScript  |
| Backend | Python 3 standard library only (`http.server`, `urllib`, `base64`, `email`) |
| Auth | Google OAuth 2.0 desktop flow |
| API | Gmail REST API v1 (`gmail.modify`, `gmail.send`) |
| Hosting | it runs local |

## Try the demo

The [live demo](https://YOUR-USERNAME.github.io/retro-mail-95/) is the same frontend running on sample messages, so you can click through folders, open mail, search, star, archive and compose without connecting an account.

## How to setup

**Requirements:** Python 3.8+ and a Google account.

1. Create a project in the [Google Cloud Console](https://console.cloud.google.com/) and enable the **Gmail API**.
2. Under **OAuth consent screen**, add your own Gmail address as a test user.
3. Under **Credentials**, create an **OAuth Client ID** of type **Desktop app** and download the JSON.
4. Save that file as `credentials.json` in the project folder.
5. Start the app:

   ```bash
   python server.py
   ```

   (Windows users can double-click `start-retro-mail.bat`.)

6. Open <http://localhost:8765> and press **Connect**.

After you approve access, `token.json` is created next to the script. That file is your local session — it is git-ignored and should never be shared.

> **Note regarding the 7-day token:** When the consent screen is in *Testing* mode, Google invalidates refresh tokens after 7 days. The application detects this, deletes the expired token, and prompts you to reconnect. To avoid the need to constantly log in again, switch the application to *Production* mode by clicking the **PUBLISH APP** button on the OAuth consent screen (verification is not required; simply click *Advanced* → *Go to Retro Mail 95* on the warning screen).

## Project layout

```text
index.html            interface
styles.css            Windows 95 look
app.js                Mail list, search, reading pane, menu, auto-refresh
server.py             Local server
start-retro-mail.bat  launcher
docs/                 Static demo
credentials.json      Your Google OAuth file (git-ignored, you provide it)
token.json            Created after first login (git-ignored, never share)
```
> **Reminder:** You need to add the credentials.json and token.json files yourself; the others are provided.
> 
## Privacy
- The server binds to `localhost` and is only reachable from your computer.
- `credentials.json` and `token.json` are in `.gitignore` and never leave your disk.
## License

MIT
