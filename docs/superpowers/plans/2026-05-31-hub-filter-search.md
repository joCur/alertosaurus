# Hub Filter & Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent search bar and caller dropdown to the hub's Notifications tab so users can filter their notification history.

**Architecture:** Pure client-side filtering. A new `filter.ts` module exports a pure `filterNotifications()` function. `hub.ts` stores all fetched notifications in a module-level array and re-renders a filtered subset whenever the search input or caller dropdown changes. No new IPC channels or database queries needed.

**Tech Stack:** TypeScript, Vitest, HTML/CSS (Catppuccin dark theme)

---

### Task 1: Create `filterNotifications` pure function with tests

**Files:**
- Create: `src/hub/filter.ts`
- Create: `tests/filter.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/filter.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/filter.test.ts`
Expected: FAIL — cannot resolve `../src/hub/filter`

- [ ] **Step 3: Write the implementation**

Create `src/hub/filter.ts`:

```typescript
export interface NotificationItem {
  id: string;
  caller: string;
  message: string;
  received_at: string;
}

export function filterNotifications(
  notifications: NotificationItem[],
  searchText: string,
  callerFilter: string,
): NotificationItem[] {
  let result = notifications;

  if (callerFilter) {
    result = result.filter(n => n.caller === callerFilter);
  }

  if (searchText) {
    const lower = searchText.toLowerCase();
    result = result.filter(
      n => n.caller.toLowerCase().includes(lower) || n.message.toLowerCase().includes(lower),
    );
  }

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/filter.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/hub/filter.ts tests/filter.test.ts
git commit -m "feat: add filterNotifications pure function with tests"
```

---

### Task 2: Add filter bar HTML and CSS

**Files:**
- Modify: `src/hub/index.html:18-20`
- Modify: `src/hub/hub.css` (append)

- [ ] **Step 1: Add filter bar markup to index.html**

Replace lines 18-20 of `src/hub/index.html` (the `#tab-notifications` div) with:

```html
    <div id="tab-notifications">
      <div id="filter-bar">
        <div class="search-wrapper">
          <input type="text" id="search-input" placeholder="Search notifications...">
          <button id="search-clear" class="search-clear hidden">&times;</button>
        </div>
        <select id="caller-filter" class="setting-select">
          <option value="">All callers</option>
        </select>
      </div>
      <div id="notification-list"></div>
      <div id="empty-state" class="hidden">No notifications yet. Send one with <code>roar "hello"</code></div>
      <div id="no-matches" class="hidden">No matching notifications</div>
    </div>
```

- [ ] **Step 2: Add filter bar styles to hub.css**

Append to `hub.css`:

```css
#filter-bar {
  display: flex;
  gap: 8px;
  padding: 8px 20px;
}

.search-wrapper {
  position: relative;
  flex: 1;
}

#search-input {
  width: 100%;
  background: #313244;
  border: 1px solid #45475a;
  border-radius: 6px;
  padding: 6px 28px 6px 10px;
  color: #cdd6f4;
  font-size: 13px;
  font-family: 'SF Mono', 'Consolas', monospace;
}

#search-input::placeholder {
  color: #6c7086;
}

#search-input:focus {
  outline: none;
  border-color: #f9e2af;
}

#search-input.active {
  border-color: #f9e2af;
}

#caller-filter.active {
  border-color: #f9e2af;
}

.search-clear {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #6c7086;
  font-size: 14px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.search-clear:hover {
  color: #cdd6f4;
}

.notification-caller {
  cursor: pointer;
}

.notification-caller:hover {
  text-decoration: underline;
}

#no-matches {
  text-align: center;
  color: #6c7086;
  padding: 40px 20px;
  font-size: 14px;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hub/index.html src/hub/hub.css
git commit -m "feat: add filter bar HTML and CSS to hub"
```

---

### Task 3: Wire up filtering logic in hub.ts

**Files:**
- Modify: `src/hub/hub.ts`

- [ ] **Step 1: Import filter function and add DOM references**

At the top of `hub.ts`, replace:

```typescript
export {};

const api = (window as any).alertosaurus;
document.body.dataset.platform = api.platform;
const listEl = document.getElementById('notification-list')!;
const emptyEl = document.getElementById('empty-state')!;
```

with:

