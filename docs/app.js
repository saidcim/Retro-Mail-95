const demoMails = [
  {
    id: "demo-1",
    folder: "Inbox",
    from: "Google Calendar <calendar-noreply@google.com>",
    to: "you@gmail.com",
    subject: "Weekly review moved to Friday",
    preview: "The meeting time has been updated for this week.",
    date: "09:24",
    unread: true,
    starred: false,
    body: "Weekly review has been moved to Friday at 14:30.\n\nRoom: Meeting Room 2\nOrganizer: Ada Lovelace\n\n-- This is the static demo of Retro Mail 95. Run it locally to connect your real Gmail account."
  },
  {
    id: "demo-2",
    folder: "Inbox",
    from: "GitHub <noreply@github.com>",
    to: "you@gmail.com",
    subject: "[retro-mail-95] Pull request #12 was merged",
    preview: "Windows 95 scrollbars now match the original metrics.",
    date: "08:47",
    unread: true,
    starred: false,
    body: "Pull request #12 \"Pixel-accurate scrollbars\" was merged into main.\n\n+184 -32 across 3 files.\n\nView it on GitHub."
  },
  {
    id: "demo-3",
    folder: "Inbox",
    from: "Ada <ada@example.com>",
    to: "you@gmail.com",
    subject: "Retro interface notes",
    preview: "The title bar should feel properly old-school.",
    date: "Yesterday",
    unread: false,
    starred: true,
    body: "The blue title bar is mandatory. Everything else is negotiable.\n\nA few notes after trying the build:\n- Menu bar keyboard navigation feels right\n- Reading pane toggle is a nice touch\n- Please keep the beveled buttons\n\n- Ada"
  },
  {
    id: "demo-4",
    folder: "Inbox",
    from: "Hackathon Team <team@codejam.dev>",
    to: "you@gmail.com",
    subject: "Your submission checklist",
    preview: "Description, demo URL and repository link are required.",
    date: "Yesterday",
    unread: false,
    starred: true,
    body: "Thanks for registering!\n\nBefore the deadline please make sure you have:\n1. A short project description\n2. A working demo URL\n3. A public GitHub repository\n\nGood luck!"
  },
  {
    id: "demo-5",
    folder: "Inbox",
    from: "Nostalgia Weekly <hello@nostalgia.dev>",
    to: "you@gmail.com",
    subject: "10 UI details we lost since 1995",
    preview: "Beveled edges, audible clicks and honest scrollbars.",
    date: "Jun 21",
    unread: false,
    starred: false,
    body: "This week: why 3D beveled edges made interfaces easier to read, and what modern flat design gave up in exchange."
  },
  {
    id: "demo-6",
    folder: "Sent",
    from: "Me",
    to: "friend@example.com",
    subject: "Re: weekend build idea",
    preview: "Let's start with a mock viewer and wire up Gmail after.",
    date: "Jun 18",
    unread: false,
    starred: false,
    body: "Starting with a mock viewer is the quickest path. Once the UI feels right we can plug the Gmail API behind it without touching the front end."
  },
  {
    id: "demo-7",
    folder: "Sent",
    from: "Me",
    to: "ada@example.com",
    subject: "Scrollbar metrics",
    preview: "Pushed the fix, arrows are 16px again.",
    date: "Jun 17",
    unread: false,
    starred: false,
    body: "Pushed the fix. Arrow buttons are 16x16 again and the thumb has the proper double bevel."
  },
  {
    id: "demo-8",
    folder: "Archive",
    from: "Google <no-reply@accounts.google.com>",
    to: "you@gmail.com",
    subject: "Security alert: new app connected",
    preview: "Retro Mail 95 was granted access to your account.",
    date: "Jun 15",
    unread: false,
    starred: false,
    body: "Retro Mail 95 was granted access to your Gmail account. Tokens are stored only on your own machine."
  },
  {
    id: "demo-9",
    folder: "Spam",
    from: "Totally Real Prince <prince@notascam.biz>",
    to: "you@gmail.com",
    subject: "URGENT!!! You have inherited 3 floppy disks",
    preview: "Reply with your ZIP drive password to claim.",
    date: "Jun 12",
    unread: true,
    starred: false,
    body: "Dear Friend,\n\nI am writing to inform you of an inheritance of 3 (three) 1.44MB floppy disks.\n\nPlease do not reply. This is a demo message."
  }
];

