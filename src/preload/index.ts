import { contextBridge, ipcRenderer } from 'electron';

function onChannel(channel: string, cb: (...args: any[]) => void) {
  ipcRenderer.removeAllListeners(channel);
  ipcRenderer.on(channel, (_e, ...args) => cb(...args));
}

contextBridge.exposeInMainWorld('alertosaurus', {
  onSetState: (cb: (state: string) => void) => onChannel('pet:set-state', cb),
  onFalling: (cb: () => void) => onChannel('pet:falling', cb),
  onLanded: (cb: () => void) => onChannel('pet:landed', cb),
  onShowToast: (cb: (data: { caller: string; message: string; duration_ms: number; received_at: string }) => void) => onChannel('pet:show-toast', cb),
  onHideToast: (cb: () => void) => onChannel('pet:hide-toast', cb),
  onShowOverflow: (cb: (count: number) => void) => onChannel('pet:show-overflow', cb),
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
  getConfig: () => ipcRenderer.invoke('hub:get-config'),
  setConfigValue: (key: string, value: unknown) => ipcRenderer.invoke('hub:set-config-value', key, value),
  quit: () => ipcRenderer.send('hub:quit'),
  onNotificationsUpdated: (cb: () => void) => onChannel('hub:updated', cb),
});
