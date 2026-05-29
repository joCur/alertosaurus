const sprite = document.getElementById('sprite')!;
const toastContainer = document.getElementById('toast-container')!;
const toastCaller = document.getElementById('toast-caller')!;
const toastMessage = document.getElementById('toast-message')!;
const toastTime = document.getElementById('toast-time')!;
const overflow = document.getElementById('overflow')!;

const api = (window as any).alertosaurus;

// --- State management ---

api.onSetState((state: string) => {
  sprite.dataset.state = state;
});

sprite.addEventListener('animationend', () => {
  if (sprite.dataset.state === 'going-to-sleep' || sprite.dataset.state === 'waking') {
    api.animationComplete();
  }
});

// --- Toast ---

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

api.onShowToast((data: { caller: string; message: string; received_at: string }) => {
  toastCaller.textContent = data.caller;
  toastMessage.textContent = data.message;
  toastTime.textContent = relativeTime(data.received_at);
  toastContainer.classList.remove('hidden');
});

api.onHideToast(() => {
  toastContainer.classList.add('hidden');
});

toastContainer.addEventListener('click', () => {
  toastContainer.classList.add('hidden');
  api.toastDismissed();
});

// --- Overflow ---

api.onShowOverflow((count: number) => {
  overflow.textContent = `+${count} more`;
  overflow.classList.remove('hidden');
});

api.onHideToast(() => {
  overflow.classList.add('hidden');
});

overflow.addEventListener('click', () => {
  api.overflowClicked();
});

// --- Click-through ---

document.addEventListener('mousemove', (e) => {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (el && (el.closest('#sprite') || el.closest('#toast-container') || el.closest('#overflow'))) {
    api.setIgnoreMouseEvents(false);
  } else {
    api.setIgnoreMouseEvents(true, { forward: true });
  }
});

// --- Drag ---

let isDragging = false;
let lastScreenX = 0;
let lastScreenY = 0;

sprite.addEventListener('mousedown', (e) => {
  isDragging = true;
  lastScreenX = e.screenX;
  lastScreenY = e.screenY;
  api.setIgnoreMouseEvents(false);
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const dx = e.screenX - lastScreenX;
  const dy = e.screenY - lastScreenY;
  lastScreenX = e.screenX;
  lastScreenY = e.screenY;
  api.dragging(dx, dy);
});

document.addEventListener('mouseup', () => {
  if (!isDragging) return;
  isDragging = false;
  api.dragEnd();
});

// --- Pet click (open hub) ---

sprite.addEventListener('click', (e) => {
  if (isDragging) return;
  if (!toastContainer.classList.contains('hidden')) return;
  api.petClicked();
});
