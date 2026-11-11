"use client";

import {
  getModulesGetQueryKey,
  getModulesListQueryKey,
  isApiError,
  useLessonSectionsRemove,
  useLessonSectionsReorder,
} from "@heat/api-client";
import type { ModuleSummaryDto } from "@heat/api-client";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  FieldDescription,
  FieldTitle,
  SortableList,
} from "@heat/ui";
import { useQueryClient } from "@tanstack/react-query";
import { FileTextIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { FormSheet } from "./form-sheet";
import { reorderFailedMessage, sectionDeleteFailedMessage } from "./modules-copy";
import { SectionForm } from "./section-form";

type EditingSection = { id: string; title: string } | "new" | null;

type SectionsPanelProps = {
  courseId: string;
  module: ModuleSummaryDto;
  locked: boolean;
};

export function SectionsPanel({ courseId, module, locked }: SectionsPanelProps) {
  const queryClient = useQueryClient();
  const reorder = useLessonSectionsReorder();
  const remove = useLessonSectionsRemove();
  const [editing, setEditing] = useState<EditingSection>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const detailKey = getModulesGetQueryKey(courseId, module.id);

  const refresh = (saved: ModuleSummaryDto) => {
    queryClient.setQueryData(detailKey, saved);
    return queryClient.invalidateQueries({ queryKey: getModulesListQueryKey(courseId) });
  };

  async function saveOrder(orderedIds: string[]) {
    setProblem(null);
    try {
      await refresh(
        await reorder.mutateAsync({
          id: courseId,
          moduleId: module.id,
          data: { previousIds: module.sections.map((section) => section.id), orderedIds },
        }),
      );
    } catch (error) {
      setProblem(reorderFailedMessage(isApiError(error) ? error.code : undefined));
      await queryClient.invalidateQueries({ queryKey: detailKey });
    }
  }

  const addButton = (
    <Button disabled={locked} onClick={() => setEditing("new")}>
      <PlusIcon data-icon="inline-start" />
      Add section
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <FieldTitle>Lesson sections</FieldTitle>
      {problem !== null ? <FieldDescription role="alert">{problem}</FieldDescription> : null}
      {module.sections.length === 0 ? (
        <EmptyState
          icon={FileTextIcon}
          title="No sections yet"
          description="Sections hold the written lesson for this module."
          action={addButton}
        />
      ) : (
        <>
          <div>{addButton}</div>
          <SortableList
            aria-label="Lesson sections in order"
            disabled={locked || reorder.isPending}
            onReorder={(orderedIds) => void saveOrder(orderedIds)}
            items={module.sections.map((section) => ({
              id: section.id,
              label: section.title,
              content: (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto">
                    {section.order}. {section.title}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing({ id: section.id, title: section.title })}
                  >
                    <PencilIcon data-icon="inline-start" />
                    Rename
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button type="button" variant="outline" size="sm" disabled={locked}>
                        <Trash2Icon data-icon="inline-start" />
                        Remove
                      </Button>
                    }
                    title="Remove this section?"
                    itemName={section.title}
                    description="The section is removed from the module. This cannot be undone."
                    confirmLabel="Remove section"
                    destructive
                    errorMessage={sectionDeleteFailedMessage(section.title)}
                    onConfirm={async () => {
                      await refresh(
                        await remove.mutateAsync({
                          id: courseId,
                          moduleId: module.id,
                          sectionId: section.id,
                        }),
                      );
                    }}
                  />
                </div>
              ),
            }))}
          />
        </>
      )}
      <FormSheet
        open={editing !== null}
        title={editing === "new" ? "Add a section" : "Rename the section"}
        description="The written content is added with the lesson editor later."
        onClose={() => setEditing(null)}
      >
        {({ onDirtyChange, requestClose, close }) => (
          <SectionForm
            courseId={courseId}
            moduleId={module.id}
            section={editing === "new" ? null : editing}
            onDirtyChange={onDirtyChange}
            onCancel={requestClose}
            onSaved={async (saved) => {
              await refresh(saved);
              close();
            }}
          />
        )}
      </FormSheet>
    </div>
  );
}
