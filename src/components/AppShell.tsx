import { Link } from "@tanstack/react-router";
import { Home, Search, PlusSquare, MessageSquare, Settings, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { useState, useRef } from "react";
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
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const isPulling = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling.current) return;
    const currentY = e.touches[0].clientY;
    const distance = currentY - startY.current;
    if (distance > 0 && window.scrollY === 0) {
      setPullDistance(Math.min(distance, 120));
    }
  };

  const handleTouchEnd = () => {
    isPulling.current = false;
    if (pullDistance > 80) {
      setIsRefreshing(true);
      window.location.reload();
    }
    setPullDistance(0);
  };

  return (
    <div 
      className="min-h-screen bg-background"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {pullDistance > 0 && (
        <div 
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-background border-b"
          style={{ height: `${pullDistance}px`, opacity: pullDistance / 120 }}
        >
          <RefreshCw className={`h-6 w-6 text-primary ${isRefreshing ? 'animate-spin' : ''}`} />
        </div>
      )}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur">
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
