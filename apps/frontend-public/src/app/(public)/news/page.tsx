import { NewsList } from "@/public-pages/news-list";
import { newsPageFromParam } from "@/public-pages/links";
import { cachedNewsList } from "@/public-pages/public-data";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "News" };

interface PageProps {
  searchParams: Promise<{ page?: string | string[] }>;
}

export default async function Page({ searchParams }: PageProps) {
  const { page } = await searchParams;
  const news = await cachedNewsList(newsPageFromParam(page));
  return <NewsList news={news} />;
}
