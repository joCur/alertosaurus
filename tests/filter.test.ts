import { describe, it, expect } from 'vitest';
import { filterNotifications, NotificationItem } from '../src/hub/filter';

const items: NotificationItem[] = [
  { id: '1', caller: 'deploy', message: 'staging is live', received_at: '2026-05-31T10:00:00Z' },
  { id: '2', caller: 'ci', message: 'build passed', received_at: '2026-05-31T10:01:00Z' },
  { id: '3', caller: 'ci', message: 'deploy finished', received_at: '2026-05-31T10:02:00Z' },
  { id: '4', caller: 'monitor', message: 'CPU spike detected', received_at: '2026-05-31T10:03:00Z' },
];

describe('filterNotifications', () => {
  it('returns all notifications when no filters are active', () => {
    expect(filterNotifications(items, '', '')).toEqual(items);
  });

  it('filters by caller exact match', () => {
    const result = filterNotifications(items, '', 'ci');
    expect(result).toEqual([items[1], items[2]]);
  });

  it('filters by case-insensitive substring in message', () => {
    const result = filterNotifications(items, 'SPIKE', '');
    expect(result).toEqual([items[3]]);
  });

  it('filters by case-insensitive substring in caller', () => {
    const result = filterNotifications(items, 'MON', '');
    expect(result).toEqual([items[3]]);
  });

  it('composes caller filter and search text', () => {
    const result = filterNotifications(items, 'deploy', 'ci');
    expect(result).toEqual([items[2]]);
  });

  it('returns empty array when nothing matches', () => {
    expect(filterNotifications(items, 'nonexistent', '')).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(filterNotifications([], 'test', 'ci')).toEqual([]);
  });
});
