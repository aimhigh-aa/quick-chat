import { PrismaClient } from "@prisma/client"
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma 客户端单例
 * 防止 Next.js 热更新导致多个 Prisma 实例和连接池溢出
 * 开发环境下将实例挂载到 global 对象，确保热重载时复用同一实例
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * 导出的 Prisma 客户端实例
 * 生产环境直接创建新实例，开发环境优先使用 global 上已有的实例
 */
const  connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
export const prisma = globalForPrisma.prisma ?? new PrismaClient( {adapter} )

/**
 * 开发环境下将实例保存到 global，避免热重载时重复创建连接
 * 注意：仅在非生产环境执行，防止内存泄漏
 */
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
