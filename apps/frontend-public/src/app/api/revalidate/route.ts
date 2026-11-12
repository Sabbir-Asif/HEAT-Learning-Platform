import { revalidateRequestSchema, revalidateSecretHeader } from "@heat/contracts";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { decideRevalidation } from "@/revalidate/revalidate-auth";

export async function POST(request: Request) {
  const decision = decideRevalidation({
    expectedSecret: process.env.REVALIDATE_SECRET,
    providedSecret: request.headers.get(revalidateSecretHeader),
    headers: request.headers,
  });
  if (decision.kind === "refused") {
    return NextResponse.json({ revalidated: 0 }, { status: decision.status });
  }
  const body: unknown = await request.json().catch(() => null);
  const parsed = revalidateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ revalidated: 0 }, { status: 400 });
  }
  const tags = [...new Set(parsed.data.tags)];
  for (const tag of tags) revalidateTag(tag, "max");
  return NextResponse.json({ revalidated: tags.length });
}
