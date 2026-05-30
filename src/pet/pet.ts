export {};

const spriteContainer = document.getElementById('sprite-container')!;
const toastContainer = document.getElementById('toast-container')!;
const toastCaller = document.getElementById('toast-caller')!;
const toastMessage = document.getElementById('toast-message')!;
const toastTime = document.getElementById('toast-time')!;
const overflow = document.getElementById('overflow')!;

const api = (window as any).alertosaurus;

// --- Sprite animation engine (stacked layers, no image swapping) ---

const DISPLAY_W = 225;
let NATIVE_W = 1;
let NATIVE_H = 1;
let FRAME_H = 0;

interface SheetInfo {
  file: string;
  cols: number;
  rows: number;
  fps: number;
}

const SHEETS: Record<string, SheetInfo> = {
  'sitting-down':  { file: 'sitting-down.png',  cols: 4, rows: 4, fps: 9 },
  'sitting':       { file: 'sitting.png',        cols: 3, rows: 3, fps: 10 },
  'laying-down':   { file: 'laying-down.png',    cols: 3, rows: 3, fps: 7 },
  'sleeping':      { file: 'sleeping.png',        cols: 3, rows: 3, fps: 10 },
  'roaring':       { file: 'roaring.png',         cols: 3, rows: 3, fps: 8 },
  'dragging':      { file: 'dragging.png',        cols: 4, rows: 4, fps: 18 },
};

const spriteLayers: Record<string, HTMLDivElement> = {};
const alphaData: Record<string, { data: Uint8ClampedArray; width: number; height: number }> = {};
let activeLayerKey = '';
let currentFrameCol = 0;
let currentFrameRow = 0;

function preloadSheets(): Promise<void> {
  let firstDetected = false;
  const promises = Object.entries(SHEETS).map(([key, sheet]) => {
    return new Promise<void>(resolve => {
      const img = new Image();
      img.onload = () => {
        if (!firstDetected) {
          NATIVE_W = img.naturalWidth / sheet.cols;
          NATIVE_H = img.naturalHeight / sheet.rows;
          FRAME_H = DISPLAY_W * NATIVE_H / NATIVE_W;
          spriteContainer.style.width = `${DISPLAY_W}px`;
          spriteContainer.style.height = `${FRAME_H}px`;
          firstDetected = true;
        }

        const layer = document.createElement('div');
        layer.className = 'sprite-layer';
        layer.style.width = `${DISPLAY_W}px`;
        layer.style.height = `${FRAME_H}px`;
        layer.style.backgroundImage = `url('../../assets/alertosaurus/${sheet.file}')`;
        layer.style.backgroundSize = `${DISPLAY_W * sheet.cols}px ${FRAME_H * sheet.rows}px`;
        spriteContainer.appendChild(layer);
        spriteLayers[key] = layer;

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        alphaData[key] = { data: imageData.data, width: canvas.width, height: canvas.height };

        resolve();
      };
      img.onerror = () => {
        console.error(`Failed to load sprite sheet: ${sheet.file}`);
        resolve();
      };
      img.src = `../../assets/alertosaurus/${sheet.file}`;
    });
  });
  return Promise.all(promises).then(() => {});
}

function activateLayer(sheetKey: string) {
  if (sheetKey === activeLayerKey) return;
  const oldKey = activeLayerKey;
  activeLayerKey = sheetKey;
  spriteLayers[sheetKey].classList.add('active');
  if (oldKey && spriteLayers[oldKey]) {
    spriteLayers[oldKey].classList.remove('active');
  }
}

function showFrame(sheetKey: string, frameIndex: number) {
  activateLayer(sheetKey);
  const sheet = SHEETS[sheetKey];
  currentFrameCol = frameIndex % sheet.cols;
  currentFrameRow = Math.floor(frameIndex / sheet.cols);
  spriteLayers[sheetKey].style.backgroundPosition = `${-currentFrameCol * DISPLAY_W}px ${-currentFrameRow * FRAME_H}px`;
}

