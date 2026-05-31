# Hub Notification Filtering & Search

Add a persistent filter bar to the hub's Notifications tab, enabling text search across notifications and filtering by caller/sender.

## UI Layout

A single-row filter bar between the tab nav (`#tabs`) and the notification list (`#notification-list`), inside `#tab-notifications`. Contains:

- **Search input** (left, `flex: 1`): placeholder "Search notifications...", monospace font to match the app. Background `#313244`, text `#cdd6f4`, border `#45475a`, rounded corners. A small "x" clear button appears inside the input when text is present.
- **Caller dropdown** (right, fixed width ~160px): `<select>` styled with `.setting-select`. Default option "All callers", followed by a sorted, deduplicated list of caller names derived from the loaded notifications.

When either filter is active, its border color changes to `#f9e2af` (gold) to indicate active filtering.

## Filter Bar HTML Structure

```html
<div id="filter-bar">
  <div class="search-wrapper">
    <input type="text" id="search-input" placeholder="Search notifications...">
    <button id="search-clear" class="search-clear hidden">&times;</button>
  </div>
  <select id="caller-filter" class="setting-select">
    <option value="">All callers</option>
  </select>
</div>
```

The filter bar is placed inside `#tab-notifications`, above `#notification-list`. A separate empty-filter-results element is also added:

```html
<div id="no-matches" class="hidden">No matching notifications</div>
```

This sits alongside `#empty-state` and is shown/hidden by the render logic.

## Filtering Logic

All filtering is client-side in `hub.ts`. No new IPC channels or database methods are needed.

### Data Flow

1. `loadNotifications()` fetches all notifications via `api.getNotifications()` and stores them in a module-level `allNotifications: NotificationItem[]` variable.
2. After loading, it calls `applyFilters()` instead of `render()` directly.
3. `applyFilters()` reads the current search text and selected caller, filters `allNotifications`, and calls `render()` with the filtered result.

### Filter Function

Extract a pure, testable function:

```typescript
function filterNotifications(
  notifications: NotificationItem[],
  searchText: string,
  callerFilter: string
): NotificationItem[] {
  let result = notifications;

  if (callerFilter) {
    result = result.filter(n => n.caller === callerFilter);
  }

  if (searchText) {
    const lower = searchText.toLowerCase();
    result = result.filter(n =>
      n.caller.toLowerCase().includes(lower) ||
      n.message.toLowerCase().includes(lower)
    );
  }

  return result;
}
```

### Event Bindings

- Search input: `input` event triggers `applyFilters()`. No debounce needed for a local in-memory list.
- Caller dropdown: `change` event triggers `applyFilters()`.
- Clear button: `click` event clears the search input and triggers `applyFilters()`.
- `onNotificationsUpdated` callback: re-fetches notifications, rebuilds the caller dropdown options, and re-applies current filters.

### Caller Dropdown Population

After loading notifications, rebuild the caller dropdown:

```typescript
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
```

## Clickable Caller Names

Caller name spans (`.notification-caller`) in notification rows become clickable:

- Add `cursor: pointer` and underline on hover via CSS.
- On click, set `callerFilterEl.value` to the clicked caller's name and call `applyFilters()`.

This provides a quick "show me more from this sender" shortcut alongside the dropdown.

## Empty States

Two distinct empty states:

1. **No notifications at all** (existing): "No notifications yet. Send one with `roar "hello"`"
2. **No filter matches** (new): "No matching notifications" — shown when `allNotifications.length > 0` but `filterNotifications()` returns an empty array.

## Clearing Filters

- Clearing the search input (via backspace or the "x" button) removes the text filter.
- Selecting "All callers" removes the caller filter.
- Both actions immediately re-render via `applyFilters()`.

## Styling

New CSS additions to `hub.css`:

- `#filter-bar`: `display: flex; gap: 8px; padding: 8px 20px;` — matches the horizontal padding of `.day-group`.
- `.search-wrapper`: `position: relative; flex: 1;` — wraps the input and clear button.
- `#search-input`: dark theme input matching existing form styles. `width: 100%; background: #313244; border: 1px solid #45475a; border-radius: 6px; padding: 6px 28px 6px 10px; color: #cdd6f4; font-size: 13px;`
- `#search-input:focus`: `border-color: #f9e2af; outline: none;`
- `#search-input.active` / `#caller-filter.active`: `border-color: #f9e2af;` — applied when filter has a value.
- `.search-clear`: absolutely positioned inside the search wrapper, right side. Hidden when input is empty.
- `.notification-caller` (updated): `cursor: pointer;` with `.notification-caller:hover { text-decoration: underline; }`.
- `#no-matches`: styled like `#empty-state` but with different text.

## Testing

Extract `filterNotifications()` as a pure function in `src/hub/filter.ts` so it can be unit-tested with Vitest:

- Filters by caller exact match
- Filters by case-insensitive substring in message
- Filters by case-insensitive substring in caller name
- Composes both filters (caller + search text)
- Returns all when no filters active
- Returns empty array when no matches

## Files Changed

- `src/hub/index.html` — add filter bar markup
- `src/hub/hub.ts` — add filter state, event handlers, caller dropdown population, clickable caller names
- `src/hub/hub.css` — add filter bar styles, update `.notification-caller` hover
- `src/hub/filter.ts` (new) — pure `filterNotifications()` function for testability
- `test/filter.test.ts` (new) — unit tests for filter logic

## Out of Scope

- Server-side / DB-level filtering
- Date range filtering
- Keyboard shortcuts (Cmd+F)
- Persisting filter state across hub open/close
- Notification count badges showing filtered vs. total
