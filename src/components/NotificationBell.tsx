import { useState, useRef, useEffect } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/contexts/NotificationContext";
import { useLanguage } from "@/contexts/LanguageContext";

export function NotificationBell() {
  const { notifications, unreadCount, markOneAsRead, markAllRead } = useNotifications();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={t("notifications.title")}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-12 w-80 max-h-96 overflow-y-auto rounded-lg border border-border bg-card shadow-xl z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-semibold text-sm">{t("notifications.title")}</span>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 gap-1"
                onClick={markAllRead}
              >
                <CheckCheck className="h-3 w-3" />
                {t("notifications.mark_all_read")}
              </Button>
            )}
          </div>

          {/* List */}
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {t("notifications.empty")}
            </div>
          ) : (
            <ul>
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={`px-4 py-3 border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/50 transition-colors ${
                    !n.read ? "bg-primary/5" : ""
                  }`}
                  onClick={() => {
                    if (!n.read) markOneAsRead(n.id);
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!n.read ? "font-semibold" : ""}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {n.body}
                      </p>
                    </div>
                    {!n.read && (
                      <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}