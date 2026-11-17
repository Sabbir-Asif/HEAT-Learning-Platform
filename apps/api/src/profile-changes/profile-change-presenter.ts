import type { AdminProfileChangeItem, ProfileChangeRequestSummary } from "@heat/contracts";

const departmentSelect = {
  id: true,
  name: true,
  universityFaculty: {
    select: {
      university: { select: { id: true, name: true } },
      faculty: { select: { id: true, name: true } },
    },
  },
} as const;

export const requestSelect = {
  id: true,
  status: true,
  requestedName: true,
  requestedSession: true,
  note: true,
  reason: true,
  createdAt: true,
  decidedAt: true,
  requestedDepartment: { select: departmentSelect },
} as const;

export const adminRequestSelect = {
  ...requestSelect,
  user: {
    select: {
      id: true,
      email: true,
      profile: {
        select: { id: true, name: true, session: true, department: { select: departmentSelect } },
      },
    },
  },
} as const;

type Department = {
  id: string;
  name: string;
  universityFaculty: {
    university: { id: string; name: string };
    faculty: { id: string; name: string };
  };
};

export interface RequestRow {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedName: string | null;
  requestedSession: string | null;
  note: string | null;
  reason: string | null;
  createdAt: Date;
  decidedAt: Date | null;
  requestedDepartment: Department | null;
}

export interface AdminRequestRow extends RequestRow {
  user: {
    id: string;
    email: string;
    profile: { id: string; name: string; session: string; department: Department } | null;
  };
}

export const presentRequest = (row: RequestRow): ProfileChangeRequestSummary => ({
  id: row.id,
  status: row.status,
  requested: {
    name: row.requestedName,
    university: row.requestedDepartment?.universityFaculty.university ?? null,
    faculty: row.requestedDepartment?.universityFaculty.faculty ?? null,
    department:
      row.requestedDepartment === null
        ? null
        : { id: row.requestedDepartment.id, name: row.requestedDepartment.name },
    session: row.requestedSession,
  },
  note: row.note,
  reason: row.reason,
  createdAt: row.createdAt.toISOString(),
  decidedAt: row.decidedAt?.toISOString() ?? null,
});

export const presentAdminRequest = (row: AdminRequestRow): AdminProfileChangeItem | null => {
  const profile = row.user.profile;
  if (profile === null) return null;
  const { university, faculty } = profile.department.universityFaculty;
  return {
    ...presentRequest(row),
    student: { name: profile.name, email: row.user.email },
    current: {
      name: profile.name,
      university,
      faculty,
      department: { id: profile.department.id, name: profile.department.name },
      session: profile.session,
    },
  };
};
