import { PrismaClient, type PropertyStatus } from '@prisma/client';
import { properties } from '../src/data/demo';
const prisma = new PrismaClient();
async function main() {
  await prisma.$transaction(async (tx) => {
    await tx.sCI.upsert({
      where: { id: 'demo-sci' },
      update: {},
      create: {
        id: 'demo-sci',
        name: 'SCI Les Horizons (fictive)',
        capital: 10000,
        taxRegime: 'SCI_IR',
        financialSettings: { demo: true },
        investmentAssumptions: { demo: true },
      },
    });
    for (const [index, name] of ['Camille', 'Thomas', 'Louise'].entries()) {
      const user = await tx.user.upsert({
        where: { email: `${name.toLowerCase()}@example.invalid` },
        update: {},
        create: { email: `${name.toLowerCase()}@example.invalid`, name: `${name} (fictif)` },
      });
      await tx.sCIMember.upsert({
        where: { sciId_userId: { sciId: 'demo-sci', userId: user.id } },
        update: {},
        create: {
          sciId: 'demo-sci',
          userId: user.id,
          role: index === 0 ? 'ADMIN' : 'MEMBER',
          shares: index === 0 ? 40 : 30,
        },
      });
    }
    for (const p of properties) {
      await tx.property.upsert({
        where: { id: p.id },
        update: {},
        create: {
          id: p.id,
          sciId: 'demo-sci',
          title: p.title,
          city: p.city,
          postcode: p.postcode,
          type: 'APARTMENT',
          price: p.investment.price,
          area: p.investment.area,
          rooms: p.rooms,
          dpe: p.dpe,
          description: p.description,
          status: p.status as PropertyStatus,
          analyses: {
            create: { engineVersion: '0.1.0', inputs: p.investment, results: { pending: true } },
          },
        },
      });
    }
  });
}
main().finally(() => prisma.$disconnect());
