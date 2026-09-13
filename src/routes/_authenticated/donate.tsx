import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { applyTheme, getTheme } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/donate")({
  head: () => ({
    meta: [
      { title: "Donate a File — Postly" },
      { name: "description", content: "Support Postly by donating a file, right inside the app." },
      { property: "og:title", content: "Donate a File — Postly" },
      { property: "og:description", content: "Support Postly by donating a file, right inside the app." },
    ],
  }),
  component: Donate,
});

function Donate() {
  useEffect(() => {
    applyTheme(getTheme());
  }, []);

  return (
    <AppShell title="Donate a File">
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <p className="text-muted-foreground">Support Postly by donating a file</p>
        <Button
          asChild
          size="lg"
          onClick={() => window.open("https://zappfiles.com/r/rK5zOMxn5MAnweARKJVOVQ", "_blank")}
        >
          <span className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Open Donation Page
          </span>
        </Button>
      </div>
    </AppShell>
  );
}
