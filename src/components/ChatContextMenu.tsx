import { useEffect, useRef, useState, type ReactNode, type PointerEvent } from "react";
import { MailOpen, BellOff, BellRing, Archive, ArchiveRestore, Pin, PinOff, Trash2, Check, X } from "lucide-react";
import { Avatar } from "@/components/Media";

export type ConversationMeta = {
  unread?: boolean;
  muted?: boolean;
  archived?: boolean;
  pinned?: boolean;
};

type ChatContextMenuProps = {
  id: string;
  kind: "dm" | "group";
  name: string;
  subtitle: string;
  avatarUrl?: string | null;
  meta: ConversationMeta;
  children: ReactNode;
  onAction: (action: "unread" | "mute" | "archive" | "delete" | "pin", id: string, kind: "dm" | "group") => void;
};

const LONG_PRESS_MS = 500;

export function ChatContextMenu({ id, kind, name, subtitle, avatarUrl, meta, children, onAction }: ChatContextMenuProps) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);
  const pressedRef = useRef(false);
  const longPressedRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handlePointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    pressedRef.current = true;
    longPressedRef.current = false;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      longPressedRef.current = true;
      pressedRef.current = false;
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(10);
      }
      setOpen(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    }, LONG_PRESS_MS);
  };

  const handlePointerUp = () => {
    pressedRef.current = false;
    clearTimer();
  };

  const handlePointerLeave = () => {
    if (!open) {
      pressedRef.current = false;
      clearTimer();
    }
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    if (longPressedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      longPressedRef.current = false;
    }
  };

  const close = () => {
    setVisible(false);
    window.setTimeout(() => setOpen(false), 250);
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    return clearTimer;
  }, []);

  return (
    <>
      <div
        className="relative select-none"
        style={{ WebkitTouchCallout: "none" }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerUp}
        onClickCapture={handleClickCapture}
      >
        {children}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label={`${name} options`}
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
            style={{ opacity: visible ? 1 : 0 }}
            onClick={close}
          />
          <div className="relative z-10 flex h-full flex-col justify-between p-4">
            <div className="flex justify-center pt-2">
              <div
                className="w-full max-w-sm rounded-2xl border border-white/10 bg-card/90 p-4 shadow-2xl backdrop-blur-xl transition-all duration-300"
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? "scale(1) translateY(0)" : "scale(0.92) translateY(-8px)",
                  transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
              >
                <div className="flex items-center gap-3">
                  {kind === "dm" ? (
                    <Avatar url={avatarUrl ?? null} name={name} size={44} />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                      {name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{name}</p>
                    <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center pb-2">
              <div
                className="w-full max-w-sm space-y-2 transition-all duration-300"
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? "scale(1) translateY(0)" : "scale(0.94) translateY(12px)",
                  transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
              >
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-card/90 shadow-xl backdrop-blur-xl">
                  <button
                    type="button"
                    onClick={() => { close(); onAction("unread", id, kind); }}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium transition-colors hover:bg-muted/60"
                  >
                    <MailOpen className="h-5 w-5 text-muted-foreground" />
                    <span className="flex-1">{meta.unread ? "Mark as Read" : "Mark as Unread"}</span>
                  </button>
                  <div className="h-px bg-border/60" />
                  <button
                    type="button"
                    onClick={() => { close(); onAction("mute", id, kind); }}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium transition-colors hover:bg-muted/60"
                  >
                    {meta.muted ? <BellRing className="h-5 w-5 text-muted-foreground" /> : <BellOff className="h-5 w-5 text-muted-foreground" />}
                    <span className="flex-1">{meta.muted ? "Unmute" : "Mute"}</span>
                    {meta.muted && <Check className="h-4 w-4 text-primary" />}
                  </button>
                  <div className="h-px bg-border/60" />
                  <div className="h-px bg-border/60" />
                  <button
                    type="button"
                    onClick={() => { close(); onAction("pin", id, kind); }}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium transition-colors hover:bg-muted/60"
                  >
                    {meta.pinned ? <PinOff className="h-5 w-5 text-muted-foreground" /> : <Pin className="h-5 w-5 text-muted-foreground" />}
                    <span className="flex-1">{meta.pinned ? "Unpin" : "Pin"}</span>
                    {meta.pinned && <Check className="h-4 w-4 text-primary" />}
                  </button>
                  <div className="h-px bg-border/60" />
                  <button
                    type="button"
                    onClick={() => { close(); onAction("archive", id, kind); }}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium transition-colors hover:bg-muted/60"
                  >
                    {meta.archived ? <ArchiveRestore className="h-5 w-5 text-muted-foreground" /> : <Archive className="h-5 w-5 text-muted-foreground" />}
                    <span className="flex-1">{meta.archived ? "Unarchive" : "Archive"}</span>
                  </button>
                </div>

                <div className="overflow-hidden rounded-2xl border border-white/10 bg-card/90 shadow-xl backdrop-blur-xl">
                  <button
                    type="button"
                    onClick={() => close()}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium transition-colors hover:bg-muted/60"
                  >
                    <X className="h-5 w-5 text-muted-foreground" />
                    <span className="flex-1">Close</span>
                  </button>
                </div>

                <div className="overflow-hidden rounded-2xl border border-red-500/20 bg-card/90 shadow-xl backdrop-blur-xl">
                  <button
                    type="button"
                    onClick={() => { close(); onAction("delete", id, kind); }}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <Trash2 className="h-5 w-5" />
                    <span className="flex-1">Delete</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