```typescript
import { filterNotifications, NotificationItem } from './filter';

const api = (window as any).alertosaurus;
document.body.dataset.platform = api.platform;
const listEl = document.getElementById('notification-list')!;
const emptyEl = document.getElementById('empty-state')!;
const noMatchesEl = document.getElementById('no-matches')!;
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const searchClearBtn = document.getElementById('search-clear')!;
const callerFilterEl = document.getElementById('caller-filter') as HTMLSelectElement;
```

- [ ] **Step 2: Add module-level state and filter functions**

After the tab-switching block (after line 34), add:

```typescript
// --- Filtering ---

let allNotifications: NotificationItem[] = [];

function updateCallerDropdown(notifications: NotificationItem[]) {
  const callers = [...new Set(notifications.map(n => n.caller))].sort();
  const current = callerFilterEl.value;
  callerFilterEl.innerHTML = '<option value="">All callers</option>';
  for (const caller of callers) {
    const opt = document.createElement('option');
    opt.value = caller;
    opt.textContent = caller;
    callerFilterEl.appendChild(opt);
  }
  if (callers.includes(current)) {
    callerFilterEl.value = current;
  }
}

function applyFilters() {
  const searchText = searchInput.value;
  const callerFilter = callerFilterEl.value;

  searchInput.classList.toggle('active', searchText.length > 0);
  searchClearBtn.classList.toggle('hidden', searchText.length === 0);
  callerFilterEl.classList.toggle('active', callerFilter.length > 0);

  const filtered = filterNotifications(allNotifications, searchText, callerFilter);
  render(filtered);
}
```

- [ ] **Step 3: Remove the old `NotificationItem` interface**

Delete this line from `hub.ts` (it's now imported from `filter.ts`):

```typescript
interface NotificationItem { id: string; caller: string; message: string; received_at: string; }
```

- [ ] **Step 4: Update `render()` to handle the no-matches empty state**

Replace the empty-state handling at the top of `render()`:

```typescript
function render(notifications: NotificationItem[]) {
  listEl.innerHTML = '';

  if (notifications.length === 0) {
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
```

with:

```typescript
function render(notifications: NotificationItem[]) {
  listEl.innerHTML = '';

  const hasFilters = searchInput.value.length > 0 || callerFilterEl.value.length > 0;

  if (notifications.length === 0) {
    if (hasFilters) {
      noMatchesEl.classList.remove('hidden');
      emptyEl.classList.add('hidden');
    } else {
      emptyEl.classList.remove('hidden');
      noMatchesEl.classList.add('hidden');
    }
    return;
  }

  emptyEl.classList.add('hidden');
  noMatchesEl.classList.add('hidden');
```

- [ ] **Step 5: Add click handler on caller names for filtering**

In the notification row rendering loop, after the line that creates the caller span:

```typescript
      const caller = document.createElement('span');
      caller.className = 'notification-caller';
      caller.textContent = n.caller;
      row.appendChild(caller);
```

Add a click handler right after `row.appendChild(caller);`:

```typescript
      caller.addEventListener('click', () => {
        callerFilterEl.value = n.caller;
        applyFilters();
      });
```

- [ ] **Step 6: Update `loadNotifications()` to store and filter**

Replace:

```typescript
async function loadNotifications() {
  const notifications = await api.getNotifications();
  render(notifications);
}
```

with:

```typescript
async function loadNotifications() {
  allNotifications = await api.getNotifications();
  updateCallerDropdown(allNotifications);
  applyFilters();
}
```

- [ ] **Step 7: Add event listeners for filter controls**

Before the existing `// --- Actions ---` comment, add:

```typescript
searchInput.addEventListener('input', applyFilters);
callerFilterEl.addEventListener('change', applyFilters);
searchClearBtn.addEventListener('click', () => {
  searchInput.value = '';
  applyFilters();
});
```

- [ ] **Step 8: Verify the build compiles**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 9: Commit**

```bash
git add src/hub/hub.ts
git commit -m "feat: wire up search and caller filter in hub"
```

---

### Task 4: Verify all tests pass

**Files:** (no changes — verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: All tests pass (existing tests + new filter tests)

- [ ] **Step 2: Run build to verify no regressions**

Run: `npm run build`
Expected: Clean build, no errors
