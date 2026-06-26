import { exportEpisodeScript } from "@/lib/export/export-script";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const includeInnerThought = url.searchParams.get("includeInnerThought") === "true";
  const markdown = await exportEpisodeScript(id, { includeInnerThought });

  return new Response(markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `inline; filename="episode-${id}.md"`
    }
  });
}
