import { Link } from "@tanstack/react-router";
import { Home, Search, PlusSquare, MessageSquare, Settings, RefreshCw, Bot, X, Archive, ChevronRight, ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useState, useRef } from "react";
import icon from "@/assets/postly-icon.png.asset.json";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import { Button } from "@/components/ui/button";

const mainItems = [
  { to: "/feed", label: "Home", Icon: Home },
  { to: "/search", label: "Search", Icon: Search },
  { to: "/compose", label: "Post", Icon: PlusSquare },
  { to: "/messages", label: "Chat", Icon: MessageSquare },
  { to: "/settings", label: "Settings", Icon: Settings },
] as const;

const extraItems = [
  { to: "/archive", label: "Archive", Icon: Archive },
] as const;

const allItems = [...mainItems, { to: "#ai", label: "AI", Icon: Bot, isButton: true }, ...extraItems];

export function AppShell({ title, children, headerAction }: { title: ReactNode; children: ReactNode; headerAction?: ReactNode }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [navPage, setNavPage] = useState(1);
  const startY = useRef(0);
  const isPulling = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t && window.scrollY === 0) {
      startY.current = t.clientY;
      isPulling.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling.current) return;
    const t = e.touches[0];
    if (!t) return;
    const distance = t.clientY - startY.current;
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
        <div className="mx-auto flex max-w-xl items-center gap-2 px-4 py-2">
          {navPage === 2 && (
            <button
              onClick={() => setNavPage(1)}
              className="flex flex-col items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <div className="flex-1 flex items-center justify-center gap-1">
            {navPage === 1 ? (
              mainItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeProps={{ className: "text-primary" }}
                  inactiveProps={{ className: "text-muted-foreground" }}
                  className="flex flex-col items-center gap-1 rounded-lg px-3 py-1 text-xs whitespace-nowrap"
                >
                  <item.Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              ))
            ) : (
              <>
                <button
                  onClick={() => setAiModalOpen(true)}
                  className="flex flex-col items-center gap-1 rounded-lg px-3 py-1 text-xs text-muted-foreground whitespace-nowrap"
                >
                  <Bot className="h-5 w-5" />
                  AI
                </button>
                {extraItems.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    activeProps={{ className: "text-primary" }}
                    inactiveProps={{ className: "text-muted-foreground" }}
                    className="flex flex-col items-center gap-1 rounded-lg px-3 py-1 text-xs whitespace-nowrap"
                  >
                    <item.Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                ))}
              </>
            )}
          </div>
          {navPage === 1 && (
            <button
              onClick={() => setNavPage(2)}
              className="flex flex-col items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      </nav>

      {/* AI Modal */}
      {aiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAiModalOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border bg-background p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Ask Seeklina</h2>
              <Button variant="ghost" size="icon" onClick={() => setAiModalOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="space-y-4">
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold mb-2">Free</h3>
                <a
                  href="https://baybayin-ai-chat.lovable.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  baybayin-ai-chat.lovable.app
                </a>
              </div>
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold mb-2">Paid - ₱80</h3>
                <p className="text-sm text-muted-foreground mb-2">Chat me on Facebook Messenger to get it</p>
                <a
                  href="https://www.facebook.com/profile.php?id=61575424813244"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  https://www.facebook.com/profile.php?id=61575424813244
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