const windowEl = document.querySelector(".window");
const desktopEl = document.querySelector(".desktop");
const messagesEl = document.querySelector("#messages");
const subjectEl = document.querySelector("#mailSubject");
const fromEl = document.querySelector("#mailFrom");
const dateEl = document.querySelector("#mailDate");
const bodyEl = document.querySelector("#mailBody");
const bodyFrameEl = document.querySelector("#mailBodyFrame");
const searchInput = document.querySelector("#searchInput");
const statusText = document.querySelector("#statusText");
const apiStatus = document.querySelector("#apiStatus");
const accountName = document.querySelector("#accountName");
const accountMode = document.querySelector("#accountMode");
const folderButtons = [...document.querySelectorAll(".folder")];
const countEls = [...document.querySelectorAll("[data-count]")];
const actionButtons = [...document.querySelectorAll("[data-action]")];
const composeDialog = document.querySelector("#composeDialog");
const composeTitle = document.querySelector("#composeTitle");
const composeTo = document.querySelector("#composeTo");
const composeSubject = document.querySelector("#composeSubject");
const composeBody = document.querySelector("#composeBody");
const sendMessage = document.querySelector("#sendMessage");
const aboutDialog = document.querySelector("#aboutDialog");
const closeDialog = document.querySelector("#closeDialog");
const confirmCloseBtn = document.querySelector("#confirmClose");
const closedScreen = document.querySelector("#closedScreen");
const reopenApp = document.querySelector("#reopenApp");
const autoRefreshMenuItem = document.querySelector("#autoRefreshMenuItem");
const menuTriggers = [...document.querySelectorAll(".menu-trigger")];
const menuPanels = [...document.querySelectorAll(".menu-panel")];

let activeFolder = "Inbox";
let selectedId = null;
let mails = [];
let counts = {};
let usingGmail = false;
let sendingMode = "compose";
let nextPageToken = "";
let autoRefreshEnabled = true;
let pollTimer = null;
let currentDetailToken = 0;
const detailCache = new Map();

function selectedMail() {
  const list = usingGmail ? mails : demoMails;
  return list.find((item) => item.id === selectedId) || null;
}

function visibleMails() {
  if (usingGmail) {
    return mails;
  }
  const term = searchInput.value.trim().toLowerCase();
  return demoMails.filter((mail) => {
    const inFolder = activeFolder === "All" || mail.folder === activeFolder || (activeFolder === "Starred" && mail.starred);
    const inSearch = !term || [mail.from, mail.to, mail.subject, mail.preview, mail.body].join(" ").toLowerCase().includes(term);
    return inFolder && inSearch;
  });
}

function renderMessages(preserveScroll = false) {
  const previousScroll = preserveScroll ? messagesEl.scrollTop : 0;
  const list = visibleMails();
  messagesEl.innerHTML = "";

  if (!list.some((mail) => mail.id === selectedId)) {
    selectedId = list[0]?.id ?? null;
  }

  for (const mail of list) {
    const row = document.createElement("button");
    row.className = `message-row${mail.unread ? " unread" : ""}${mail.id === selectedId ? " selected" : ""}`;
    row.type = "button";
    row.dataset.id = String(mail.id);
    row.innerHTML = `
      <span>${escapeHtml(mail.from || "(unknown)")}</span>
      <span class="subject">${escapeHtml(mail.subject || "(no subject)")}<small>${escapeHtml(mail.preview || "")}</small></span>
      <span>${escapeHtml(shortDate(mail.date || ""))}</span>
    `;
    row.addEventListener("click", () => selectMessage(mail.id));
    messagesEl.appendChild(row);
  }

  if (list.length === 0) {
    const empty = document.createElement("div");
    empty.className = "mail-body";
    empty.textContent = usingGmail ? "No messages in this folder." : "No demo messages found.";
    messagesEl.appendChild(empty);
  }

  if (usingGmail && nextPageToken) {
    const loadMore = document.createElement("button");
    loadMore.type = "button";
    loadMore.className = "load-more";
    loadMore.textContent = "Load older messages";
    loadMore.addEventListener("click", loadMoreMessages);
    messagesEl.appendChild(loadMore);
  }

  messagesEl.scrollTop = previousScroll;
}

