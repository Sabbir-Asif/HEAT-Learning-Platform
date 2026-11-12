"use client";

import { fetchResponse, getProfileDescribeQueryKey, isApiError } from "@heat/api-client";
import type { ProfileResponseDto } from "@heat/api-client";
import { Avatar, FieldDescription, FieldTitle } from "@heat/ui";
import { FileUpload } from "@heat/ui/upload";
import type { UploadItemState } from "@heat/ui/upload";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { avatarUploadFailedMessage } from "./profile-copy";

interface AvatarSectionProps {
  profile: ProfileResponseDto;
}

const codeFromBody = async (response: Response): Promise<string | undefined> => {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "code" in body) {
      return typeof body.code === "string" ? body.code : undefined;
    }
  } catch {
    return undefined;
  }
  return undefined;
};

export function AvatarSection({ profile }: AvatarSectionProps) {
  const queryClient = useQueryClient();
  const [statuses, setStatuses] = useState<Record<string, UploadItemState>>({});
  const [files, setFiles] = useState<Record<string, File>>({});

  function fail(id: string, code: string | undefined) {
    setStatuses((current) => ({
      ...current,
      [id]: { status: "failed", message: avatarUploadFailedMessage(code) },
    }));
  }

  async function send(id: string, file: File) {
    setStatuses((current) => ({ ...current, [id]: { status: "uploading", progress: 0 } }));
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetchResponse("/me/profile/avatar", { method: "PUT", body });
      if (!response.ok) {
        fail(id, await codeFromBody(response));
        return;
      }
      setStatuses((current) => ({ ...current, [id]: { status: "done" } }));
      await queryClient.invalidateQueries({ queryKey: getProfileDescribeQueryKey() });
    } catch (error) {
      fail(id, isApiError(error) ? error.code : undefined);
    }
  }

  return (
    <section aria-labelledby="profile-picture" className="flex flex-col gap-3">
      <FieldTitle id="profile-picture">Profile picture</FieldTitle>
      <Avatar src={profile.avatarUrl} name={profile.name} />
      <FieldDescription>
        Only you and the course team can see your picture. Uploading a new one replaces the current
        picture. It is cropped to a square.
      </FieldDescription>
      <FileUpload
        label="Profile picture"
        preset="avatar"
        statuses={statuses}
        onFilesAccepted={(accepted) => {
          for (const item of accepted) {
            setFiles((current) => ({ ...current, [item.id]: item.file }));
            void send(item.id, item.file);
          }
        }}
        onCancel={() => undefined}
        onRetry={(id) => {
          const file = files[id];
          if (file !== undefined) void send(id, file);
        }}
      />
    </section>
  );
}
