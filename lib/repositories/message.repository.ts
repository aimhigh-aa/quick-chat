import { prisma } from "@/lib/prisma";

/**
 * Message Repository
 * 纯粹的数据访问层，所有查询必须带 userId 严格隔离
 * 通过 chat.userId 关联实现用户隔离
 */

/**
 * 创建用户消息
 * @param chatId - 会话ID
 * @param userId - 用户ID（强制隔离）
 * @param content - 消息内容
 * @returns 创建的消息
 */
export async function createUserMessage(
  chatId: string,
  userId: string,
  content: string
) {
  // 验证会话所有权
  const chat = await prisma.chat.findFirst({
    where: { id: chatId, userId },
  });

  if (!chat) {
    throw new Error("会话不存在或无权限");
  }

  return prisma.message.create({
    data: {
      chatId,
      role: "user",
      content,
    },
  });
}

/**
 * 创建AI助手消息（初始占位）
 * @param chatId - 会话ID
 * @param userId - 用户ID（强制隔离）
 * @returns 创建的消息
 */
export async function createAssistantMessage(chatId: string, userId: string) {
  // 验证会话所有权
  const chat = await prisma.chat.findFirst({
    where: { id: chatId, userId },
  });

  if (!chat) {
    throw new Error("会话不存在或无权限");
  }

  return prisma.message.create({
    data: {
      chatId,
      role: "assistant",
      content: "",
    },
  });
}

/**
 * 更新AI消息内容
 * @param messageId - 消息ID
 * @param chatId - 会话ID
 * @param userId - 用户ID（强制隔离）
 * @param content - 内容
 * @param reasoningContent - 思考过程
 * @returns 更新结果
 */
export async function updateMessageContent(
  messageId: string,
  chatId: string,
  userId: string,
  content: string,
  reasoningContent?: string
) {
  // 通过 chat.userId 验证所有权
  const chat = await prisma.chat.findFirst({
    where: { id: chatId, userId },
  });

  if (!chat) {
    throw new Error("会话不存在或无权限");
  }

  return prisma.message.updateMany({
    where: {
      id: messageId,
      chatId,
    },
    data: {
      content,
      ...(reasoningContent !== undefined && { reasoningContent }),
    },
  });
}

/**
 * 标记消息为中断状态
 * @param messageId - 消息ID
 * @param chatId - 会话ID
 * @param userId - 用户ID（强制隔离）
 */
export async function markMessageAborted(
  messageId: string,
  chatId: string,
  userId: string
) {
  const chat = await prisma.chat.findFirst({
    where: { id: chatId, userId },
  });

  if (!chat) {
    throw new Error("会话不存在或无权限");
  }

  return prisma.message.updateMany({
    where: {
      id: messageId,
      chatId,
    },
    data: { isAborted: true },
  });
}

/**
 * 获取会话的所有消息
 * @param chatId - 会话ID
 * @param userId - 用户ID（强制隔离）
 * @returns 消息列表（按时间正序）
 */
export async function getMessagesByChatId(chatId: string, userId: string) {
  // 验证会话所有权
  const chat = await prisma.chat.findFirst({
    where: { id: chatId, userId },
  });

  if (!chat) {
    throw new Error("会话不存在或无权限");
  }

  return prisma.message.findMany({
    where: { chatId },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * 获取单条消息
 * @param messageId - 消息ID
 * @param chatId - 会话ID
 * @param userId - 用户ID（强制隔离）
 */
export async function getMessageById(
  messageId: string,
  chatId: string,
  userId: string
) {
  const chat = await prisma.chat.findFirst({
    where: { id: chatId, userId },
  });

  if (!chat) {
    return null;
  }

  return prisma.message.findFirst({
    where: {
      id: messageId,
      chatId,
    },
  });
}

/**
 * 删除会话的所有消息
 * @param chatId - 会话ID
 * @param userId - 用户ID（强制隔离）
 */
export async function deleteMessagesByChatId(chatId: string, userId: string) {
  const chat = await prisma.chat.findFirst({
    where: { id: chatId, userId },
  });

  if (!chat) {
    throw new Error("会话不存在或无权限");
  }

  return prisma.message.deleteMany({
    where: { chatId },
  });
}
