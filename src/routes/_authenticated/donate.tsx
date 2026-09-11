import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

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
  return (
    <AppShell title="Donate a File">
      <iframe
        src="https://zappfiles.com/r/rK5zOMxn5MAnweARKJVOVQ"
        title="Donate a file"
        className="h-[70vh] w-full rounded-2xl border"
      />
    </AppShell>
  );
}
