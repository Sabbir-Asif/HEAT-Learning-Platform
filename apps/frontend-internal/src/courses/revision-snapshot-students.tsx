"use client";

import type { RevisionSnapshotResponseDto } from "@heat/api-client";
import {
  Button,
  EmptyState,
  FieldDescription,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@heat/ui";
import { UsersIcon } from "lucide-react";
import Link from "next/link";
import { studentBadgeStatus, studentProfileHref } from "../students/student-copy";
import { revisionStudentsOverflow } from "./revisions-copy";

type Students = RevisionSnapshotResponseDto["students"];

export function RevisionSnapshotStudents({ students }: { students: Students }) {
  if (students.items.length === 0) {
    return (
      <EmptyState
        icon={UsersIcon}
        title="No students on this revision"
        description="Students appear here once they are enrolled on this revision."
      />
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.items.map((student) => (
            <TableRow key={student.enrollmentId}>
              <TableCell>
                <Button variant="link" render={<Link href={studentProfileHref(student.userId)} />}>
                  {student.name}
                </Button>
              </TableCell>
              <TableCell>{student.email}</TableCell>
              <TableCell>
                <StatusBadge kind="enrollment" status={studentBadgeStatus(student.status)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {students.total > students.items.length ? (
        <FieldDescription>
          {revisionStudentsOverflow(students.items.length, students.total)}
        </FieldDescription>
      ) : null}
    </div>
  );
}
