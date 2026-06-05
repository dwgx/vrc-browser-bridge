const els = {
  serverChip: document.querySelector("#serverChip"),
  browserChip: document.querySelector("#browserChip"),
  mediaChip: document.querySelector("#mediaChip"),
  lockHeadline: document.querySelector("#lockHeadline"),
  lockSubline: document.querySelector("#lockSubline"),
  lockCardTitle: document.querySelector("#lockCardTitle"),
  lockCardBody: document.querySelector("#lockCardBody"),
  lockButton: document.querySelector("#lockButton"),
  releaseButton: document.querySelector("#releaseButton"),
  takeoverButton: document.querySelector("#takeoverButton"),
  snapshotButton: document.querySelector("#snapshotButton"),
  profileButtons: Array.from(document.querySelectorAll("[data-profile]")),
  surface: document.querySelector("#surface"),
  snapshotImage: document.querySelector("#snapshotImage"),
  cursor: document.querySelector("#cursor"),
  coordLabel: document.querySelector("#coordLabel"),
  viewportLabel: document.querySelector("#viewportLabel"),
  readonlyOverlay: document.querySelector("#readonlyOverlay"),
  sessionLabel: document.querySelector("#sessionLabel"),
  playerLabel: document.querySelector("#playerLabel"),
  seqLabel: document.querySelector("#seqLabel"),
  latencyLabel: document.querySelector("#latencyLabel"),
  lastEventLabel: document.querySelector("#lastEventLabel"),
  metricWs: document.querySelector("#metricWs"),
  metricRtt: document.querySelector("#metricRtt"),
  metricQueue: document.querySelector("#metricQueue"),
  metricViewport: document.querySelector("#metricViewport"),
  metricProfile: document.querySelector("#metricProfile"),
  metricRtsp: document.querySelector("#metricRtsp"),
  urlForm: document.querySelector("#urlForm"),
  urlInput: document.querySelector("#urlInput"),
  textForm: document.querySelector("#textForm"),
  textInput: document.querySelector("#textInput"),
  clipboardInput: document.querySelector("#clipboardInput"),
  eventLog: document.querySelector("#eventLog"),
  logFilter: document.querySelector("#logFilter")
};

const sessionId = "demo";
const playerId = localStorage.getItem("vrcbb.playerId") ?? createPlayerId();
const playerName = localStorage.getItem("vrcbb.playerName") ?? "本机控制台";
let seq = Number(localStorage.getItem("vrcbb.seq") ?? "1");
let ws;
let reconnectTimer;
let pingTimer;
let snapshotTimer;
let serverState = {};
let lastPingAt = 0;
let pendingEvents = new Map();
let eventRows = [];
let isPointerDown = false;

localStorage.setItem("vrcbb.playerId", playerId);
localStorage.setItem("vrcbb.playerName", playerName);

connect();
bindUi();
refreshSnapshot();

function bindUi() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab));
  });

  els.surface.addEventListener("pointermove", (event) => {
    const point = getNormalizedPoint(event);
    updateCursor(point);
    if (canSendInput() && (isPointerDown || event.buttons > 0)) {
      sendBrowserEvent({
        type: "pointer_move",
        x: point.x,
        y: point.y,
        buttons: event.buttons
      });
    }
  });

  els.surface.addEventListener("pointerdown", (event) => {
    els.surface.focus();
    els.surface.setPointerCapture(event.pointerId);
    isPointerDown = true;
    const point = getNormalizedPoint(event);
    updateCursor(point);
    sendBrowserEvent({
      type: "pointer_down",
      x: point.x,
      y: point.y,
      button: mapButton(event.button)
    });
  });

  els.surface.addEventListener("pointerup", (event) => {
    isPointerDown = false;
    const point = getNormalizedPoint(event);
    updateCursor(point);
    sendBrowserEvent({
      type: "pointer_up",
      x: point.x,
      y: point.y,
      button: mapButton(event.button)
    });
  });

  els.surface.addEventListener("wheel", (event) => {
    event.preventDefault();
    const point = getNormalizedPoint(event);
    updateCursor(point);
    sendBrowserEvent({
      type: "wheel",
      x: point.x,
      y: point.y,
      deltaX: Math.round(event.deltaX),
      deltaY: Math.round(event.deltaY)
    });
  }, { passive: false });

  els.urlForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const url = els.urlInput.value.trim();
    if (url) {
      sendBrowserEvent({ type: "url_submit", url });
    }
  });

  els.textForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = els.textInput.value;
    if (!text) {
      return;
    }
    sendBrowserEvent({ type: "text_commit", text });
    els.textInput.value = "";
  });

  document.querySelector("#backButton").addEventListener("click", () => sendBrowserEvent({ type: "nav_back" }));
  document.querySelector("#forwardButton").addEventListener("click", () => sendBrowserEvent({ type: "nav_forward" }));
  document.querySelector("#reloadButton").addEventListener("click", () => sendBrowserEvent({ type: "reload" }));

  document.querySelectorAll("[data-key]").forEach((button) => {
    button.addEventListener("click", () => sendBrowserEvent({ type: "key_press", key: button.dataset.key }));
  });

  els.lockButton.addEventListener("click", () => requestLock());
  els.releaseButton.addEventListener("click", () => sendRawEvent({ type: "lock_release" }));
  els.takeoverButton.addEventListener("click", () => requestLock());
  els.snapshotButton.addEventListener("click", () => refreshSnapshot());
  els.profileButtons.forEach((button) => {
    button.addEventListener("click", () => {
      sendBrowserEvent({
        type: "stream_profile",
        profile: button.dataset.profile
      });
    });
  });
  document.querySelector("#clearLogButton").addEventListener("click", () => {
    eventRows = [];
    renderLogs();
  });
  document.querySelector("#sendClipboardButton").addEventListener("click", () => {
    if (els.clipboardInput.value) {
      sendBrowserEvent({ type: "text_commit", text: els.clipboardInput.value });
    }
  });
  document.querySelector("#clearClipboardButton").addEventListener("click", () => {
    els.clipboardInput.value = "";
  });
  els.logFilter.addEventListener("change", renderLogs);
}

