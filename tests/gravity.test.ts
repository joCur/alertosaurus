import { describe, it, expect } from 'vitest';
import { luminance, findLandingSurface } from '../src/main/gravity';

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
