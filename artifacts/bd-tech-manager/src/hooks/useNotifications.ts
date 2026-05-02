import { useState, useEffect, useCallback, useRef } from "react";
import { AppNotification, fetchNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/supabase-deals";

export function useNotifications(userId?: string) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const pollTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const load = useCallback(async () => {
    if (!userId) return;
    const data = await fetchNotifications(userId);
    setNotifications(data);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Polling a cada 30s em vez de Realtime
  useEffect(() => {
    if (!userId) return;
    pollTimer.current = setInterval(load, 30_000);
    return () => clearInterval(pollTimer.current);
  }, [userId, load]);

  const markRead = useCallback(async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  }, []);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    await markAllNotificationsRead(userId);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, [userId]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return { notifications, unreadCount, markRead, markAllRead };
}
