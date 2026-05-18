/**
 * POST /api/articles — create a draft article from a brief.
 * GET  /api/articles  — list articles (newest first).
 */

import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { withGuardrails, guardInput } from "@/lib/security";
import { articleBriefSchema, slugify } from "@/lib/types/article";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function postHandler(req: NextRequest): Promise<Response> {
  if (!env.database.ready) {
    return NextResponse.json(
      { error: "DATABASE_URL n'est pas configurée." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const parsed = articleBriefSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Brief invalide.", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const brief = parsed.data;

  const blocked = await guardInput(`${brief.title}\n${brief.angle}\n${brief.audience}`);
  if (blocked) return blocked;

  const slug = await uniqueSlug(brief.title);

  const article = await db.article.create({
    data: {
      title: brief.title,
      slug,
      brief: brief as unknown as Prisma.InputJsonValue,
      selectedSourceIds: brief.selectedSourceIds,
      status: "DRAFT",
    },
  });

  return NextResponse.json(
    { id: article.id, slug: article.slug, title: article.title },
    { status: 201 },
  );
}

async function getHandler(_req: NextRequest): Promise<Response> {
  if (!env.database.ready) {
    return NextResponse.json({ articles: [] }, { status: 200 });
  }
  const articles = await db.article.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      updatedAt: true,
      createdAt: true,
    },
    take: 50,
  });
  return NextResponse.json({ articles });
}

async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title) || "article";
  let candidate = base;
  let suffix = 1;
  while (await db.article.findUnique({ where: { slug: candidate } })) {
    suffix++;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

export const POST = withGuardrails(postHandler);
export const GET = withGuardrails(getHandler);
