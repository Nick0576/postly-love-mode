import { supabase } from "@/integrations/supabase/client";

export type Theme = "light" | "dark";

const KEY = "postly-theme";

export function getTheme(): Theme {
  if (typeof localStorage === "undefined") return "light";
  return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
}

export function setTheme(theme: Theme) {
  localStorage.setItem(KEY, theme);
  applyTheme(theme);
  saveThemeToDatabase(theme);
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

async function saveThemeToDatabase(theme: Theme) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ theme }).eq("id", user.id);
    }
  } catch (e) {
    console.error("Failed to save theme to database:", e);
  }
}

export async function loadThemeFromDatabase(): Promise<Theme | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("profiles").select("theme").eq("id", user.id).maybeSingle();
      if (data?.theme) {
        return data.theme as Theme;
      }
    }
  } catch (e) {
    console.error("Failed to load theme from database:", e);
  }
  return null;
}
