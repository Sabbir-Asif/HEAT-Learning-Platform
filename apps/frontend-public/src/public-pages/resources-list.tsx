import { formatFileSize, resourceTypeLabel } from "@heat/contracts";
import type { ResourcePublic, ResourcePublicListResponse } from "@heat/contracts";
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
import { DownloadIcon, ExternalLinkIcon, FolderOpenIcon } from "lucide-react";

const detailOf = (item: ResourcePublic): string => {
  const type = resourceTypeLabel(item.kind, item.mimeType);
  return item.sizeBytes === null ? type : `${type}, ${formatFileSize(item.sizeBytes)}`;
};

export function ResourcesList({ resources }: { resources: ResourcePublicListResponse }) {
  return (
    <ShellContent>
      <PageHeader title="Resources" />
      {resources.items.length === 0 ? (
        <EmptyState
          icon={FolderOpenIcon}
          title="No resources yet"
          description="Files and links will appear here when they are published."
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {resources.items.map((item) => (
            <li key={item.id}>
              <Card>
                <CardHeader>
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>{detailOf(item)}</CardDescription>
                  {item.description === null ? null : (
                    <CardDescription className="break-words">{item.description}</CardDescription>
                  )}
                  <div>
                    {item.kind === "file" ? (
                      <Button
                        variant="outline"
                        nativeButton={false}
                        render={<a href={item.url} download />}
                      >
                        <DownloadIcon data-icon="inline-start" />
                        {`Download ${item.title}`}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        nativeButton={false}
                        render={<a href={item.url} target="_blank" rel="noopener noreferrer" />}
                      >
                        <ExternalLinkIcon data-icon="inline-start" />
                        {`Open ${item.title}`}
                      </Button>
                    )}
                  </div>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </ShellContent>
  );
}
