"use client";

import {
  getAdminUsersListQueryKey,
  useAdminUsersDeactivate,
  useAdminUsersList,
  useAdminUsersReactivate,
  useAdminUsersResendInvitation,
} from "@heat/api-client";
import type { AdminListResponseDtoItemsItem } from "@heat/api-client";
import { adminSortFields } from "@heat/contracts";
import { Badge, Button, ConfirmDialog, FieldDescription, PageHeader } from "@heat/ui";
import { DataTable, useClampedPage, useTableUrlState } from "@heat/ui/data";
import type { DataTableColumn } from "@heat/ui/data";
import { ShellContent } from "@heat/ui/shell";
import { useQueryClient } from "@tanstack/react-query";
import { RotateCcwIcon, SendIcon, UserMinusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { adminStatusLabels, adminStatusVariants, formatDhakaTime } from "./admin-copy";
import { InviteAdminSheet } from "./invite-admin-sheet";

type AdminRow = AdminListResponseDtoItemsItem;

const sortable = ["email", "createdAt"] as const;
const sortValues: readonly string[] = adminSortFields;

export function AdminsView({ currentUserId }: { currentUserId: string }) {
  const queryClient = useQueryClient();
  const url = useTableUrlState({ sortable });
  const [notice, setNotice] = useState<string | null>(null);
  const sortValue = url.sort ? `${url.sort.desc ? "-" : ""}${url.sort.id}` : undefined;
  const params = {
    page: url.page,
    pageSize: url.pageSize,
    ...(sortValue !== undefined && sortValues.includes(sortValue)
      ? { sort: sortValue as (typeof adminSortFields)[number] }
      : {}),
  };
  const list = useAdminUsersList(params);
  const deactivate = useAdminUsersDeactivate();
  const reactivate = useAdminUsersReactivate();
  const resend = useAdminUsersResendInvitation();
  const total = list.data?.total ?? 0;
  const page = useClampedPage(url.page, url.pageSize, total, url.setPage);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: getAdminUsersListQueryKey().slice(0, 1) });

  const columns = useMemo<DataTableColumn<AdminRow>[]>(
    () => [
      { id: "email", header: "Email", cell: (row) => row.email, sortable: true },
      {
        id: "role",
        header: "Role",
        cell: (row) => (row.role === "SUPER_ADMIN" ? "Super admin" : "Admin"),
      },
      {
        id: "status",
        header: "Status",
        cell: (row) => (
          <Badge variant={adminStatusVariants[row.status]}>{adminStatusLabels[row.status]}</Badge>
        ),
      },
      {
        id: "createdAt",
        header: "Added",
        cell: (row) => formatDhakaTime(row.createdAt),
        sortable: true,
      },
      {
        id: "detail",
        header: "Detail",
        cell: (row) =>
          row.status === "INVITED" || row.status === "INVITE_EXPIRED"
            ? `${row.status === "INVITED" ? "Link expires" : "Link expired"} ${formatDhakaTime(row.inviteExpiresAt ?? row.createdAt)}`
            : row.deactivatedAt !== null
              ? `Deactivated ${formatDhakaTime(row.deactivatedAt)}`
              : "",
      },
    ],
    [],
  );

  async function resendInvitation(row: AdminRow) {
    setNotice(null);
    try {
      await resend.mutateAsync({ id: row.id });
      await refresh();
      setNotice(`A new invitation was sent to ${row.email}.`);
    } catch {
      setNotice(`The invitation to ${row.email} could not be sent. Try again.`);
    }
  }

  function actions(row: AdminRow) {
    if (row.role !== "ADMIN") return null;
    if (row.status === "DEACTIVATED") {
      return (
        <Button
          variant="outline"
          size="sm"
          disabled={reactivate.isPending}
          onClick={async () => {
            setNotice(null);
            try {
              await reactivate.mutateAsync({ id: row.id });
              await refresh();
              setNotice(`${row.email} can sign in again.`);
            } catch {
              setNotice(`${row.email} could not be reactivated. Try again.`);
            }
          }}
        >
          <RotateCcwIcon data-icon="inline-start" />
          Reactivate
        </Button>
      );
    }
    return (
      <>
        {row.status === "INVITED" || row.status === "INVITE_EXPIRED" ? (
          <Button
            variant="outline"
            size="sm"
            disabled={resend.isPending}
            onClick={() => resendInvitation(row)}
          >
            <SendIcon data-icon="inline-start" />
            Resend invitation
          </Button>
        ) : null}
        {row.id === currentUserId ? null : (
          <ConfirmDialog
            trigger={
              <Button variant="outline" size="sm">
                <UserMinusIcon data-icon="inline-start" />
                Deactivate
              </Button>
            }
            title="Deactivate this admin?"
            itemName={row.email}
            description="They are signed out everywhere at once and cannot sign in until you reactivate them."
            confirmLabel="Deactivate"
            destructive
            onConfirm={async () => {
              await deactivate.mutateAsync({ id: row.id });
              await refresh();
              setNotice(`${row.email} was deactivated and signed out.`);
            }}
          />
        )}
      </>
    );
  }

  return (
    <ShellContent>
      <PageHeader
        title="Admins"
        action={
          <InviteAdminSheet
            onInvited={(email) => setNotice(`An invitation was sent to ${email}.`)}
          />
        }
      />
      {notice !== null ? <FieldDescription role="status">{notice}</FieldDescription> : null}
      <DataTable
        label="Admins"
        columns={columns}
        rows={list.data?.items ?? []}
        getRowId={(row) => row.id}
        total={total}
        page={page}
        pageSize={url.pageSize}
        sort={url.sort}
        onToggleSort={url.toggleSort}
        onSortChange={url.setSort}
        onPageChange={url.setPage}
        onPageSizeChange={url.setPageSize}
        status={list.isError ? "error" : list.isPending ? "loading" : "ready"}
        fetching={list.isFetching && !list.isPending}
        onRetry={() => void list.refetch()}
        emptyTitle="No admins yet"
        emptyDescription="Invite an admin to give them access to this console."
        actions={actions}
      />
    </ShellContent>
  );
}
