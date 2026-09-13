import { useQuery } from "@tanstack/react-query";
import { signedUrl } from "@/lib/postly";

export function Media({ path, className }: { path: string | null; className?: string }) {
  const { data } = useQuery({
    queryKey: ["media", path],
    queryFn: () => signedUrl(path),
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
  });
  if (!path || !data) return null;
  return (
    <img
      src={data}
      alt="Post attachment"
      loading="lazy"
      className={className ?? "mt-3 max-h-96 w-full rounded-xl object-cover"}
    />
  );
}

type AvatarProps = {
  url?: string | null | undefined;
  name?: string | null | undefined;
  size?: number;
  className?: string;
};

export function Avatar({ url, name, size = 40 }: AvatarProps) {
  const { data } = useQuery({
    queryKey: ["media", url ?? null],
    queryFn: () => signedUrl(url ?? null),
    enabled: !!url,
    staleTime: 50 * 60 * 1000,
  });
  if (url && data) {
    return (
      <img
        src={data}
        alt={name ?? ""}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: size / 2.4 }}
      className="flex shrink-0 items-center justify-center rounded-full bg-brand font-bold text-primary-foreground"
    >
      {(name || "?").charAt(0).toUpperCase()}
    </div>
  );
}
