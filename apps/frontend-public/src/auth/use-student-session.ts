"use client";

import {
  getMeDescribeQueryKey,
  isApiError,
  meDescribe,
  studentAuthRefresh,
} from "@heat/api-client";
import type { MeResponse } from "@heat/contracts";
import { useQuery } from "@tanstack/react-query";

const isUnauthorized = (error: unknown): boolean => isApiError(error) && error.status === 401;

export async function readStudentSession(): Promise<MeResponse | null> {
  try {
    return await meDescribe();
  } catch (error) {
    if (!isUnauthorized(error)) throw error;
  }
  try {
    await studentAuthRefresh();
    return await meDescribe();
  } catch (error) {
    if (isUnauthorized(error)) return null;
    throw error;
  }
}

export type StudentSessionState =
  { kind: "loading" } | { kind: "anonymous" } | { kind: "signed-in"; session: MeResponse };

export function useStudentSession(): StudentSessionState {
  const query = useQuery({
    queryKey: getMeDescribeQueryKey(),
    queryFn: readStudentSession,
    staleTime: 30_000,
  });
  if (query.isPending) return { kind: "loading" };
  if (query.data === undefined || query.data === null) return { kind: "anonymous" };
  return { kind: "signed-in", session: query.data };
}
