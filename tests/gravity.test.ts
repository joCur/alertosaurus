import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { luminance, findLandingSurface, createGravityLoop, GRAVITY, MAX_FALL_SPEED, TICK_INTERVAL } from '../src/main/gravity';

describe('luminance', () => {
  it('returns 0 for black', () => {
    expect(luminance(0, 0, 0)).toBe(0);
  });

  it('returns 255 for white', () => {
    expect(luminance(255, 255, 255)).toBe(255);
  });

  it('weights green highest', () => {
    const r = luminance(255, 0, 0);
    const g = luminance(0, 255, 0);
    const b = luminance(0, 0, 255);
    expect(g).toBeGreaterThan(r);
    expect(r).toBeGreaterThan(b);
  });
});

describe('findLandingSurface', () => {
  function makeBuffer(rows: number[][]): Buffer {
    // Each row is [r, g, b] — we expand to RGBA across 4 columns (width=4)
    const width = 4;
    const buf = Buffer.alloc(rows.length * width * 4);
    for (let y = 0; y < rows.length; y++) {
      const [r, g, b] = rows[y];
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4;
        buf[offset] = r;
        buf[offset + 1] = g;
        buf[offset + 2] = b;
        buf[offset + 3] = 255; // alpha
      }
    }
    return buf;
  }

  it('returns null for uniform buffer', () => {
    const buf = makeBuffer([
      [100, 100, 100],
      [100, 100, 100],
      [100, 100, 100],
      [100, 100, 100],
    ]);
    expect(findLandingSurface(buf, 4, 4, 4, 30)).toBeNull();
  });

  it('detects a strong horizontal edge', () => {
    const buf = makeBuffer([
      [50, 50, 50],
      [50, 50, 50],
      [200, 200, 200],  // strong edge at row 2
      [200, 200, 200],
    ]);
    expect(findLandingSurface(buf, 4, 4, 4, 30)).toBe(2);
  });

  it('ignores edges below threshold', () => {
    const buf = makeBuffer([
      [100, 100, 100],
      [110, 110, 110],  // diff = 10, below threshold of 30
      [120, 120, 120],
      [130, 130, 130],
    ]);
    expect(findLandingSurface(buf, 4, 4, 4, 30)).toBeNull();
  });

  it('returns null for height less than 2', () => {
    const buf = Buffer.alloc(4 * 4); // 1 row, width 4, RGBA
    expect(findLandingSurface(buf, 4, 1, 4, 30)).toBeNull();
    expect(findLandingSurface(buf, 4, 0, 4, 30)).toBeNull();
  });

  it('finds the first edge, not later ones', () => {
    const buf = makeBuffer([
      [50, 50, 50],
      [200, 200, 200],   // edge at row 1
      [200, 200, 200],
      [50, 50, 50],      // edge at row 3
    ]);
    expect(findLandingSurface(buf, 4, 4, 4, 30)).toBe(1);
  });
});

describe('createGravityLoop', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('calls onTick with increasing y positions', () => {
    const ticks: number[] = [];
    createGravityLoop(100, 300, (y) => ticks.push(y), () => {});
    vi.advanceTimersByTime(TICK_INTERVAL * 3);
    expect(ticks.length).toBe(3);
    expect(ticks[0]).toBeGreaterThan(100);
    expect(ticks[1]).toBeGreaterThan(ticks[0]);
    expect(ticks[2]).toBeGreaterThan(ticks[1]);
  });

  it('calls onLand and stops when reaching target', () => {
    const landed = vi.fn();
    const ticks: number[] = [];
    createGravityLoop(100, 110, (y) => ticks.push(y), landed);
    vi.advanceTimersByTime(TICK_INTERVAL * 50);
    expect(landed).toHaveBeenCalledOnce();
    expect(landed).toHaveBeenCalledWith(110);
    const tickCountAtLanding = ticks.length;
    vi.advanceTimersByTime(TICK_INTERVAL * 10);
    expect(ticks.length).toBe(tickCountAtLanding);
  });

  it('respects terminal velocity', () => {
    const ticks: number[] = [];
    createGravityLoop(0, 10000, (y) => ticks.push(y), () => {});
    vi.advanceTimersByTime(TICK_INTERVAL * 100);
    for (let i = 2; i < ticks.length; i++) {
      const delta = ticks[i] - ticks[i - 1];
      expect(delta).toBeLessThanOrEqual(MAX_FALL_SPEED + 0.01);
    }
  });

  it('can be cancelled', () => {
    const ticks: number[] = [];
    const cancel = createGravityLoop(100, 500, (y) => ticks.push(y), () => {});
    vi.advanceTimersByTime(TICK_INTERVAL * 2);
    const countBefore = ticks.length;
    cancel();
    vi.advanceTimersByTime(TICK_INTERVAL * 10);
    expect(ticks.length).toBe(countBefore);
  });

  it('lands immediately when startY >= targetY', () => {
    const landed = vi.fn();
    const ticks: number[] = [];
    const cancel = createGravityLoop(200, 100, (y) => ticks.push(y), landed);
    expect(landed).toHaveBeenCalledOnce();
    expect(landed).toHaveBeenCalledWith(200);
    expect(ticks.length).toBe(0);
    vi.advanceTimersByTime(TICK_INTERVAL * 10);
    expect(ticks.length).toBe(0);
  });
});
