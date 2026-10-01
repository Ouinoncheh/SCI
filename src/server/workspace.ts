import { createHash, randomBytes } from 'node:crypto';
import { db } from './db';
import { membership, HttpError } from './security';
import { invitationSchema, sciSchema } from './validation';
export async function listScis(userId: string) {
  return db.sCIMember.findMany({
    where: { userId },
    select: {
      role: true,
      shares: true,
      sci: { select: { id: true, name: true, capital: true, taxRegime: true } },
    },
    orderBy: { joinedAt: 'asc' },
  });
}
export async function createSci(userId: string, raw: unknown) {
  const input = sciSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const sci = await tx.sCI.create({
      data: {
        name: input.name,
        capital: input.capital,
        taxRegime: input.taxRegime,
        financialSettings: {},
        investmentAssumptions: {},
        members: { create: { userId, role: 'ADMIN', shares: input.shares } },
      },
    });
    await tx.activityLog.create({
      data: {
        sciId: sci.id,
        actorId: userId,
        action: 'SCI_CREATED',
        entityId: sci.id,
        metadata: {},
      },
    });
    return sci.id;
  });
}
export async function sciDetails(userId: string, sciId: string) {
  await membership(userId, sciId);
  const sci = await db.sCI.findUniqueOrThrow({
    where: { id: sciId },
    select: {
      id: true,
      name: true,
      capital: true,
      taxRegime: true,
      members: {
        select: {
          id: true,
          role: true,
          shares: true,
          user: { select: { name: true, email: true } },
        },
      },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { id: true, action: true, createdAt: true },
      },
    },
  });
  return { ...sci, capital: Number(sci.capital) };
}
export async function createInvitation(userId: string, sciId: string, raw: unknown) {
  await membership(userId, sciId, 'admin');
  const input = invitationSchema.parse(raw);
  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await db.$transaction(async (tx) => {
    if (await tx.sCIMember.findFirst({ where: { sciId, user: { email: input.email } } }))
      throw new HttpError(409, 'Cette personne est déjà membre.');
    await tx.invitation.create({
      data: {
        sciId,
        ...input,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    await tx.activityLog.create({
      data: {
        sciId,
        actorId: userId,
        action: 'INVITATION_CREATED',
        metadata: { role: input.role },
      },
    });
  });
  // Deliberately manual sharing. The token never appears in logs or list endpoints.
  return `${process.env.BETTER_AUTH_URL}/invitation#${token}`;
}
export async function acceptInvitation(userId: string, email: string, token: string) {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  return db.$transaction(async (tx) => {
    const invitation = await tx.invitation.findFirst({
      where: {
        tokenHash,
        email: email.toLowerCase(),
        expiresAt: { gt: new Date() },
        acceptedAt: null,
      },
    });
    if (!invitation)
      throw new HttpError(404, 'Invitation invalide, expirée ou destinée à une autre adresse.');
    const claim = await tx.invitation.updateMany({
      where: { id: invitation.id, acceptedAt: null, expiresAt: { gt: new Date() } },
      data: { acceptedAt: new Date() },
    });
    if (!claim.count) throw new HttpError(409, 'Invitation déjà utilisée.');
    if (
      await tx.sCIMember.findUnique({
        where: { sciId_userId: { sciId: invitation.sciId, userId } },
      })
    )
      throw new HttpError(409, 'Vous êtes déjà membre de cette SCI.');
    await tx.sCIMember.create({
      data: { sciId: invitation.sciId, userId, role: invitation.role, shares: invitation.shares },
    });
    await tx.activityLog.create({
      data: {
        sciId: invitation.sciId,
        actorId: userId,
        action: 'MEMBER_JOINED',
        metadata: { role: invitation.role },
      },
    });
    return invitation.sciId;
  });
}
