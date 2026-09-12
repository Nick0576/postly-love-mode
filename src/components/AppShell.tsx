import { Link } from "@tanstack/react-router";
import { Home, Search, PlusSquare, MessageSquare, Settings } from "lucide-react";
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
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const mainRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling) return;
    const currentY = e.touches[0].clientY;
    const distance = currentY - startY.current;
    if (distance > 0) {
      setPullDistance(Math.min(distance, 100));
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance > 50) {
      setIsRefreshing(true);
      window.location.reload();
    } else {
      setPullDistance(0);
    }
    setIsPulling(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur">
        <img src={icon.url} alt="Postly" className="h-8 w-8 rounded-lg" />
        <h1 className="text-lg font-bold flex-1">{title}</h1>
        {headerAction}
        <AccountSwitcher />
      </header>
      <main 
        ref={mainRef}
        className="mx-auto w-full max-w-xl px-4 pb-28 pt-4"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {isPulling && pullDistance > 0 && (
          <div 
            className="fixed top-0 left-0 right-0 flex justify-center pt-2 transition-opacity"
            style={{ opacity: pullDistance / 100 }}
          >
            <div className="text-sm text-muted-foreground">
              {isRefreshing ? "Refreshing..." : "Pull to refresh"}
            </div>
          </div>
        )}
        {children}
      </main>
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
