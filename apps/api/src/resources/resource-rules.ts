import type { ResourceAdminListQuery } from "@heat/contracts";

export const resourceEntity = "Resource";

export const statusWhere = (status: ResourceAdminListQuery["status"]) => {
  if (status === "published") return { published: true };
  if (status === "unpublished") return { published: false };
  return {};
};

export const orderBy = (sort: ResourceAdminListQuery["sort"]) => {
  switch (sort) {
    case "title":
      return { title: "asc" as const };
    case "-title":
      return { title: "desc" as const };
    case "-displayOrder":
      return { displayOrder: "desc" as const };
    case "updatedAt":
      return { updatedAt: "asc" as const };
    case "-updatedAt":
      return { updatedAt: "desc" as const };
    default:
      return { displayOrder: "asc" as const };
  }
};

export const publicWhere = {
  deletedAt: null,
  published: true,
  OR: [
    { kind: "LINK" as const },
    {
      kind: "FILE" as const,
      mediaAsset: { is: { deletedAt: null, visibility: "PUBLIC" as const } },
    },
  ],
};
