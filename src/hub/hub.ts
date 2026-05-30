export {};

const api = (window as any).alertosaurus;
document.body.dataset.platform = api.platform;
const listEl = document.getElementById('notification-list')!;
const emptyEl = document.getElementById('empty-state')!;
const endpointEl = document.getElementById('endpoint-info')!;
const clearBtn = document.getElementById('clear-btn')!;
const quitBtn = document.getElementById('quit-btn')!;
const gravityToggle = document.getElementById('gravity-toggle') as HTMLInputElement;
const sleepTimerSelect = document.getElementById('sleep-timer-select') as HTMLSelectElement;

const tabNotifications = document.getElementById('tab-notifications')!;
const tabSettings = document.getElementById('tab-settings')!;
const tabs = document.querySelectorAll<HTMLButtonElement>('#tabs .tab');

// --- Tabs ---

const tabPanels: Record<string, HTMLElement> = {
  notifications: tabNotifications,
  settings: tabSettings,
};

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab!;
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    for (const [key, panel] of Object.entries(tabPanels)) {
      panel.classList.toggle('hidden', key !== target);
    }
  });
});

// --- Notifications ---

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

interface NotificationItem { id: string; caller: string; message: string; received_at: string; }

function render(notifications: NotificationItem[]) {
  listEl.innerHTML = '';

  if (notifications.length === 0) {
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');

  const grouped = new Map<string, NotificationItem[]>();
  for (const n of notifications) {
    const day = new Date(n.received_at).toDateString();
    if (!grouped.has(day)) grouped.set(day, []);
    grouped.get(day)!.push(n);
  }

  for (const [_day, items] of grouped) {
    const group = document.createElement('div');
    group.className = 'day-group';

    const label = document.createElement('div');
    label.className = 'day-label';
    label.textContent = formatDay(items[0].received_at);
    group.appendChild(label);

    for (const n of items) {
      const row = document.createElement('div');
      row.className = 'notification-row';

      const caller = document.createElement('span');
      caller.className = 'notification-caller';
      caller.textContent = n.caller;
      row.appendChild(caller);

      const message = document.createElement('span');
      message.className = 'notification-message';
      message.textContent = n.message;
      row.appendChild(message);

      const time = document.createElement('span');
      time.className = 'notification-time';
      time.textContent = formatTime(n.received_at);
      row.appendChild(time);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'notification-delete';
      deleteBtn.textContent = '×';
      deleteBtn.title = 'Delete';
      deleteBtn.addEventListener('click', async () => {
        await api.deleteNotification(n.id);
        await loadNotifications();
      });
      row.appendChild(deleteBtn);

      group.appendChild(row);
    }

    listEl.appendChild(group);
  }
}

async function loadNotifications() {
  const notifications = await api.getNotifications();
  render(notifications);
}

async function loadEndpoint() {
  const info = await api.getEndpointInfo();
  endpointEl.textContent = `Listening on ${info.host}:${info.port}`;
}

// --- Settings ---

async function loadSettings() {
  const cfg = await api.getConfig();
  gravityToggle.checked = cfg.gravity_enabled;
  sleepTimerSelect.value = String(cfg.idle_timeout_ms);
}

gravityToggle.addEventListener('change', () => {
  api.setConfigValue('gravity_enabled', gravityToggle.checked);
});

sleepTimerSelect.addEventListener('change', () => {
  api.setConfigValue('idle_timeout_ms', Number(sleepTimerSelect.value));
});

// --- Actions ---

clearBtn.addEventListener('click', async () => {
  if (!confirm('Clear all notification history?')) return;
  await api.clearHistory();
  await loadNotifications();
});

quitBtn.addEventListener('click', () => {
  api.quit();
});

api.onNotificationsUpdated(() => {
  loadNotifications();
});

loadNotifications();
loadEndpoint();
loadSettings();
