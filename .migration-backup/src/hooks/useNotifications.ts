import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppNotification, fetchNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/supabase-deals";

export function useNotifications(userId?: string) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(async () => {
    if (!userId) return;
    const data = await fetchNotifications(userId);
    setNotifications(data);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: escuta inserções na tabela notifications
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications-${userId.slice(0, 8)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        () => {
          clearTimeout(debounceTimer.current);
          debounceTimer.current = setTimeout(load, 400);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications" },
        () => {
          clearTimeout(debounceTimer.current);
          debounceTimer.current = setTimeout(load, 400);
        }
      )
      .subscribe();

    return () => {
      clearTimeout(debounceTimer.current);
      supabase.removeChannel(channel);
    };
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
