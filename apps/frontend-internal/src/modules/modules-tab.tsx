"use client";

import {
  getModulesListQueryKey,
  isApiError,
  useModulesList,
  useModulesReorder,
} from "@heat/api-client";
import { Button, EmptyState, ErrorState, FieldDescription, Skeleton, SortableList } from "@heat/ui";
import { useQueryClient } from "@tanstack/react-query";
import { LayersIcon, PlusIcon } from "lucide-react";
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
    <div className="flex max-w-3xl flex-col gap-4">
      {locked ? <FieldDescription role="note">{moduleLockedMessage}</FieldDescription> : null}
      {problem !== null ? <FieldDescription role="alert">{problem}</FieldDescription> : null}
      {items.length === 0 ? (
        <EmptyState
          icon={LayersIcon}
          title="No modules yet"
          description="Add the first module. Students work through modules in this order."
          action={addButton}
        />
      ) : (
        <>
          <div>{addButton}</div>
          <SortableList
            aria-label="Modules in order"
            disabled={locked || reorder.isPending}
            onReorder={(orderedIds) => void saveOrder(orderedIds)}
            items={items.map((item) => ({
              id: item.id,
              label: item.title,
              content: (
                <div className="flex flex-col gap-1">
                  <Button
                    variant="link"
                    render={<Link href={`/courses/${courseId}/modules/${item.id}`} />}
                  >
                    {item.order}. {item.title}
                  </Button>
                  <FieldDescription>
                    {item.sections.length} {item.sections.length === 1 ? "section" : "sections"},{" "}
                    {item.objectives.length}{" "}
                    {item.objectives.length === 1 ? "objective" : "objectives"}
                  </FieldDescription>
                </div>
              ),
            }))}
          />
        </>
      )}
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