function connect() {
  clearTimeout(reconnectTimer);
  setChip(els.serverChip, "连接中", "warn");
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${protocol}://${window.location.host}`);

  ws.addEventListener("open", () => {
    setChip(els.serverChip, "控制服务器已连接", "ok");
    addLog({ type: "连接", seq: "-", result: "success", detail: "WebSocket 已连接" });
    startPing();
  });

  ws.addEventListener("message", (event) => {
    handleServerMessage(event.data);
  });

  ws.addEventListener("close", () => {
    setChip(els.serverChip, "正在重连", "warn");
    stopPing();
    reconnectTimer = setTimeout(connect, 1000);
  });

  ws.addEventListener("error", () => {
    setChip(els.serverChip, "连接错误", "error");
  });
}

function handleServerMessage(raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    addLog({ type: "server", seq: "-", result: "error", detail: raw });
    return;
  }

  if (message.type === "server_hello" || message.type === "server_state") {
    serverState = message;
    updateState(message);
    return;
  }

  if (message.type === "event_applied") {
    const sentAt = pendingEvents.get(message.event.seq);
    pendingEvents.delete(message.event.seq);
    const rtt = message.rttMs ?? (sentAt ? Date.now() - sentAt : undefined);
    updateRtt(rtt);
    serverState = {
      ...serverState,
      browser: message.browser ?? serverState.browser,
      controlLock: message.controlLock ?? serverState.controlLock
    };
    updateState(serverState);
    addLog({
      type: translateEventType(message.event.type),
      seq: message.event.seq,
      result: "success",
      rtt,
      detail: "已应用"
    });
    scheduleSnapshot();
    return;
  }

  if (message.type === "event_rejected") {
    pendingEvents.delete(message.seq);
    addLog({
      type: "事件",
      seq: message.seq ?? "-",
      result: "rejected",
      detail: translateError(message)
    });
    return;
  }

  if (message.type === "event_duplicate") {
    pendingEvents.delete(message.seq);
    addLog({
      type: "事件",
      seq: message.seq,
      result: "duplicate",
      detail: "检测到重复事件，已丢弃"
    });
    return;
  }

  if (message.type === "event_failed") {
    pendingEvents.delete(message.seq);
    addLog({
      type: "事件",
      seq: message.seq,
      result: "error",
      detail: message.error ?? "执行失败"
    });
  }
}

function requestLock() {
  sendRawEvent({
    type: "lock_request",
    mode: "exclusive"
  });
}

function sendBrowserEvent(partialEvent) {
  if (!canSendInput()) {
    addLog({
      type: translateEventType(partialEvent.type),
      seq: "-",
      result: "rejected",
      detail: "当前服务器启用了锁定模式，请先申请控制。"
    });
    return;
  }
  sendRawEvent(partialEvent);
}

function sendRawEvent(partialEvent) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    addLog({
      type: translateEventType(partialEvent.type),
      seq: "-",
      result: "error",
      detail: "WebSocket 已断开，输入已暂停。"
    });
    return;
  }

  const event = {
    v: 1,
    sessionId,
    playerId,
    playerName,
    source: "mock",
    seq: seq++,
    ts: Date.now(),
    ...partialEvent
  };
  localStorage.setItem("vrcbb.seq", String(seq));
  pendingEvents.set(event.seq, Date.now());
  ws.send(JSON.stringify(event));
  updateFooter(event);
}