function isPixelOpaque(localX: number, localY: number): boolean {
  const alpha = alphaData[activeLayerKey];
  if (!alpha) return true;
  const nativeX = Math.floor(localX * NATIVE_W / DISPLAY_W) + currentFrameCol * NATIVE_W;
  const nativeY = Math.floor(localY * NATIVE_H / FRAME_H) + currentFrameRow * NATIVE_H;
  if (nativeX < 0 || nativeX >= alpha.width || nativeY < 0 || nativeY >= alpha.height) return false;
  return alpha.data[(nativeY * alpha.width + nativeX) * 4 + 3] > 20;
}

// --- Sequence player ---

function range(start: number, end: number): number[] {
  const arr: number[] = [];
  if (start <= end) { for (let i = start; i <= end; i++) arr.push(i); }
  else { for (let i = start; i >= end; i--) arr.push(i); }
  return arr;
}

function pingPong(start: number, end: number): number[] {
  return [...range(start, end), ...range(end - 1, start + 1)];
}

interface Segment { sheetKey: string; frames: number[]; }

let segmentQueue: Segment[] = [];
let loopSegment: Segment | null = null;
let currentSegIndex = 0;
let currentFrameIndex = 0;
let animTimer: number | null = null;
let onTransitionDone: (() => void) | null = null;

function stopAnimation() {
  if (animTimer !== null) { clearInterval(animTimer); animTimer = null; }
}

function playSegments(segments: Segment[], loop: Segment | null, onDone?: () => void) {
  stopAnimation();
  segmentQueue = segments;
  loopSegment = loop;
  currentSegIndex = 0;
  currentFrameIndex = 0;
  onTransitionDone = onDone ?? null;

  if (segments.length === 0 && loop) {
    startLoop();
    onTransitionDone?.();
    return;
  }
  if (segments.length === 0) return;

  const seg = segments[0];
  showFrame(seg.sheetKey, seg.frames[0]);
  animTimer = setInterval(tick, 1000 / SHEETS[seg.sheetKey].fps) as unknown as number;
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
    const nextSeg = segmentQueue[currentSegIndex];
    stopAnimation();
    showFrame(nextSeg.sheetKey, nextSeg.frames[0]);
    animTimer = setInterval(tick, 1000 / SHEETS[nextSeg.sheetKey].fps) as unknown as number;
    return;
  }
  showFrame(seg.sheetKey, seg.frames[currentFrameIndex]);
}

function startLoop() {
  if (!loopSegment) return;
  const seg = loopSegment;
  currentFrameIndex = 0;
  showFrame(seg.sheetKey, seg.frames[0]);
  animTimer = setInterval(() => {
    currentFrameIndex = (currentFrameIndex + 1) % seg.frames.length;
    showFrame(seg.sheetKey, seg.frames[currentFrameIndex]);
  }, 1000 / SHEETS[seg.sheetKey].fps) as unknown as number;
}

// --- Transition paths ---

type VisualPose = 'standing' | 'sitting' | 'sleeping' | 'roaring';
let visualPose: VisualPose = 'standing';

