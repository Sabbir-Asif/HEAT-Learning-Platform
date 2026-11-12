"use client";

import { getLearningStructureQueryKey, useQuizSubmissionSubmit } from "@heat/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { createQuizSubmit } from "./quiz-submit";
import type { SubmitQuiz } from "./quiz-submit";

export const useQuizSubmit = (courseId: string, moduleId: string): SubmitQuiz => {
  const queryClient = useQueryClient();
  const { mutateAsync } = useQuizSubmissionSubmit();
  return useMemo(
    () =>
      createQuizSubmit({
        send: (request) => mutateAsync({ courseId, moduleId, data: request }),
        onSubmitted: () => {
          void queryClient.invalidateQueries({ queryKey: getLearningStructureQueryKey(courseId) });
        },
      }),
    [courseId, moduleId, mutateAsync, queryClient],
  );
};
