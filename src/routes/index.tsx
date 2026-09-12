import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { applyTheme, getTheme, loadThemeFromDatabase } from "@/lib/theme";
import icon from "@/assets/postly-icon.png.asset.json";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Postly — Share posts, chat, connect" },
      {
        name: "description",
        content:
          "Postly is a simple social app: post with photos, follow friends, comment in threads and chat in real time.",
      },
      { property: "og:title", content: "Postly — Share posts, chat, connect" },
      {
        property: "og:description",
        content: "Post with photos, follow friends, comment and chat in real time on Postly.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  useEffect(() => {
    loadThemeFromDatabase().then((dbTheme) => {
      const theme = dbTheme || getTheme();
      applyTheme(theme);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.replace("/feed");
    });
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-brand px-6 text-center">
      <img src={icon.url} alt="Postly logo" className="h-24 w-24 rounded-3xl shadow-soft" />
      <div>
        <h1 className="text-4xl font-extrabold text-white">Postly</h1>
        <p className="mt-2 max-w-sm text-white/85">
          Share posts and photos, follow friends, comment in threads and chat in real time.
        </p>
      </div>
      <Link
        to="/auth"
        className="rounded-full bg-white px-8 py-3 font-semibold text-foreground shadow-soft"
      >
        Get started
      </Link>
    </div>
  );
}
