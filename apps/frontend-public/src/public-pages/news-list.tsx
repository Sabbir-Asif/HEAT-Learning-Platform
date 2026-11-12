import type { NewsPublicListResponse } from "@heat/contracts";
import {
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
} from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import { NewspaperIcon } from "lucide-react";
import Link from "next/link";
import { CatalogImage } from "./catalog-image";
import { formatNewsDate, newsHref, newsPageHref } from "./links";

export function NewsList({ news }: { news: NewsPublicListResponse }) {
  const pages = Math.max(1, Math.ceil(news.total / news.pageSize));
  return (
    <ShellContent>
      <PageHeader title="News" />
      {news.items.length === 0 ? (
        <EmptyState
          icon={NewspaperIcon}
          title="No news yet"
          description="Updates will appear here when they are published."
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {news.items.map((item) => (
            <li key={item.slug}>
              <Card>
                {item.cover === null ? null : (
                  <CatalogImage image={item.cover} sizes="(min-width: 1024px) 960px, 100vw" />
                )}
                <CardHeader>
                  <CardTitle>
                    <Link href={newsHref(item.slug)}>{item.title}</Link>
                  </CardTitle>
                  <CardDescription>
                    <time dateTime={item.publishedAt}>{formatNewsDate(item.publishedAt)}</time>
                  </CardDescription>
                  {item.summary === "" ? null : (
                    <CardDescription className="break-words">{item.summary}</CardDescription>
                  )}
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {pages > 1 ? (
        <nav aria-label="News pages" className="flex items-center justify-between gap-2">
          {news.page > 1 ? (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={newsPageHref(news.page - 1)} />}
            >
              Newer posts
            </Button>
          ) : (
            <span />
          )}
          <span>
            Page {news.page} of {pages}
          </span>
          {news.page < pages ? (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={newsPageHref(news.page + 1)} />}
            >
              Older posts
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </ShellContent>
  );
}
