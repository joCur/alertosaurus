import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('alertosaurus', {
  onSetState: (cb: (state: string) => void) => {
    ipcRenderer.on('pet:set-state', (_e, state) => cb(state));
  },
  onShowToast: (cb: (data: { caller: string; message: string; duration_ms: number; received_at: string }) => void) => {
    ipcRenderer.on('pet:show-toast', (_e, data) => cb(data));
  },
  onHideToast: (cb: () => void) => {
    ipcRenderer.on('pet:hide-toast', () => cb());
  },
  onShowOverflow: (cb: (count: number) => void) => {
    ipcRenderer.on('pet:show-overflow', (_e, count) => cb(count));
  },
  toastDismissed: () => ipcRenderer.send('pet:toast-dismissed'),
  animationComplete: () => ipcRenderer.send('pet:animation-complete'),
  stateReached: (state: string) => ipcRenderer.send('pet:state-reached', state),
  petClicked: () => ipcRenderer.send('pet:clicked'),
  overflowClicked: () => ipcRenderer.send('pet:overflow-clicked'),
  dragging: (dx: number, dy: number) => ipcRenderer.send('pet:dragging', dx, dy),
  dragEnd: () => ipcRenderer.send('pet:drag-end'),
  setIgnoreMouseEvents: (ignore: boolean, opts?: { forward: boolean }) =>
    ipcRenderer.send('set-ignore-mouse-events', ignore, opts),

  getNotifications: () => ipcRenderer.invoke('hub:get-notifications'),
  getEndpointInfo: () => ipcRenderer.invoke('hub:get-endpoint-info'),
  clearHistory: () => ipcRenderer.invoke('hub:clear-history'),
  quit: () => ipcRenderer.send('hub:quit'),
  onNotificationsUpdated: (cb: () => void) => {
    ipcRenderer.on('hub:updated', () => cb());
  },
});
