export const SPRITE_GROUND_OFFSET = 13;
export const BODY_PADDING = 8;
export const PET_WINDOW_WIDTH = 320;
export const PET_WINDOW_HEIGHT = 300;
export const SPRITE_DISPLAY_WIDTH = 225;
export const GRAVITY = 1.5;
export const MAX_FALL_SPEED = 25;
export const TICK_INTERVAL = 33;

export function luminance(r: number, g: number, b: number): number {
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
}

export function feetScreenY(windowY: number): number {
  return windowY + PET_WINDOW_HEIGHT - BODY_PADDING - SPRITE_GROUND_OFFSET;
}

export function targetWindowY(landingY: number): number {
  return landingY - PET_WINDOW_HEIGHT + BODY_PADDING + SPRITE_GROUND_OFFSET;
}

export function scanX(windowX: number): number {
  return windowX + Math.floor((PET_WINDOW_WIDTH - SPRITE_DISPLAY_WIDTH) / 2);
}

export function findLandingSurface(
  buffer: Buffer,
  width: number,
  height: number,
  channels: number,
  threshold: number,
): number | null {
  if (height < 2) return null;

  const sampleCols = [
    Math.floor(width * 0.25),
    Math.floor(width * 0.5),
    Math.floor(width * 0.75),
  ];

  for (let y = 1; y < height; y++) {
    let edgeCount = 0;
    for (const col of sampleCols) {
      const prevIdx = ((y - 1) * width + col) * channels;
      const currIdx = (y * width + col) * channels;
      const prevLum = luminance(buffer[prevIdx], buffer[prevIdx + 1], buffer[prevIdx + 2]);
      const currLum = luminance(buffer[currIdx], buffer[currIdx + 1], buffer[currIdx + 2]);
      if (Math.abs(currLum - prevLum) > threshold) {
        edgeCount++;
      }
    }
    if (edgeCount >= 2) {
      return y;
    }
  }

  return null;
}

export function createGravityLoop(
  startY: number,
  targetY: number,
  onTick: (y: number) => void,
  onLand: (y: number) => void,
): () => void {
  if (startY >= targetY) {
    onLand(startY);
    return () => {};
  }

  let y = startY;
  let vy = 0;

  const timer = setInterval(() => {
    vy = Math.min(vy + GRAVITY, MAX_FALL_SPEED);
    y += vy;

    if (y >= targetY) {
      y = targetY;
      clearInterval(timer);
      onTick(Math.round(y));
      onLand(Math.round(y));
      return;
    }

    onTick(Math.round(y));
  }, TICK_INTERVAL);

  return () => clearInterval(timer);
}
