import { NewsArticle } from "@/public-pages/news-article";
import { cachedNewsPost } from "@/public-pages/public-data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await cachedNewsPost(slug);
  return post === null ? {} : { title: post.title };
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const post = await cachedNewsPost(slug);
  if (post === null) notFound();
  return <NewsArticle post={post} />;
}
