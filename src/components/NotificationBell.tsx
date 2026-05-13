import { Bell, CheckCheck, BellDot, ExternalLink } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function NotificationBell() {
  const { user } = useAuth();
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications(user?.id);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && unreadCount > 0) {
      markAllRead();
    }
  };

  const handleViewDetails = (notifId: string, dealId?: string) => {
    markRead(notifId);
    setOpen(false);
    navigate("/financeiro", { state: { scrollToPending: true, dealId } });
  };

  const formatTime = (createdAt: string) => {
    try {
      return formatDistanceToNow(new Date(createdAt), { addSuffix: true, locale: ptBR });
    } catch {
      return "";
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          {unreadCount > 0 ? (
            <BellDot className="h-4 w-4" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-white flex items-center justify-center leading-none">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 p-0 bg-card border border-border/60 shadow-xl"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
          <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">
            Notificações
          </span>
          {notifications.some((n) => !n.isRead) && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <CheckCheck className="h-3 w-3" />
              Marcar todas como lidas
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground/60">Nenhuma notificação</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`px-4 py-3 border-b border-border/25 last:border-0 transition-colors ${
                  !n.isRead ? "bg-primary/5" : "hover:bg-muted/20"
                }`}
              >
                <div className="flex items-start gap-2">
                  {!n.isRead && (
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  )}
                  <div className={`flex-1 ${!n.isRead ? "" : "ml-3.5"}`}>
                    <p className="text-xs font-semibold text-foreground leading-tight">
                      {n.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      {n.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground/50 mt-1">
                      {formatTime(n.createdAt)}
                    </p>
                    {n.dealId && (
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2 border-border/50 hover:border-primary/50 hover:text-primary"
                          onClick={() => handleViewDetails(n.id, n.dealId)}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Ver e Confirmar
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