async function selectMessage(id) {
  selectedId = id;
  const mail = selectedMail() || visibleMails().find((item) => item.id === id);
  if (mail?.unread) {
    mail.unread = false;
    if (usingGmail) {
      apiAction({ action: "markRead", id: mail.id }, false);
    }
  }
  render();
  if (usingGmail && mail) {
    await loadMessageDetail(mail);
  }
}

async function loadMessageDetail(mail) {
  const token = ++currentDetailToken;
  if (detailCache.has(mail.id)) {
    applyDetail(mail, detailCache.get(mail.id), token);
    return;
  }
  bodyFrameEl.hidden = true;
  bodyEl.hidden = false;
  bodyEl.textContent = "Loading message...";
  try {
    const response = await fetch(`/api/message?id=${encodeURIComponent(mail.id)}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    detailCache.set(mail.id, data);
    applyDetail(mail, data, token);
  } catch (error) {
    if (token === currentDetailToken && selectedId === mail.id) {
      bodyFrameEl.hidden = true;
      bodyEl.hidden = false;
      bodyEl.textContent = mail.preview || "Message could not be loaded.";
    }
  }
}

function applyDetail(mail, data, token) {
  if (token !== currentDetailToken || selectedId !== mail.id) {
    return;
  }
  if (data.html) {
    bodyEl.hidden = true;
    bodyFrameEl.hidden = false;
    bodyFrameEl.srcdoc = wrapHtml(data.html);
  } else {
    bodyFrameEl.hidden = true;
    bodyEl.hidden = false;
    bodyEl.textContent = data.text || mail.preview || "";
  }
}

function wrapHtml(html) {
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>body{margin:10px;font-family:Tahoma,Arial,sans-serif;font-size:13px;color:#000;word-wrap:break-word;}img{max-width:100%;}</style></head><body>${html}</body></html>`;
}

function renderReader() {
  const mail = selectedMail() || visibleMails().find((item) => item.id === selectedId);
  if (!mail) {
    subjectEl.textContent = "No message selected";
    fromEl.textContent = "";
    dateEl.textContent = "";
    bodyFrameEl.hidden = true;
    bodyEl.hidden = false;
    bodyEl.textContent = "";
    return;
  }

  subjectEl.textContent = mail.subject || "(no subject)";
  fromEl.textContent = mail.from || "(unknown sender)";
  dateEl.textContent = mail.date || "";

  if (!usingGmail) {
    bodyFrameEl.hidden = true;
    bodyEl.hidden = false;
    bodyEl.textContent = mail.body || mail.preview || "";
    return;
  }

  if (detailCache.has(mail.id)) {
    applyDetail(mail, detailCache.get(mail.id), currentDetailToken);
  } else {
    bodyFrameEl.hidden = true;
    bodyEl.hidden = false;
    bodyEl.textContent = mail.preview || "";
  }
}

function renderFolders() {
  for (const button of folderButtons) {
    button.classList.toggle("active", button.dataset.folder === activeFolder);
  }
  const demoCounts = {
    Inbox: demoMails.filter((mail) => mail.folder === "Inbox").length,
    Starred: demoMails.filter((mail) => mail.starred).length,
    Sent: demoMails.filter((mail) => mail.folder === "Sent").length,
    Drafts: 0,
    Spam: 0,
    Archive: 0,
    All: demoMails.length
  };
  const source = usingGmail ? counts : demoCounts;
  for (const el of countEls) {
    el.textContent = source[el.dataset.count] ?? 0;
  }
}

function renderStatus() {
  const count = visibleMails().length;
  const suffix = count === 1 ? "message" : "messages";
  statusText.textContent = `${activeFolder}: ${count} ${suffix}`;
  apiStatus.textContent = usingGmail ? "Gmail API: modify + send connected" : "Gmail API: demo mode";
}

function render() {
  renderFolders();
  renderMessages();
  renderReader();
  renderStatus();
}

async function loadMessages() {
  statusText.textContent = `Loading ${activeFolder}...`;
  nextPageToken = "";
  const params = new URLSearchParams({
    folder: activeFolder,
    limit: "50",
    search: searchInput.value.trim()
  });
  try {
    const response = await fetch(`/api/messages?${params}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) {
      throw new Error("not_connected");
    }
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }
    mails = payload.messages || [];
    counts = payload.counts || {};
    nextPageToken = payload.nextPageToken || "";
    usingGmail = true;
    selectedId = mails[0]?.id ?? null;
    accountName.textContent = payload.email || "gmail.local";
    accountMode.textContent = "Gmail mode: send/modify, no delete";
    startAutoRefresh();
  } catch (error) {
    usingGmail = false;
    mails = [];
    counts = {};
    selectedId = null;
    nextPageToken = "";
    accountName.textContent = "gmail.local";
    accountMode.textContent = error.message === "not_connected" ? "Connect required" : "Demo mode";
    stopAutoRefresh();
  }
  render();
  if (usingGmail) {
    const mail = selectedMail();
    if (mail) {
      await loadMessageDetail(mail);
    }
  }
}

async function loadMoreMessages() {
  if (!nextPageToken) {
    return;
  }
  statusText.textContent = "Loading more messages...";
  const params = new URLSearchParams({
    folder: activeFolder,
    limit: "50",
    search: searchInput.value.trim(),
    pageToken: nextPageToken
  });
  try {
    const response = await fetch(`/api/messages?${params}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }
    const existingIds = new Set(mails.map((item) => item.id));
    const additions = (payload.messages || []).filter((item) => !existingIds.has(item.id));
    mails = [...mails, ...additions];
    counts = payload.counts || counts;
    nextPageToken = payload.nextPageToken || "";
    renderFolders();
    renderMessages(true);
    renderStatus();
  } catch (error) {
    statusText.textContent = "Could not load more messages";
  }
}

async function checkForNewMail() {
  if (!usingGmail || !autoRefreshEnabled || document.hidden || composeDialog.open) {
    return;
  }
  const params = new URLSearchParams({ folder: activeFolder, limit: "25" });
  try {
    const response = await fetch(`/api/messages?${params}`, { cache: "no-store" });
    if (!response.ok) {
      return;
    }
    const payload = await response.json().catch(() => ({}));
    counts = payload.counts || counts;
    const existingIds = new Set(mails.map((item) => item.id));
    const fresh = (payload.messages || []).filter((item) => !existingIds.has(item.id));
    if (fresh.length > 0) {
      mails = [...fresh, ...mails];
      statusText.textContent = `${fresh.length} new message${fresh.length > 1 ? "s" : ""}`;
    }
    renderFolders();
    renderMessages(true);
  } catch (error) {
    // ignore transient poll failures
  }
}

function startAutoRefresh() {
  stopAutoRefresh();
  if (!autoRefreshEnabled) {
    return;
  }
  pollTimer = setInterval(checkForNewMail, 20000);
}

function stopAutoRefresh() {
  if (pollTimer) {
    clearInterval(pollTimer);
  }
  pollTimer = null;
}

function setAutoRefresh(enabled) {
  autoRefreshEnabled = enabled;
  autoRefreshMenuItem.textContent = `Auto Refresh: ${enabled ? "On" : "Off"}`;
  if (enabled) {
    startAutoRefresh();
    statusText.textContent = "Auto refresh on";
  } else {
    stopAutoRefresh();
    statusText.textContent = "Auto refresh off";
  }
}

async function apiAction(payload, refresh = true) {
  if (!usingGmail) {
    statusText.textContent = "Demo mode action";
    return false;
  }
  const response = await fetch("/api/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    statusText.textContent = data.error || "Action failed";
    return false;
  }
  if (refresh) {
    await loadMessages();
  }
  return true;
}

function openCompose(mode) {
  const mail = selectedMail();
  sendingMode = mode;
  composeTitle.textContent = mode === "reply" ? "Reply" : mode === "forward" ? "Forward" : "New Message";
  composeTo.value = mode === "reply" && mail ? extractEmail(mail.from) : "";
  composeSubject.value = mode === "compose" || !mail ? "" : `${mode === "reply" ? "Re:" : "Fwd:"} ${mail.subject || ""}`.replace(/^(Re: )?Re: /i, "Re: ");
  composeBody.value = mode === "forward" && mail
    ? `\n\n---- Forwarded message ----\nFrom: ${mail.from}\nDate: ${mail.date}\nSubject: ${mail.subject}\n\n${mail.body || detailCache.get(mail.id)?.text || ""}`
    : "";
  composeDialog.showModal();
  setTimeout(() => (composeTo.value ? composeBody.focus() : composeTo.focus()), 0);
}

function extractEmail(value) {
  const match = String(value || "").match(/<([^>]+)>/);
  return (match ? match[1] : value || "").trim();
}

function shortDate(value) {
  if (value.length > 18) {
    return value.slice(0, 16);
  }
  return value;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function closeAllMenus() {
  menuPanels.forEach((panel) => panel.classList.remove("open"));
  menuTriggers.forEach((trigger) => trigger.setAttribute("aria-expanded", "false"));
}

menuTriggers.forEach((trigger) => {
  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const name = trigger.dataset.menuTrigger;
    const panel = document.querySelector(`[data-menu-panel="${name}"]`);
    const isOpen = panel.classList.contains("open");
    closeAllMenus();
    if (!isOpen) {
      panel.classList.add("open");
      trigger.setAttribute("aria-expanded", "true");
    }
  });
});

document.addEventListener("click", closeAllMenus);

document.querySelectorAll("[data-dialog-close]").forEach((button) => {
  button.addEventListener("click", () => {
    document.getElementById(button.dataset.dialogClose)?.close();
  });
});

document.querySelectorAll("[data-window-action]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const action = button.dataset.windowAction;
    if (action === "minimize") {
      windowEl.classList.toggle("minimized");
    } else if (action === "maximize") {
      windowEl.classList.toggle("maximized");
    } else if (action === "close") {
      closeDialog.showModal();
    }
  });
});

