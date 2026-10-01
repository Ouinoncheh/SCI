import { z } from 'zod';
import { db } from './db';
import { HttpError, membership } from './security';
import { commentSchema, voteSchema } from '../collaboration/validation';
import { investmentSchema } from '../financial-engine';
import type { AnalysisHistory, CollaborationData, NotificationsData } from '../collaboration/types';
const ordered = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

async function propertyAccess(userId: string, sciId: string, propertyId: string, write = false) {
  const member = await membership(userId, sciId, write ? 'write' : 'read');
  const property = await db.property.findFirst({
    where: { id: propertyId, sciId },
    select: { id: true, title: true },
  });
  if (!property) throw new HttpError(404, 'Bien introuvable.');
  return { member, property };
}

export async function getCollaboration(
  userId: string,
  sciId: string,
  propertyId: string,
  cursor?: string,
): Promise<CollaborationData> {
  const { member } = await propertyAccess(userId, sciId, propertyId);
  if (
    cursor &&
    !(await db.comment.findFirst({
      where: { id: cursor, sciId, propertyId },
      select: { id: true },
    }))
  )
    throw new HttpError(404, 'Page introuvable.');
  const [comments, votes, members, activities] = await Promise.all([
    db.comment.findMany({
      where: { sciId, propertyId },
      orderBy: ordered,
      take: 51,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        body: true,
        createdAt: true,
        mentionedMemberIds: true,
        member: { select: { user: { select: { name: true } } } },
      },
    }),
    db.vote.findMany({
      where: { sciId, propertyId },
      orderBy: { id: 'asc' },
      select: {
        memberId: true,
        choice: true,
        member: { select: { user: { select: { name: true } } } },
      },
    }),
    db.sCIMember.findMany({
      where: { sciId },
      orderBy: { joinedAt: 'asc' },
      select: { id: true, userId: true, user: { select: { name: true } } },
    }),
    db.activityLog.findMany({
      where: { sciId, entityId: propertyId },
      orderBy: ordered,
      take: 30,
      select: { id: true, actorId: true, action: true, createdAt: true },
    }),
  ]);
  const page = comments.slice(0, 50);
  return {
    currentMemberId: member.id,
    nextCursor: comments.length > 50 ? page.at(-1)!.id : null,
    comments: page.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      author: c.member.user.name,
      mentions: c.mentionedMemberIds.map(
        (id) => members.find((m) => m.id === id)?.user.name ?? 'Ancien membre',
      ),
    })),
    votes: votes.map((v) => ({ memberId: v.memberId, name: v.member.user.name, choice: v.choice })),
    members: members.map((m) => ({ id: m.id, name: m.user.name })),
    activities: activities.map((a) => ({
      ...a,
      actor: members.find((m) => m.userId === a.actorId)?.user.name ?? null,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

export async function addComment(userId: string, sciId: string, propertyId: string, raw: unknown) {
  const { member, property } = await propertyAccess(userId, sciId, propertyId, true);
  const input = commentSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const mentions = await tx.sCIMember.findMany({
      where: { sciId, id: { in: input.mentionedMemberIds } },
      select: { id: true },
    });
    if (mentions.length !== input.mentionedMemberIds.length)
      throw new HttpError(400, 'Les mentions doivent désigner des membres de cette SCI.');
    const comment = await tx.comment.create({
      data: { sciId, propertyId, memberId: member.id, ...input },
    });
    const author = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { name: true },
    });
    const recipients = mentions.filter((m) => m.id !== member.id);
    if (recipients.length)
      await tx.notification.createMany({
        data: recipients.map((m) => ({
          sciId,
          memberId: m.id,
          body: `${author.name} vous a mentionné dans un commentaire sur « ${property.title} ».`,
        })),
      });
    await tx.activityLog.create({
      data: {
        sciId,
        actorId: userId,
        entityId: propertyId,
        action: 'COMMENT_ADDED',
        metadata: { commentId: comment.id, mentionCount: recipients.length },
      },
    });
    return comment.id;
  });
}

export async function setVote(userId: string, sciId: string, propertyId: string, raw: unknown) {
  const { member } = await propertyAccess(userId, sciId, propertyId, true);
  const { choice } = voteSchema.parse(raw);
  await db.$transaction(async (tx) => {
    if (choice === null)
      await tx.vote.deleteMany({ where: { sciId, propertyId, memberId: member.id } });
    else
      await tx.vote.upsert({
        where: { sciId_propertyId_memberId: { sciId, propertyId, memberId: member.id } },
        create: { sciId, propertyId, memberId: member.id, choice },
        update: { choice },
      });
    await tx.activityLog.create({
      data: {
        sciId,
        actorId: userId,
        entityId: propertyId,
        action: choice === null ? 'VOTE_REMOVED' : 'VOTE_CHANGED',
        metadata: { choice },
      },
    });
  });
}

const metricsSchema = z.object({
  totalCost: z.number().finite(),
  cashFlowMonthly: z.number().finite(),
  netYield: z.number().finite(),
});
export async function analysisHistory(
  userId: string,
  sciId: string,
  propertyId: string,
  cursor?: string,
): Promise<AnalysisHistory> {
  await propertyAccess(userId, sciId, propertyId);
  if (
    cursor &&
    !(await db.propertyAnalysis.findFirst({
      where: { id: cursor, sciId, propertyId },
      select: { id: true },
    }))
  )
    throw new HttpError(404, 'Page introuvable.');
  const rows = await db.propertyAnalysis.findMany({
    where: { sciId, propertyId },
    orderBy: ordered,
    take: 21,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, createdAt: true, engineVersion: true, inputs: true, results: true },
  });
  const entries = rows.slice(0, 20).map((r) => {
    const inputs = investmentSchema.safeParse(r.inputs),
      metrics = metricsSchema.safeParse(r.results);
    return {
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      engineVersion: r.engineVersion,
      inputs: inputs.success ? inputs.data : null,
      metrics: metrics.success ? metrics.data : null,
    };
  });
  return { entries, nextCursor: rows.length > 20 ? entries.at(-1)!.id : null };
}

export async function notifications(
  userId: string,
  sciId: string,
  cursor?: string,
): Promise<NotificationsData> {
  const member = await membership(userId, sciId);
  const where = { sciId, memberId: member.id };
  if (
    cursor &&
    !(await db.notification.findFirst({ where: { ...where, id: cursor }, select: { id: true } }))
  )
    throw new HttpError(404, 'Page introuvable.');
  const [rows, unread] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: ordered,
      take: 31,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, body: true, readAt: true, createdAt: true },
    }),
    db.notification.count({ where: { ...where, readAt: null } }),
  ]);
  const entries = rows
    .slice(0, 30)
    .map((r) => ({
      ...r,
      readAt: r.readAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  return { entries, unread, nextCursor: rows.length > 30 ? entries.at(-1)!.id : null };
}
export async function markRead(userId: string, sciId: string, id: string) {
  const member = await membership(userId, sciId);
  const where = { sciId, memberId: member.id, id };
  if (!(await db.notification.findFirst({ where, select: { id: true } })))
    throw new HttpError(404, 'Notification introuvable.');
  await db.notification.updateMany({
    where: { ...where, readAt: null },
    data: { readAt: new Date() },
  });
}
