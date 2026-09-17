import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useEffect } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { currentUserId, uploadMedia } from "@/lib/postly";
import { applyTheme, getTheme } from "@/lib/theme";
import { Media } from "@/components/Media";

type ButtonElement = {
  id: string;
  type: 'text' | 'image' | 'video' | 'music' | 'link' | 'poll' | 'question' | 'button';
  content: any;
  position: number;
  link_button_id?: string;
};

export const Route = createFileRoute("/_authenticated/button-page/$pageId")({
  head: () => ({
    meta: [
      { title: "Edit Button Page — Postly" },
      { name: "description", content: "Edit your custom button page." },
      { property: "og:title", content: "Edit Button Page — Postly" },
      { property: "og:description", content: "Edit your button page." },
    ],
  }),
  component: ButtonPageEditor,
});

function ButtonPageEditor() {
  const { pageId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [elements, setElements] = useState<ButtonElement[]>([]);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [newElementType, setNewElementType] = useState<'text' | 'image' | 'video' | 'music' | 'link' | 'poll' | 'question' | 'button'>('text');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    applyTheme(getTheme());
  }, []);

  const { data: pageData, isLoading } = useQuery({
    queryKey: ["button-page", pageId],
    queryFn: async () => {
      const uid = await currentUserId();
      const { data: page, error: pageError } = await supabase
        .from("button_pages")
        .select("*")
        .eq("id", pageId)
        .eq("user_id", uid)
        .single();
      
      if (pageError) throw pageError;
      
      const { data: elementsData, error: elementsError } = await supabase
        .from("button_elements")
        .select("*")
        .eq("button_page_id", pageId)
        .order("position", { ascending: true });
      
      if (elementsError) throw elementsError;
      
      setTitle(page.title);
      setDescription(page.description || "");
      setElements((elementsData ?? []) as unknown as ButtonElement[]);
      
      return page;
    },
  });

  const { data: userPages } = useQuery({
    queryKey: ["user-button-pages"],
    queryFn: async () => {
      const uid = await currentUserId();
      const { data } = await supabase
        .from("button_pages")
        .select("id,title")
        .eq("user_id", uid);
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const uid = await currentUserId();
      
      // Update page
      const { error: pageError } = await supabase
        .from("button_pages")
        .update({ title, description })
        .eq("id", pageId)
        .eq("user_id", uid);
      
      if (pageError) throw pageError;
      
      // Delete existing elements
      await supabase
        .from("button_elements")
        .delete()
        .eq("button_page_id", pageId);
      
      // Insert new elements
      for (const element of elements) {
        await supabase
          .from("button_elements")
          .insert({
            button_page_id: pageId,
            type: element.type,
            content: element.content,
            position: element.position,
            link_button_id: element.link_button_id ?? null
          });
      }
    },
    onSuccess: () => {
      toast.success("Page saved");
      qc.invalidateQueries({ queryKey: ["button-page", pageId] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    },
  });

  function addElement() {
    const newElement: ButtonElement = {
      id: crypto.randomUUID(),
      type: newElementType,
      content: getDefaultContent(newElementType),
      position: elements.length,
    };
    setElements([...elements, newElement]);
    setShowAddMenu(false);
  }

  function getDefaultContent(type: string): any {
    switch (type) {
      case 'text': return { text: '' };
      case 'image': return { url: '', caption: '' };
      case 'video': return { url: '', caption: '' };
      case 'music': return { url: '', title: '' };
      case 'link': return { url: '', title: '' };
      case 'poll': return { question: '', options: ['', ''] };
      case 'question': return { question: '', answer: '' };
      case 'button': return { name: '', icon: '', target_page_id: '' };
      default: return {};
    }
  }

  function updateElement(id: string, content: any) {
    setElements(elements.map(el => el.id === id ? { ...el, content } : el));
  }

  function removeElement(id: string) {
    setElements(elements.filter(el => el.id !== id));
  }

  function moveElement(index: number, direction: 'up' | 'down') {
    const newElements = [...elements];
    const swapWith = direction === 'up' ? index - 1 : index + 1;
    const a = newElements[index];
    const b = newElements[swapWith];
    if (a && b) {
      newElements[index] = b;
      newElements[swapWith] = a;
    }
    setElements(newElements.map((el, i) => ({ ...el, position: i })));
  }

  async function handleImageUpload(elementId: string, file: File) {
    try {
      const url = await uploadMedia(file);
      updateElement(elementId, { ...elements.find(e => e.id === elementId)?.content, url });
    } catch (error) {
      toast.error("Failed to upload image");
    }
  }

  if (isLoading) {
    return (
      <AppShell title="Loading...">
        <p>Loading page...</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Edit Button Page">
      <div className="space-y-6">
        <div className="space-y-3 rounded-2xl border p-4">
          <h2 className="font-semibold">Page Settings</h2>
          <div className="space-y-1">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Page Elements</h2>
            <Button size="sm" onClick={() => setShowAddMenu(!showAddMenu)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Element
            </Button>
          </div>

          {showAddMenu && (
            <div className="space-y-2 p-3 rounded-lg border bg-muted">
              <Label>Element Type</Label>
              <select
                value={newElementType}
                onChange={(e) => setNewElementType(e.target.value as any)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="text">Text</option>
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="music">Music</option>
                <option value="link">Link</option>
                <option value="poll">Poll</option>
                <option value="question">Question</option>
                <option value="button">Button</option>
              </select>
              <Button size="sm" onClick={addElement} className="w-full">
                Add
              </Button>
            </div>
          )}

          <div className="space-y-3">
            {elements.map((element, index) => (
              <div key={element.id} className="p-3 rounded-lg border space-y-2">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium capitalize">{element.type}</span>
                  <div className="flex-1" />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => moveElement(index, 'up')}
                    disabled={index === 0}
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => moveElement(index, 'down')}
                    disabled={index === elements.length - 1}
                  >
                    ↓
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeElement(element.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {element.type === 'text' && (
                  <Textarea
                    value={element.content.text}
                    onChange={(e) => updateElement(element.id, { ...element.content, text: e.target.value })}
                    placeholder="Enter text..."
                    rows={3}
                  />
                )}

                {element.type === 'image' && (
                  <div className="space-y-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(element.id, file);
                      }}
                    />
                    {element.content.url && (
                      <Media path={element.content.url} className="max-w-full h-32 object-cover rounded" />
                    )}
                    <Input
                      value={element.content.caption}
                      onChange={(e) => updateElement(element.id, { ...element.content, caption: e.target.value })}
                      placeholder="Caption (optional)"
                    />
                  </div>
                )}

                {element.type === 'link' && (
                  <div className="space-y-2">
                    <Input
                      value={element.content.url}
                      onChange={(e) => updateElement(element.id, { ...element.content, url: e.target.value })}
                      placeholder="https://..."
                    />
                    <Input
                      value={element.content.title}
                      onChange={(e) => updateElement(element.id, { ...element.content, title: e.target.value })}
                      placeholder="Link title"
                    />
                  </div>
                )}

                {element.type === 'button' && (
                  <div className="space-y-2">
                    <Input
                      value={element.content.name}
                      onChange={(e) => updateElement(element.id, { ...element.content, name: e.target.value })}
                      placeholder="Button name"
                    />
                    <Input
                      value={element.content.icon}
                      onChange={(e) => updateElement(element.id, { ...element.content, icon: e.target.value })}
                      placeholder="Icon (emoji)"
                      maxLength={2}
                    />
                    <div className="space-y-1">
                      <Label>Link to Page (optional)</Label>
                      <select
                        value={element.content.target_page_id || ''}
                        onChange={(e) => updateElement(element.id, { ...element.content, target_page_id: e.target.value })}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">No link</option>
                        {userPages?.map((page) => (
                          <option key={page.id} value={page.id}>
                            {page.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {(element.type === 'poll' || element.type === 'question') && (
                  <div className="space-y-2">
                    <Input
                      value={element.content.question}
                      onChange={(e) => updateElement(element.id, { ...element.content, question: e.target.value })}
                      placeholder="Question"
                    />
                    {element.type === 'poll' && (
                      <div className="space-y-1">
                        {element.content.options.map((opt: string, i: number) => (
                          <Input
                            key={i}
                            value={opt}
                            onChange={(e) => {
                              const newOptions = [...element.content.options];
                              newOptions[i] = e.target.value;
                              updateElement(element.id, { ...element.content, options: newOptions });
                            }}
                            placeholder={`Option ${i + 1}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {(element.type === 'video' || element.type === 'music') && (
                  <div className="space-y-2">
                    <Input
                      value={element.content.url}
                      onChange={(e) => updateElement(element.id, { ...element.content, url: e.target.value })}
                      placeholder="URL"
                    />
                    <Input
                      value={element.content.title || element.content.caption}
                      onChange={(e) => updateElement(element.id, { ...element.content, title: e.target.value, caption: e.target.value })}
                      placeholder="Title/Caption"
                    />
                  </div>
                )}
              </div>
            ))}

            {elements.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No elements yet. Click "Add Element" to get started.
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={busy}
            className="flex-1"
          >
            {busy ? "Saving..." : "Save Page"}
          </Button>
          <Button variant="outline" asChild>
            <Link to="/feed">Cancel</Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