function startPing() {
  stopPing();
  pingTimer = setInterval(async () => {
    lastPingAt = performance.now();
    try {
      await fetch(`/health?t=${Date.now()}`, { cache: "no-store" });
      const ms = Math.round(performance.now() - lastPingAt);
      els.metricWs.textContent = `${ms} ms`;
      els.latencyLabel.textContent = `WS ${ms} ms`;
    } catch {
      els.metricWs.textContent = "-- ms";
    }
  }, 2000);
}

function stopPing() {
  clearInterval(pingTimer);
}

async function refreshSnapshot() {
  try {
    const response = await fetch(`/snapshot?t=${Date.now()}`, { cache: "no-store" });
    const payload = await response.json();
    if (!payload.ok) {
      throw new Error(payload.error ?? "snapshot failed");
    }
    els.snapshotImage.src = payload.image;
    els.surface.classList.add("has-snapshot");
    if (payload.browser) {
      serverState = { ...serverState, browser: payload.browser };
      updateState(serverState);
    }
  } catch (error) {
    addLog({
      type: "预览",
      seq: "-",
      result: "error",
      detail: error instanceof Error ? error.message : "预览刷新失败"
    });
  }
}

function scheduleSnapshot() {
  clearTimeout(snapshotTimer);
  snapshotTimer = setTimeout(refreshSnapshot, 180);
}

function updateState(state) {
  const browser = state.browser ?? {};
  const viewport = browser.viewport ?? state.viewport ?? { width: 1280, height: 720 };
  const lock = state.controlLock;
  const heldByMe = lock && lock.playerId === playerId;
  const isOpenMode = state.controlMode !== "locked";

  setChip(els.browserChip, browser.status === "ready" ? "Chromium 就绪" : "Chromium 未就绪", browser.status === "ready" ? "ok" : "warn");
  setChip(els.mediaChip, state.media?.status === "running" ? "视频流推流中" : "视频流未启用", state.media?.status === "running" ? "ok" : "warn");

  els.viewportLabel.textContent = `${viewport.width} × ${viewport.height}`;
  els.metricViewport.textContent = `${viewport.width}×${viewport.height}`;
  const profile = state.media?.streamProfile ?? browser.streamProfile ?? profileForViewport(viewport.width, viewport.height);
  syncProfileButtons(profile);
  els.metricProfile.textContent = profile.toUpperCase();
  els.metricRtsp.textContent = state.media?.rtspUrl ?? "rtsp://127.0.0.1:8554/browser";

  if (browser.url) {
    els.urlInput.value = browser.url;
  }

  if (isOpenMode && !lock) {
    els.lockHeadline.textContent = "开放编辑";
    els.lockSubline.textContent = "输入会直接同步到浏览器";
    els.lockCardTitle.textContent = "开放编辑";
    els.lockCardBody.textContent = "所有人都能操作。右上角标记只用来提示当前是谁在动。";
    els.lockButton.textContent = "我在操作";
  } else if (isOpenMode && heldByMe) {
    const remain = Math.max(0, Math.ceil((lock.expiresAt - Date.now()) / 1000));
    els.lockHeadline.textContent = `我在操作 · ${remain}s`;
    els.lockSubline.textContent = "其他人仍可同时输入";
    els.lockCardTitle.textContent = "我正在操作";
    els.lockCardBody.textContent = `这是提示，不是锁。${remain} 秒后自动消失。`;
    els.lockButton.textContent = "续一下";
  } else if (isOpenMode && lock) {
    els.lockHeadline.textContent = `${lock.playerName} 在操作`;
    els.lockSubline.textContent = "你也可以直接输入";
    els.lockCardTitle.textContent = "有人正在操作";
    els.lockCardBody.textContent = `${lock.playerName} 标记了自己在操作。你仍然可以直接输入。`;
    els.lockButton.textContent = "我在操作";
  } else if (!lock) {
    els.lockHeadline.textContent = "无人控制";
    els.lockSubline.textContent = "服务器启用了锁定模式，申请控制后才能输入";
    els.lockCardTitle.textContent = "无人控制";
    els.lockCardBody.textContent = "当前没有玩家持有控制权。";
    els.lockButton.textContent = "申请控制";
  } else if (heldByMe) {
    const remain = Math.max(0, Math.ceil((lock.expiresAt - Date.now()) / 1000));
    els.lockHeadline.textContent = `我正在控制 · 剩余 ${remain}s`;
    els.lockSubline.textContent = "点击、滚轮、文本和导航会发送到 Chromium";
    els.lockCardTitle.textContent = "我正在控制";
    els.lockCardBody.textContent = `控制锁会在 ${remain} 秒后过期，发送输入会自动续期。`;
    els.lockButton.textContent = "续期控制";
  } else {
    els.lockHeadline.textContent = `由 ${lock.playerName} 控制中`;
    els.lockSubline.textContent = "当前为只读观看，可请求接管";
    els.lockCardTitle.textContent = "他人控制中";
    els.lockCardBody.textContent = `${lock.playerName} 正在控制浏览器。`;
    els.lockButton.textContent = "请求接管";
  }

  els.surface.classList.toggle("can-control", isOpenMode || Boolean(heldByMe));
  els.surface.classList.toggle("readonly", !isOpenMode && !heldByMe);
}

