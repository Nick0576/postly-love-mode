import { PartyPopper } from "lucide-react";

export function AnnouncementBanner() {
  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm">
      <PartyPopper className="h-5 w-5 flex-shrink-0 text-primary" />
      <p className="font-medium">
        🌱 Postly is growing! <span className="text-muted-foreground">666 downloads and counting! 🎉</span>
      </p>
    </div>
  );
}