document.querySelector(".titlebar").addEventListener("click", (event) => {
  if (windowEl.classList.contains("minimized") && !event.target.closest(".window-buttons")) {
    windowEl.classList.remove("minimized");
  }
});

document.querySelector(".titlebar").addEventListener("dblclick", (event) => {
  if (!event.target.closest(".window-buttons")) {
    windowEl.classList.toggle("maximized");
  }
});

confirmCloseBtn.addEventListener("click", () => {
  closeDialog.close();
  desktopEl.hidden = true;
  closedScreen.hidden = false;
  reopenApp.classList.remove("selected");
  stopAutoRefresh();
});

function reopenWindow() {
  closedScreen.hidden = true;
  desktopEl.hidden = false;
  reopenApp.classList.remove("selected");
  if (usingGmail) {
    startAutoRefresh();
  }
}

reopenApp.addEventListener("click", () => {
  reopenApp.classList.add("selected");
});

reopenApp.addEventListener("dblclick", reopenWindow);

reopenApp.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    reopenWindow();
  }
});

closedScreen.addEventListener("click", (event) => {
  if (event.target === closedScreen) {
    reopenApp.classList.remove("selected");
  }
});

folderButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    activeFolder = button.dataset.folder;
    await loadMessages();
  });
});

let searchTimer = null;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadMessages, 350);
});

