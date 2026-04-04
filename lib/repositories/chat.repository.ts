import { prisma } from "@/lib/prisma";

/**
 * Chat Repository
 * 纯粹的数据访问层，所有查询必须带 userId 严格隔离
 * 不包含任何业务逻辑，只负责数据库 CRUD
 */

/**
 * 创建新会话
 * @param userId - 用户ID（强制隔离）
 * @param title - 会话标题
 * @returns 创建的会话
 */
export async function createChat(userId: string, title: string) {
  return prisma.chat.create({
    data: {
      userId,
      title,
    },
  });
}

/**
 * 获取用户的所有会话
 * @param userId - 用户ID（强制隔离）
 * @returns 会话列表（按时间倒序）
 */
export async function getChatsByUserId(userId: string) {
  return prisma.chat.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * 根据ID获取会话
 * @param chatId - 会话ID
 * @param userId - 用户ID（强制隔离）
 * @returns 会话或null
 */
export async function getChatById(chatId: string, userId: string) {
  return prisma.chat.findFirst({
    where: {
      id: chatId,
      userId, // 严格隔离：只能访问自己的会话
    },
  });
}

/**
 * 更新会话标题
 * @param chatId - 会话ID
 * @param userId - 用户ID（强制隔离）
 * @param title - 新标题
 * @returns 更新后的会话
 */
export async function updateChatTitle(
  chatId: string,
  userId: string,
  title: string
) {
  return prisma.chat.updateMany({
    where: {
      id: chatId,
      userId, // 严格隔离
    },
    data: { title },
  });
}

/**
 * 删除会话及其所有消息
 * @param chatId - 会话ID
 * @param userId - 用户ID（强制隔离）
 * @returns 删除结果
 */
export async function deleteChat(chatId: string, userId: string) {
  // 先验证所有权
  const chat = await getChatById(chatId, userId);
  if (!chat) {
    throw new Error("会话不存在或无权限");
  }

  return prisma.chat.delete({
    where: { id: chatId },
  });
}

/**
 * 更新会话更新时间（用于排序）
 * @param chatId - 会话ID
 * @param userId - 用户ID（强制隔离）
 */
export async function touchChat(chatId: string, userId: string) {
  return prisma.chat.updateMany({
    where: {
      id: chatId,
      userId,
    },
    data: { updatedAt: new Date() },
  });
}

/**
 * 获取会话的消息数量
 * @param chatId - 会话ID
 * @param userId - 用户ID（强制隔离）
 * @returns 消息数量
 */
export async function getChatMessageCount(chatId: string, userId: string) {
  const chat = await getChatById(chatId, userId);
  if (!chat) {
    throw new Error("会话不存在或无权限");
  }

  return prisma.message.count({
    where: { chatId },
  });
}
