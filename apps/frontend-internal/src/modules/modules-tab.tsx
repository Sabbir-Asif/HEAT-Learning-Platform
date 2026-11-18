"use client";

import {
  getModulesListQueryKey,
  isApiError,
  useModulesList,
  useModulesReorder,
} from "@heat/api-client";
import {
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  FieldDescription,
  Skeleton,
  SortableList,
} from "@heat/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRightIcon, LayersIcon, ListChecksIcon, PlusIcon, TargetIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { FormSheet } from "./form-sheet";
import { ModuleForm } from "./module-form";
import { moduleLockedMessage, reorderFailedMessage } from "./modules-copy";

export function ModulesTab({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const list = useModulesList(courseId);
  const reorder = useModulesReorder();
  const [adding, setAdding] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const queryKey = getModulesListQueryKey(courseId);

  if (list.isPending) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (list.isError) {
    return (
      <ErrorState title="The modules could not be loaded" onRetry={() => void list.refetch()} />
    );
  }

  const { items, locked } = list.data;

  async function saveOrder(orderedIds: string[]) {
    setProblem(null);
    try {
      const saved = await reorder.mutateAsync({
        id: courseId,
        data: { previousIds: items.map((item) => item.id), orderedIds },
      });
      queryClient.setQueryData(queryKey, saved);
    } catch (error) {
      setProblem(reorderFailedMessage(isApiError(error) ? error.code : undefined));
      await queryClient.invalidateQueries({ queryKey });
    }
  }

  const addButton = (
    <Button disabled={locked} onClick={() => setAdding(true)}>
      <PlusIcon data-icon="inline-start" />
      Add module
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      {locked ? <FieldDescription role="note">{moduleLockedMessage}</FieldDescription> : null}
      {problem !== null ? <FieldDescription role="alert">{problem}</FieldDescription> : null}
      <Card>
        <CardHeader>
          <CardTitle>
            {items.length} {items.length === 1 ? "module" : "modules"}
          </CardTitle>
          <CardDescription>
            Students work through modules in this order. Drag a module to reorder it.
          </CardDescription>
          {items.length === 0 ? null : <CardAction>{addButton}</CardAction>}
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState
              icon={LayersIcon}
              title="No modules yet"
              description="Add the first module. Students work through modules in this order."
              action={addButton}
            />
          ) : (
            <SortableList
              aria-label="Modules in order"
              disabled={locked || reorder.isPending}
              onReorder={(orderedIds) => void saveOrder(orderedIds)}
              items={items.map((item) => ({
                id: item.id,
                label: item.title,
                content: (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <Button
                        variant="link"
                        className="justify-start"
                        render={<Link href={`/courses/${courseId}/modules/${item.id}`} />}
                      >
                        {item.order}. {item.title}
                      </Button>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="flex items-center gap-1.5">
                          <ListChecksIcon aria-hidden="true" className="size-4" />
                          <FieldDescription>
                            {item.sections.length}{" "}
                            {item.sections.length === 1 ? "section" : "sections"}
                          </FieldDescription>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <TargetIcon aria-hidden="true" className="size-4" />
                          <FieldDescription>
                            {item.objectives.length}{" "}
                            {item.objectives.length === 1 ? "objective" : "objectives"}
                          </FieldDescription>
                        </span>
                      </div>
                    </div>
                    <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0" />
                  </div>
                ),
              }))}
            />
          )}
        </CardContent>
      </Card>
      <FormSheet
        open={adding}
        title="Add a module"
        description="The module is added at the end. Reorder it afterwards."
        onClose={() => setAdding(false)}
      >
        {({ onDirtyChange, requestClose, close }) => (
          <ModuleForm
            courseId={courseId}
            module={null}
            locked={false}
            onDirtyChange={onDirtyChange}
            onCancel={requestClose}
            onSaved={async () => {
              await queryClient.invalidateQueries({ queryKey });
              close();
            }}
          />
        )}
      </FormSheet>
    </div>
  );
}