function canSendInput() {
  if (serverState.controlMode !== "locked") {
    return true;
  }
  const lock = serverState.controlLock;
  return Boolean(lock && lock.playerId === playerId && lock.expiresAt > Date.now());
}

function updateCursor(point) {
  const viewport = serverState.browser?.viewport ?? serverState.viewport ?? { width: 1280, height: 720 };
  const x = Math.round(point.x * viewport.width);
  const y = Math.round(point.y * viewport.height);
  els.cursor.style.left = `${point.x * 100}%`;
  els.cursor.style.top = `${point.y * 100}%`;
  els.coordLabel.textContent = `x ${x} · y ${y}`;
}

function updateFooter(event) {
  els.sessionLabel.textContent = `session ${sessionId}`;
  els.playerLabel.textContent = `player ${playerId}`;
  els.seqLabel.textContent = `seq ${seq}`;
  els.metricQueue.textContent = String(pendingEvents.size);
  els.lastEventLabel.textContent = `最后事件：${translateEventType(event.type)} #${event.seq}`;
}

function updateRtt(rtt) {
  if (typeof rtt !== "number") {
    return;
  }
  els.metricRtt.textContent = `${rtt} ms`;
  els.metricQueue.textContent = String(pendingEvents.size);
}

function addLog(entry) {
  eventRows.unshift({
    time: new Date().toLocaleTimeString(),
    rtt: entry.rtt === undefined ? "--" : `${entry.rtt} ms`,
    ...entry
  });
  eventRows = eventRows.slice(0, 120);
  renderLogs();
}

function renderLogs() {
  const filter = els.logFilter.value;
  const rows = filter === "all" ? eventRows : eventRows.filter((row) => row.result === filter);
  els.eventLog.innerHTML = rows.map((row) => `
    <tr title="${escapeHtml(row.detail ?? "")}">
      <td>${escapeHtml(row.time)}</td>
      <td>${escapeHtml(row.type)}</td>
      <td>${escapeHtml(String(row.seq))}</td>
      <td class="result-${escapeHtml(row.result)}">${translateResult(row.result)}</td>
      <td>${escapeHtml(row.rtt)}</td>
    </tr>
  `).join("");
}

function activateTab(name) {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === name);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === name);
  });
}

function getNormalizedPoint(event) {
  const rect = els.surface.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / rect.width),
    y: clamp((event.clientY - rect.top) / rect.height)
  };
}

function setChip(element, text, tone) {
  element.textContent = text;
  element.classList.remove("chip-ok", "chip-warn", "chip-error");
  element.classList.add(`chip-${tone}`);
}

function mapButton(button) {
  if (button === 1) {
    return "middle";
  }
  if (button === 2) {
    return "right";
  }
  return "left";
}

function translateEventType(type) {
  const map = {
    pointer_move: "移动",
    pointer_down: "按下",
    pointer_up: "抬起",
    wheel: "滚轮",
    text_commit: "文本",
    key_press: "按键",
    url_submit: "导航",
    viewport_set: "分辨率",
    stream_profile: "串流档位",
    nav_back: "后退",
    nav_forward: "前进",
    reload: "刷新",
    lock_request: "申请控制",
    lock_release: "释放控制"
  };
  return map[type] ?? type ?? "事件";
}

function syncProfileButtons(profile) {
  els.profileButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.profile === profile);
  });
}

function profileForViewport(width, height) {
  if (width >= 1920 || height >= 1080) {
    return "1080p";
  }
  if (width <= 640 || height <= 360) {
    return "360p";
  }
  return "720p";
}

function translateResult(result) {
  const map = {
    success: "已应用",
    rejected: "已拒绝",
    duplicate: "重复",
    error: "错误"
  };
  return map[result] ?? result;
}

function translateError(message) {
  if (message.code === "LOCK_REQUIRED") {
    return "已拒绝：服务器启用了锁定模式，请先申请控制";
  }
  if (message.code === "LOCK_HELD_BY_OTHER") {
    return "已拒绝：他人正在控制";
  }
  return message.error ?? "已拒绝";
}

function clamp(value) {
  return Math.max(0, Math.min(1, value));
}

function createPlayerId() {
  return `mock-${Math.random().toString(16).slice(2, 8)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}
