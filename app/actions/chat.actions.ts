"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/auth";
import {
  createChatService,
  getUserChatsService,
  getChatDetailService,
  updateChatTitleService,
  deleteChatService,
  createUserMessageService,
  saveAssistantMessageService,
  abortMessageService,
  generateChatTitleService,
} from "@/server/services";

/**
 * Chat Actions (Server Actions)
 * 职责：鉴权(getCurrentUserId)、参数校验、调用 Service
 * 不处理业务逻辑，只处理请求生命周期管理
 */

/**
 * 获取当前用户ID
 * 统一鉴权入口，所有 Action 必须调用
 * @returns 用户ID
 * @throws 未登录错误
 */
async function getCurrentUserId(): Promise<string> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error("未登录，请先登录");
  }

  return session.user.id;
}

// ==================== 会话管理 Actions ====================

/**
 * Action: 创建新会话
 * @param title - 可选标题
 * @returns 创建的会话
 */
export async function createChatAction(title?: string) {
  try {
    const userId = await getCurrentUserId();

    const chat = await createChatService({ userId, title });

    return { success: true, data: chat };
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建会话失败";
    return { success: false, error: message };
  }
}

/**
 * Action: 获取用户的所有会话
 * @returns 会话列表
 */
export async function getUserChatsAction() {
  try {
    const userId = await getCurrentUserId();

    const chats = await getUserChatsService(userId);

    return { success: true, data: chats };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取会话列表失败";
    return { success: false, error: message };
  }
}

/**
 * Action: 获取会话详情（包含消息）
 * @param chatId - 会话ID
 * @returns 会话及消息
 */
export async function getChatDetailAction(chatId: string) {
  try {
    // 参数校验
    if (!chatId || typeof chatId !== "string") {
      return { success: false, error: "会话ID无效" };
    }

    const userId = await getCurrentUserId();

    const chat = await getChatDetailService(chatId, userId);

    if (!chat) {
      return { success: false, error: "会话不存在或无权限访问" };
    }

    return { success: true, data: chat };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取会话详情失败";
    return { success: false, error: message };
  }
}

/**
 * Action: 更新会话标题
 * @param chatId - 会话ID
 * @param title - 新标题
 * @returns 更新结果
 */
export async function updateChatTitleAction(chatId: string, title: string) {
  try {
    // 参数校验
    if (!chatId || typeof chatId !== "string") {
      return { success: false, error: "会话ID无效" };
    }

    if (!title || typeof title !== "string") {
      return { success: false, error: "标题无效" };
    }

    const userId = await getCurrentUserId();

    await updateChatTitleService({ chatId, userId, title });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新标题失败";
    return { success: false, error: message };
  }
}

/**
 * Action: 删除会话
 * @param chatId - 会话ID
 * @returns 删除结果
 */
export async function deleteChatAction(chatId: string) {
  try {
    // 参数校验
    if (!chatId || typeof chatId !== "string") {
      return { success: false, error: "会话ID无效" };
    }

    const userId = await getCurrentUserId();

    await deleteChatService({ chatId, userId });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除会话失败";
    return { success: false, error: message };
  }
}

// ==================== 消息管理 Actions ====================

/**
 * Action: 创建用户消息并准备流式请求
 * @param chatId - 会话ID
 * @param content - 消息内容
 * @returns 消息ID和上下文
 */
export async function createUserMessageAction(chatId: string, content: string) {
  try {
    // 参数校验
    if (!chatId || typeof chatId !== "string") {
      return { success: false, error: "会话ID无效" };
    }

    if (!content || typeof content !== "string" || !content.trim()) {
      return { success: false, error: "消息内容不能为空" };
    }

    const userId = await getCurrentUserId();

    const result = await createUserMessageService(chatId, userId, content);

    return { success: true, data: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建消息失败";
    return { success: false, error: message };
  }
}

/**
 * Action: 保存AI消息的最终内容
 * @param messageId - AI消息ID
 * @param chatId - 会话ID
 * @param content - 完整内容
 * @param reasoningContent - 思考过程
 * @returns 保存结果
 */
export async function saveAssistantMessageAction(
  messageId: string,
  chatId: string,
  content: string,
  reasoningContent?: string
) {
  try {
    // 参数校验
    if (!messageId || !chatId) {
      return { success: false, error: "参数无效" };
    }

    const userId = await getCurrentUserId();

    await saveAssistantMessageService(
      messageId,
      chatId,
      userId,
      content,
      reasoningContent
    );

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存消息失败";
    return { success: false, error: message };
  }
}

/**
 * Action: 标记消息为中断状态
 * @param messageId - 消息ID
 * @param chatId - 会话ID
 * @returns 操作结果
 */
export async function abortMessageAction(messageId: string, chatId: string) {
  try {
    if (!messageId || !chatId) {
      return { success: false, error: "参数无效" };
    }

    const userId = await getCurrentUserId();

    await abortMessageService(messageId, chatId, userId);

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "操作失败";
    return { success: false, error: message };
  }
}

/**
 * Action: 生成会话标题
 * 根据用户消息内容自动生成标题
 * @param content - 用户消息内容
 * @returns 生成的标题
 */
export async function generateChatTitleAction(content: string) {
  try {
    if (!content || typeof content !== "string" || !content.trim()) {
      return { success: false, error: "内容不能为空" };
    }

    // 验证用户登录
    await getCurrentUserId();

    const title = await generateChatTitleService(content);

    return { success: true, data: title };
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成标题失败";
    return { success: false, error: message };
  }
}
