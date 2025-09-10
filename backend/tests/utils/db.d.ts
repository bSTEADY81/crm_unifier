import { PrismaClient } from '@prisma/client';
declare const prisma: PrismaClient<import(".prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
export declare function resetDb(): Promise<void>;
export declare function resetTestData(): Promise<void>;
export declare function resetDbContract(): Promise<void>;
export { prisma };
//# sourceMappingURL=db.d.ts.map