export {};

const sprite = document.getElementById('sprite')!;
const toastContainer = document.getElementById('toast-container')!;
const toastCaller = document.getElementById('toast-caller')!;
const toastMessage = document.getElementById('toast-message')!;
const toastTime = document.getElementById('toast-time')!;
const overflow = document.getElementById('overflow')!;

const api = (window as any).alertosaurus;

// --- Sprite animation engine ---

const NATIVE_W = 621;
const NATIVE_H = 365;
const FRAME_W = 150;
const FRAME_H = FRAME_W * NATIVE_H / NATIVE_W;

interface SheetInfo { file: string; cols: number; rows: number; }

const SHEETS: Record<string, SheetInfo> = {
  'sitting-down':    { file: 'sitting-down.png',    cols: 4, rows: 4 },
  'sitting-around':  { file: 'sitting-around.png',  cols: 3, rows: 3 },
  'laying-down':     { file: 'laying-down.png',     cols: 3, rows: 3 },
  'sleeping':        { file: 'sleeping.png',         cols: 3, rows: 3 },
  'roaring':         { file: 'roaring.png',          cols: 3, rows: 3 },
};

sprite.style.width = `${FRAME_W}px`;
sprite.style.height = `${FRAME_H}px`;

function range(start: number, end: number): number[] {
  const arr: number[] = [];
  if (start <= end) {
    for (let i = start; i <= end; i++) arr.push(i);
  } else {
    for (let i = start; i >= end; i--) arr.push(i);
  }
  return arr;
}

function pingPong(start: number, end: number): number[] {
  const forward = range(start, end);
  const backward = range(end - 1, start + 1);
  return [...forward, ...backward];
}

// --- Sequence player ---

interface Segment { sheetKey: string; frames: number[]; }

let segmentQueue: Segment[] = [];
let loopSegment: Segment | null = null;
let currentSegIndex = 0;
let currentFrameIndex = 0;
let animTimer: number | null = null;
let currentSheetKey = '';
let onTransitionDone: (() => void) | null = null;
let currentFps = 8;

type VisualPose = 'standing' | 'sitting' | 'sleeping' | 'roaring';
let visualPose: VisualPose = 'standing';

function setSheet(sheetKey: string) {
  if (sheetKey === currentSheetKey) return;
  currentSheetKey = sheetKey;
  const sheet = SHEETS[sheetKey];
  sprite.style.backgroundImage = `url('../../assets/alertosaurus/${sheet.file}')`;
  sprite.style.backgroundSize = `${FRAME_W * sheet.cols}px ${FRAME_H * sheet.rows}px`;
}

function showFrame(sheetKey: string, frameIndex: number) {
  setSheet(sheetKey);
  const sheet = SHEETS[sheetKey];
  const col = frameIndex % sheet.cols;
  const row = Math.floor(frameIndex / sheet.cols);
  sprite.style.backgroundPosition = `${-col * FRAME_W}px ${-row * FRAME_H}px`;
}

function stopAnimation() {
  if (animTimer !== null) { clearInterval(animTimer); animTimer = null; }
}

function playSegments(segments: Segment[], loop: Segment | null, fps: number, onDone?: () => void) {
  stopAnimation();
  segmentQueue = segments;
  loopSegment = loop;
  currentSegIndex = 0;
  currentFrameIndex = 0;
  currentFps = fps;
  onTransitionDone = onDone ?? null;

  if (segments.length === 0 && loop) {
    startLoop();
    onTransitionDone?.();
    return;
  }
  if (segments.length === 0) return;

  showFrame(segments[0].sheetKey, segments[0].frames[0]);
  animTimer = setInterval(tick, 1000 / fps) as unknown as number;
}

function tick() {
  if (currentSegIndex >= segmentQueue.length) return;
  const seg = segmentQueue[currentSegIndex];
  currentFrameIndex++;
  if (currentFrameIndex >= seg.frames.length) {
    currentSegIndex++;
    currentFrameIndex = 0;
    if (currentSegIndex >= segmentQueue.length) {
      stopAnimation();
      if (loopSegment) startLoop();
      onTransitionDone?.();
      return;
    }
  }
  const nextSeg = segmentQueue[currentSegIndex];
  showFrame(nextSeg.sheetKey, nextSeg.frames[currentFrameIndex]);
}

function startLoop() {
  if (!loopSegment) return;
  currentFrameIndex = 0;
  showFrame(loopSegment.sheetKey, loopSegment.frames[0]);
  animTimer = setInterval(() => {
    currentFrameIndex = (currentFrameIndex + 1) % loopSegment!.frames.length;
    showFrame(loopSegment!.sheetKey, loopSegment!.frames[currentFrameIndex]);
  }, 1000 / currentFps) as unknown as number;
}

// --- Transition paths ---

function goToState(target: 'idle' | 'sleeping' | 'roaring') {
  const transitions: Segment[] = [];
  const from = visualPose;

  if (target === 'idle') {
    if (from === 'sitting') {
      visualPose = 'sitting';
      playSegments([], { sheetKey: 'sitting-around', frames: pingPong(0, 8) }, 6);
      api.stateReached('idle');
      return;
    }
    if (from === 'roaring' || from === 'standing') {
      transitions.push({ sheetKey: 'sitting-down', frames: range(0, 15) });
    }
    if (from === 'sleeping') {
      transitions.push({ sheetKey: 'laying-down', frames: range(8, 0) });
      transitions.push({ sheetKey: 'sitting-down', frames: range(0, 15) });
    }
    visualPose = 'sitting';
    playSegments(transitions, { sheetKey: 'sitting-around', frames: pingPong(0, 8) }, 6, () => {
      api.stateReached('idle');
    });
  }

  else if (target === 'sleeping') {
    if (from === 'sitting') {
      transitions.push({ sheetKey: 'sitting-down', frames: range(15, 0) });
      transitions.push({ sheetKey: 'laying-down', frames: range(0, 8) });
    } else if (from === 'standing' || from === 'roaring') {
      transitions.push({ sheetKey: 'laying-down', frames: range(0, 8) });
    } else if (from === 'sleeping') {
      visualPose = 'sleeping';
      playSegments([], { sheetKey: 'sleeping', frames: pingPong(0, 8) }, 10);
      api.stateReached('sleeping');
      return;
    }
    visualPose = 'sleeping';
    playSegments(transitions, { sheetKey: 'sleeping', frames: pingPong(0, 8) }, 10, () => {
      api.stateReached('sleeping');
    });
  }

  else if (target === 'roaring') {
    if (from === 'sitting') {
      transitions.push({ sheetKey: 'sitting-down', frames: range(15, 0) });
    } else if (from === 'sleeping') {
      transitions.push({ sheetKey: 'laying-down', frames: range(8, 0) });
    }
    visualPose = 'roaring';
    playSegments(transitions, { sheetKey: 'roaring', frames: range(0, 8) }, 10, () => {
      api.stateReached('roaring');
    });
  }
}

// --- State management ---

api.onSetState((state: string) => {
  goToState(state as 'idle' | 'sleeping' | 'roaring');
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

sprite.addEventListener('click', () => {
  if (isDragging) return;
  if (!toastContainer.classList.contains('hidden')) return;
  api.petClicked();
});

// --- Preload all sprite sheets, then start ---
const preloadPromises = Object.values(SHEETS).map(sheet => {
  return new Promise<void>(resolve => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = `../../assets/alertosaurus/${sheet.file}`;
  });
});

Promise.all(preloadPromises).then(() => {
  goToState('idle');
});
