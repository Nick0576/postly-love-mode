import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Media";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { currentUserId } from "@/lib/postly";
import { applyTheme, getTheme } from "@/lib/theme";

type ButtonElement = {
  id: string;
  type: 'text' | 'image' | 'video' | 'music' | 'link' | 'poll' | 'question' | 'button';
  content: any;
  position: number;
  link_button_id?: string;
};

export const Route = createFileRoute("/_authenticated/view-button-page/$pageId")({
  head: () => ({
    meta: [
      { title: "Button Page — Postly" },
      { name: "description", content: "View a custom button page." },
      { property: "og:title", content: "Button Page — Postly" },
      { property: "og:description", content: "View a button page." },
    ],
  }),
  component: ButtonPageViewer,
});

function ButtonPageViewer() {
  const { pageId } = Route.useParams();

  useEffect(() => {
    applyTheme(getTheme());
  }, []);

  const { data: pageData, isLoading } = useQuery({
    queryKey: ["button-page-view", pageId],
    queryFn: async () => {
      const uid = await currentUserId();
      
      const { data: page, error: pageError } = await supabase
        .from("button_pages")
        .select("*,profiles(*)")
        .eq("id", pageId)
        .single();
      
      if (pageError) throw pageError;
      
      const { data: elementsData, error: elementsError } = await supabase
        .from("button_elements")
        .select("*")
        .eq("button_page_id", pageId)
        .order("position", { ascending: true });
      
      if (elementsError) throw elementsError;
      
      return {
        page,
        elements: elementsData || [],
        isOwner: page.user_id === uid
      };
    },
  });

  if (isLoading) {
    return (
      <AppShell title="Loading...">
        <p>Loading page...</p>
      </AppShell>
    );
  }

  if (!pageData) {
    return (
      <AppShell title="Not Found">
        <p>Page not found</p>
      </AppShell>
    );
  }

  const { page, elements, isOwner } = pageData;

  return (
    <AppShell title={page.title}>
      <div className="space-y-4">
        {/* Page Header */}
        <div className="rounded-2xl border p-4">
          <div className="flex items-center gap-3 mb-3">
            <Avatar
              url={page.profiles?.avatar_url}
              name={page.profiles?.display_name}
              size={40}
            />
            <div>
              <p className="font-medium">{page.profiles?.display_name || page.profiles?.username}</p>
              <p className="text-sm text-muted-foreground">@{page.profiles?.username}</p>
            </div>
          </div>
          {page.description && (
            <p className="text-sm">{page.description}</p>
          )}
          {isOwner && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              asChild
            >
              <Link to="/button-page/$pageId" params={{ pageId }}>
                Edit Page
              </Link>
            </Button>
          )}
        </div>

        {/* Page Elements */}
        <div className="space-y-3">
          {elements.map((element: ButtonElement) => (
            <div key={element.id} className="rounded-2xl border p-4">
              {element.type === 'text' && (
                <p className="whitespace-pre-wrap">{element.content.text}</p>
              )}

              {element.type === 'image' && (
                <div className="space-y-2">
                  {element.content.url && (
                    <img
                      src={element.content.url}
                      alt={element.content.caption || 'Image'}
                      className="max-w-full rounded-lg"
                    />
                  )}
                  {element.content.caption && (
                    <p className="text-sm text-muted-foreground">{element.content.caption}</p>
                  )}
                </div>
              )}

              {element.type === 'video' && (
                <div className="space-y-2">
                  {element.content.url && (
                    <video
                      src={element.content.url}
                      controls
                      className="max-w-full rounded-lg"
                    />
                  )}
                  {element.content.title && (
                    <p className="text-sm font-medium">{element.content.title}</p>
                  )}
                </div>
              )}

              {element.type === 'music' && (
                <div className="space-y-2">
                  {element.content.url && (
                    <audio
                      src={element.content.url}
                      controls
                      className="w-full"
                    />
                  )}
                  {element.content.title && (
                    <p className="text-sm font-medium">{element.content.title}</p>
                  )}
                </div>
              )}

              {element.type === 'link' && (
                <a
                  href={element.content.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 rounded-lg border hover:bg-muted transition-colors"
                >
                  <p className="font-medium">{element.content.title || element.content.url}</p>
                  <p className="text-sm text-muted-foreground truncate">{element.content.url}</p>
                </a>
              )}

              {element.type === 'poll' && (
                <div className="space-y-2">
                  <p className="font-medium">{element.content.question}</p>
                  <div className="space-y-1">
                    {element.content.options.map((opt: string, i: number) => (
                      <button
                        key={i}
                        className="w-full text-left p-2 rounded border hover:bg-muted transition-colors"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {element.type === 'question' && (
                <div className="space-y-2">
                  <p className="font-medium">{element.content.question}</p>
                  <p className="text-sm text-muted-foreground">Answer: {element.content.answer}</p>
                </div>
              )}

              {element.type === 'button' && (
                element.content.target_page_id ? (
                  <Link
                    to="/view-button-page/$pageId"
                    params={{ pageId: element.content.target_page_id }}
                  >
                    <Button className="w-full" variant="default">
                      {element.content.icon && <span className="mr-2">{element.content.icon}</span>}
                      {element.content.name}
                    </Button>
                  </Link>
                ) : (
                  <Button className="w-full" variant="default" disabled>
                    {element.content.icon && <span className="mr-2">{element.content.icon}</span>}
                    {element.content.name}
                  </Button>
                )
              )}
            </div>
          ))}

          {elements.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              This page has no content yet.
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
