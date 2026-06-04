import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

const clientOptions: any = {
    log: process.env.NODE_ENV === "development" ? ['query', 'error', 'warn'] : ['error'],
}

if (process.env.DATABASE_URL) {
    clientOptions.adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient(clientOptions)

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma