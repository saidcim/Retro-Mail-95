# Retro Mail 95: Custom local running mail viewer
## About the Project
<img width="1870" height="913" alt="image" src="https://github.com/user-attachments/assets/509ec6fa-1f5c-44a4-8137-b57318814206" />
I created an email viewer that runs entirely locally and uses the Gmail API, inspired by the Windows 95 interface.

### Why did i do this ?
Even though the current Gmail interface boasts a clean and modern design, I prefer a retro style; that’s why I created this new theme and connected it to my email account via the Gmail API. This way, I could enjoy all the modern features while still having a retro look.

### What does it do ?
Just like in Gmail, folders such as Inbox, Starred, Sent, Drafts, Spam, and Archive are available here. Additionally, the buttons for new mail, reply, forward, archive, star, and connect (your Gmail) are all fully functional.

## Setup

### Requirements
Python 3.8 or Python 3.8+ and a Google account.
1. Go to Google Cloud Console create a project and enable "Gmail API"
2. add your own mail address in OAuth consent screen as a test user (you should use search bar for navigating to OAuth consent screen)
3. now go to Credentials page and create an "OAuth Client ID" as a "Desktop app" and download the JSON file.
4. Save that file as `credentials.json` in the project folder and start the app:
 
   ```bash
   python server.py
   ```
5. if you are a Windows user you can just double-click `start-retro-mail.bat`

Approve access and `token.json` is created next to the script. You should never share it!

## Layout
- styles.css: Our Theme
- index.html: Interface
- server.py: Local server
- start-retro-mail.bat: Quick launcher for Windows
- app.js: Auto refresh, search bar, menus
- docs/: static demo for github
- credentials.json: your OAuth file
- token.json: Created after setup

## License

MIT

