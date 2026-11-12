import { NewsEditorView } from "@/news/news-editor-view";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NewsEditorView id={id} />;
}
