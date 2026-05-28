export {};

const api = (window as any).alertosaurus;
const listEl = document.getElementById('notification-list')!;
const emptyEl = document.getElementById('empty-state')!;
const endpointEl = document.getElementById('endpoint-info')!;
const clearBtn = document.getElementById('clear-btn')!;
const quitBtn = document.getElementById('quit-btn')!;

interface Notification {
  id: string;
  caller: string;
  message: string;
  duration_ms: number;
  received_at: string;
}

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

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function render(notifications: Notification[]) {
  listEl.innerHTML = '';

  if (notifications.length === 0) {
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');

  const grouped = new Map<string, Notification[]>();
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
      row.innerHTML = `
        <span class="notification-caller">${escapeHtml(n.caller)}</span>
        <span class="notification-message">${escapeHtml(n.message)}</span>
        <span class="notification-time">${formatTime(n.received_at)}</span>
      `;
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
