"use client";

import {
  getQuizGetQueryKey,
  isApiError,
  useQuizGet,
  useQuizRemoveQuestion,
  useQuizReorderQuestions,
} from "@heat/api-client";
import type { QuizSummaryDto } from "@heat/api-client";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FieldDescription,
  FieldTitle,
  Skeleton,
  SortableList,
} from "@heat/ui";
import { useQueryClient } from "@tanstack/react-query";
import { CircleHelpIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { FormSheet } from "./form-sheet";
import { reorderFailedMessage } from "./modules-copy";
import { QuestionForm } from "./question-form";
import { questionDeleteFailedMessage, quizLockedMessage } from "./quiz-copy";
import { QuizRulesForm } from "./quiz-rules-form";

type QuizQuestion = QuizSummaryDto["questions"][number];

type EditingQuestion = QuizQuestion | "new" | null;

type QuizPanelProps = {
  courseId: string;
  moduleId: string;
  courseLocked: boolean;
};

export function QuizPanel({ courseId, moduleId, courseLocked }: QuizPanelProps) {
  const queryClient = useQueryClient();
  const quiz = useQuizGet(courseId, moduleId);
  const reorder = useQuizReorderQuestions();
  const remove = useQuizRemoveQuestion();
  const [editing, setEditing] = useState<EditingQuestion>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const quizKey = getQuizGetQueryKey(courseId, moduleId);

  if (quiz.isPending) return <Skeleton className="h-40 w-full" />;
  if (quiz.isError) {
    return <ErrorState title="The quiz could not be loaded" onRetry={() => void quiz.refetch()} />;
  }

  const locked = courseLocked || quiz.data.locked;
  const questions = quiz.data.questions;

  const refresh = (saved: QuizSummaryDto) => {
    queryClient.setQueryData(quizKey, saved);
  };

  async function saveOrder(orderedIds: string[]) {
    setProblem(null);
    try {
      refresh(
        await reorder.mutateAsync({
          id: courseId,
          moduleId,
          data: { previousIds: questions.map((question) => question.id), orderedIds },
        }),
      );
    } catch (error) {
      setProblem(reorderFailedMessage(isApiError(error) ? error.code : undefined));
      await queryClient.invalidateQueries({ queryKey: quizKey });
    }
  }

  const addButton = (
    <Button disabled={locked} onClick={() => setEditing("new")}>
      <PlusIcon data-icon="inline-start" />
      Add question
    </Button>
  );

  return (
    <div className="flex flex-col gap-8">
      {locked ? <FieldDescription role="note">{quizLockedMessage}</FieldDescription> : null}
      <div className="flex flex-col gap-4">
        <FieldTitle>Quiz rules</FieldTitle>
        <QuizRulesForm
          courseId={courseId}
          moduleId={moduleId}
          rules={quiz.data.rules}
          locked={locked}
          onSaved={refresh}
        />
      </div>
      <div className="flex flex-col gap-4">
        <FieldTitle>Questions</FieldTitle>
        {problem !== null ? <FieldDescription role="alert">{problem}</FieldDescription> : null}
        {questions.length === 0 ? (
          <EmptyState
            icon={CircleHelpIcon}
            title="No questions yet"
            description="Add a single-choice question with two to six options."
            action={addButton}
          />
        ) : (
          <>
            <div>{addButton}</div>
            <SortableList
              aria-label="Questions in order"
              disabled={locked || reorder.isPending}
              onReorder={(orderedIds) => void saveOrder(orderedIds)}
              items={questions.map((question) => ({
                id: question.id,
                label: question.text,
                content: (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mr-auto">
                      {question.order}. {question.text}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(question)}
                    >
                      <PencilIcon data-icon="inline-start" />
                      Edit
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button type="button" variant="outline" size="sm" disabled={locked}>
                          <Trash2Icon data-icon="inline-start" />
                          Remove
                        </Button>
                      }
                      title="Remove this question?"
                      itemName={question.text}
                      description="The question and its options are removed from the quiz."
                      confirmLabel="Remove question"
                      destructive
                      errorMessage={questionDeleteFailedMessage(question.text)}
                      onConfirm={async () => {
                        refresh(
                          await remove.mutateAsync({
                            id: courseId,
                            moduleId,
                            questionId: question.id,
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
      </div>
      <FormSheet
        open={editing !== null}
        title={editing === "new" ? "Add a question" : "Edit the question"}
        description="A single-choice question has two to six options and one correct answer."
        onClose={() => setEditing(null)}
      >
        {({ onDirtyChange, requestClose, close }) => (
          <QuestionForm
            courseId={courseId}
            moduleId={moduleId}
            question={editing === "new" ? null : editing}
            locked={locked}
            onDirtyChange={onDirtyChange}
            onCancel={requestClose}
            onSaved={(saved) => {
              refresh(saved);
              close();
            }}
          />
        )}
      </FormSheet>
    </div>
  );
}
