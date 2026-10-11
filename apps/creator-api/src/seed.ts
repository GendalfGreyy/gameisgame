import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { parseProjectDocument, serializeProjectDocument } from '@tg-creator/project-schema';
import { devAuthRequestSchema } from '@tg-creator/shared';

import { Prisma, PrismaClient } from '../generated/client/index.js';

/** Fixed id so re-running the seed updates the same project instead of adding copies. */
const SEED_PROJECT_ID = '00000000-0000-4000-8000-000000000003';
const EXAMPLE_PATH = fileURLToPath(
  new URL('../../../tg-creator-studio/examples/project-3d.v2.json', import.meta.url),
);

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('db:seed is development-only');
  }
  const url = process.env.CREATOR_DATABASE_URL;
  if (!url) {
    throw new Error('CREATOR_DATABASE_URL is required');
  }
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const dev = devAuthRequestSchema.parse({});
    const user = await prisma.user.upsert({
      where: { telegramId: BigInt(dev.telegramId) },
      update: {},
      create: {
        telegramId: BigInt(dev.telegramId),
        firstName: dev.firstName,
        username: dev.username,
        languageCode: 'ru',
      },
    });

    const example: unknown = JSON.parse(await readFile(EXAMPLE_PATH, 'utf8'));
    const parsed = parseProjectDocument(example);
    if (!parsed.ok) {
      throw new Error(`Example project is invalid: ${parsed.code}`);
    }
    const document = { ...parsed.document, id: SEED_PROJECT_ID, ownerId: user.id };
    const json = JSON.parse(serializeProjectDocument(document)) as Prisma.InputJsonValue;

    await prisma.project.upsert({
      where: { id: SEED_PROJECT_ID },
      update: {
        document: json,
        title: document.title,
        deletedAt: null,
        revision: { increment: 1 },
      },
      create: {
        id: SEED_PROJECT_ID,
        ownerId: user.id,
        title: document.title,
        type: document.type,
        document: json,
      },
    });
    console.log(`Seeded "${document.title}" (${SEED_PROJECT_ID}) for dev user ${dev.telegramId}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