async function runAction(action) {
  switch (action) {
    case "connect":
      statusText.textContent = "Static demo - run the app locally to connect Gmail";
      return;
    case "disconnect":
      statusText.textContent = "Disconnecting...";
      await apiAction({ action: "disconnect" }, false);
      detailCache.clear();
      await loadMessages();
      return;
    case "compose":
      openCompose("compose");
      return;
    case "refresh":
      await loadMessages();
      return;
    case "focusSearch":
      searchInput.focus();
      return;
    case "toggleFolders":
      document.querySelector(".content").classList.toggle("hide-folders");
      return;
    case "toggleReader":
      document.querySelector(".content").classList.toggle("hide-reader");
      return;
    case "toggleAutoRefresh":
      setAutoRefresh(!autoRefreshEnabled);
      return;
    case "about":
      aboutDialog.showModal();
      return;
    case "print":
      window.print();
      return;
    case "closeWindow":
      closeDialog.showModal();
      return;
    default:
      break;
  }

  const mail = selectedMail();
  if (!mail && ["reply", "forward", "archive", "star", "markRead", "markUnread"].includes(action)) {
    statusText.textContent = "Select a message first";
    return;
  }

  if (action === "reply") {
    openCompose("reply");
    return;
  }
  if (action === "forward") {
    openCompose("forward");
    return;
  }
  if (action === "archive") {
    if (usingGmail) {
      statusText.textContent = "Archiving...";
      await apiAction({ action: "archive", id: mail.id });
    } else {
      mail.folder = "Archive";
      render();
      statusText.textContent = "Archived";
    }
    return;
  }
  if (action === "star") {
    const next = !mail.starred;
    mail.starred = next;
    render();
    statusText.textContent = next ? "Starred" : "Star removed";
    if (usingGmail) {
      await apiAction({ action: "star", id: mail.id, starred: next });
    }
    return;
  }
  if (action === "markRead") {
    mail.unread = false;
    render();
    statusText.textContent = "Marked as read";
    if (usingGmail) {
      await apiAction({ action: "markRead", id: mail.id }, false);
    }
    return;
  }
  if (action === "markUnread") {
    mail.unread = true;
    render();
    statusText.textContent = "Marked as unread";
    if (usingGmail) {
      await apiAction({ action: "markUnread", id: mail.id }, false);
    }
  }
}

actionButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    closeAllMenus();
    await runAction(button.dataset.action);
  });
});

composeDialog.addEventListener("close", async () => {
  if (composeDialog.returnValue !== "send") {
    return;
  }
  const to = composeTo.value.trim();
  const subject = composeSubject.value.trim();
  const body = composeBody.value;
  if (!to || !subject) {
    statusText.textContent = "To and Subject are required";
    return;
  }
  statusText.textContent = "Sending...";
  if (usingGmail) {
    const ok = await apiAction({ action: "send", to, subject, body }, false);
    statusText.textContent = ok ? "Message sent" : "Send failed";
    await loadMessages();
  } else {
    demoMails.unshift({
      id: `demo-${Date.now()}`,
      folder: "Sent",
      from: "Me",
      to,
      subject,
      preview: body.slice(0, 80),
      date: "Now",
      unread: false,
      starred: false,
      body
    });
    statusText.textContent = `${sendingMode} saved in demo Sent`;
    render();
  }
});

sendMessage.addEventListener("click", () => {
  composeDialog.returnValue = "send";
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeAllMenus();
  }
  if (document.activeElement === searchInput || composeDialog.open || aboutDialog.open || closeDialog.open) {
    return;
  }
  const list = visibleMails();
  const index = list.findIndex((mail) => mail.id === selectedId);
  if (event.key === "ArrowDown" && list[index + 1]) {
    selectMessage(list[index + 1].id);
  }
  if (event.key === "ArrowUp" && list[index - 1]) {
    selectMessage(list[index - 1].id);
  }
});

loadMessages();
