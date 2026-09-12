import { Link } from "@tanstack/react-router";
import { Home, Search, PlusSquare, MessageSquare, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import icon from "@/assets/postly-icon.png.asset.json";
import { AccountSwitcher } from "@/components/AccountSwitcher";

const items = [
  { to: "/feed", label: "Home", Icon: Home },
  { to: "/search", label: "Search", Icon: Search },
  { to: "/compose", label: "Post", Icon: PlusSquare },
  { to: "/messages", label: "Chats", Icon: MessageSquare },
  { to: "/settings", label: "Settings", Icon: Settings },
] as const;

export function AppShell({ title, children, headerAction }: { title: string; children: ReactNode; headerAction?: ReactNode }) {
  const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [isPressing, setIsPressing] = useState(false);

  const handlePressStart = () => {
    setIsPressing(true);
    const timer = setTimeout(() => {
      window.location.reload();
    }, 500);
    setPressTimer(timer);
  };

  const handlePressEnd = () => {
    setIsPressing(false);
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
  };

  useEffect(() => {
    return () => {
      if (pressTimer) clearTimeout(pressTimer);
    };
  }, [pressTimer]);

  return (
    <div className="min-h-screen bg-background">
      <header 
        className={`sticky top-0 z-10 flex items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur transition-opacity ${isPressing ? 'opacity-70' : ''}`}
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
      >
        <img src={icon.url} alt="Postly" className="h-8 w-8 rounded-lg" />
        <h1 className="text-lg font-bold flex-1">{title}</h1>
        {headerAction}
        <AccountSwitcher />
      </header>
      <main className="mx-auto w-full max-w-xl px-4 pb-28 pt-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-around px-2 py-2">
          {items.map(({ to, label, Icon }) => (
            <Link
              key={to}
              to={to}
              activeProps={{ className: "text-primary" }}
              inactiveProps={{ className: "text-muted-foreground" }}
              className="flex flex-col items-center gap-1 rounded-lg px-3 py-1 text-xs"
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
