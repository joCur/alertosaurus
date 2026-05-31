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