function goToState(target: 'idle' | 'sleeping' | 'roaring') {
  const transitions: Segment[] = [];
  const from = visualPose;

  if (target === 'idle') {
    if (from === 'sitting') {
      playSegments([], { sheetKey: 'sitting', frames: pingPong(0, 8) });
      api.stateReached('idle');
      return;
    }
    if (from === 'sleeping') {
      transitions.push({ sheetKey: 'laying-down', frames: range(8, 0) });
      transitions.push({ sheetKey: 'sitting-down', frames: range(0, 15) });
    } else {
      transitions.push({ sheetKey: 'sitting-down', frames: range(0, 15) });
    }
    visualPose = 'sitting';
    playSegments(transitions, { sheetKey: 'sitting', frames: pingPong(0, 8) }, () => {
      api.stateReached('idle');
    });
  }

  else if (target === 'sleeping') {
    if (from === 'sleeping') {
      playSegments([], { sheetKey: 'sleeping', frames: pingPong(0, 8) });
      api.stateReached('sleeping');
      return;
    }
    if (from === 'sitting') {
      transitions.push({ sheetKey: 'sitting-down', frames: range(15, 0) });
    }
    transitions.push({ sheetKey: 'laying-down', frames: range(0, 8) });
    visualPose = 'sleeping';
    playSegments(transitions, { sheetKey: 'sleeping', frames: pingPong(0, 8) }, () => {
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
    playSegments(transitions, { sheetKey: 'roaring', frames: range(0, 8) }, () => {
      api.stateReached('roaring');
    });
  }
}

// --- State management ---

api.onSetState((state: string) => {
  goToState(state as 'idle' | 'sleeping' | 'roaring');
});

let isFalling = false;

api.onFalling(() => {
  isFalling = true;
  playSegments([], { sheetKey: 'dragging', frames: range(0, 15) });
});

api.onLanded(() => {
  isFalling = false;

  spriteContainer.classList.add('squish-impact');
  setTimeout(() => {
    spriteContainer.classList.remove('squish-impact');
    spriteContainer.classList.add('squish-stretch');
    setTimeout(() => {
      spriteContainer.classList.remove('squish-stretch');
      spriteContainer.classList.add('squish-settle');
      setTimeout(() => {
        spriteContainer.classList.remove('squish-settle');
        goToState(stateBeforeDrag ?? 'idle');
        stateBeforeDrag = null;
      }, 120);
    }, 100);
  }, 80);
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
  overflow.classList.add('hidden');
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

overflow.addEventListener('click', () => {
  api.overflowClicked();
});

// --- Click-through ---

document.addEventListener('mousemove', (e) => {
  if (isDragging) return;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (el && (el.closest('#toast-container') || el.closest('#overflow'))) {
    api.setIgnoreMouseEvents(false);
  } else if (el && el.closest('#sprite-container')) {
    const rect = spriteContainer.getBoundingClientRect();
    if (isPixelOpaque(e.clientX - rect.left, e.clientY - rect.top)) {
      api.setIgnoreMouseEvents(false);
    } else {
      api.setIgnoreMouseEvents(true, { forward: true });
    }
  } else {
    api.setIgnoreMouseEvents(true, { forward: true });
  }
});

// --- Drag ---

let isDragging = false;
let didDrag = false;
let lastScreenX = 0;
let lastScreenY = 0;
let stateBeforeDrag: 'idle' | 'sleeping' | 'roaring' | null = null;

spriteContainer.addEventListener('mousedown', (e) => {
  isDragging = true;
  didDrag = false;
  lastScreenX = e.screenX;
  lastScreenY = e.screenY;
  api.setIgnoreMouseEvents(false);
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const dx = e.screenX - lastScreenX;
  const dy = e.screenY - lastScreenY;
  if (!didDrag && Math.abs(dx) + Math.abs(dy) > 2) {
    didDrag = true;
    stateBeforeDrag = visualPose === 'sitting' ? 'idle' : visualPose === 'sleeping' ? 'sleeping' : visualPose === 'roaring' ? 'roaring' : 'idle';
    playSegments([], { sheetKey: 'dragging', frames: range(0, 15) });
  }
  lastScreenX = e.screenX;
  lastScreenY = e.screenY;
  api.dragging(dx, dy);
});

document.addEventListener('mouseup', () => {
  if (!isDragging) return;
  isDragging = false;
  if (didDrag) {
    api.dragEnd();
  }
});

// --- Pet right-click (open hub) ---

spriteContainer.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (didDrag) { didDrag = false; return; }
  if (!toastContainer.classList.contains('hidden')) return;
  api.petClicked();
});

// --- Startup ---
preloadSheets().then(() => {
  goToState('idle');
});
