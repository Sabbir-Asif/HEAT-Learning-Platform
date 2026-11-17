import { parseRichText, richTextEmptyDoc } from "@heat/contracts";
import type { NewsPublicPost } from "@heat/contracts";
import { Button, PageHeader } from "@heat/ui";
import { RichTextRenderer } from "@heat/ui/content";
import { ShellContent } from "@heat/ui/shell";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { formatNewsDate } from "./links";

export function NewsArticle({ post }: { post: NewsPublicPost }) {
  const parsed = parseRichText(post.body);
  return (
    <ShellContent>
      <PageHeader
        title={post.title}
        action={
          <Button variant="outline" nativeButton={false} render={<Link href="/news" />}>
            <ArrowLeftIcon data-icon="inline-start" />
            All news
          </Button>
        }
      />
      <p>
        <time dateTime={post.publishedAt}>{formatNewsDate(post.publishedAt)}</time>
      </p>
      <RichTextRenderer document={parsed.ok ? parsed.doc : richTextEmptyDoc} images={post.images} />
    </ShellContent>
  );
}
