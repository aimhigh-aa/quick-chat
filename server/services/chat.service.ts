import {
  createChat,
  getChatsByUserId,
  getChatById,
  updateChatTitle,
  deleteChat,
  touchChat,
  getMessagesByChatId,
  createUserMessage,
  createAssistantMessage,
  updateMessageContent,
  markMessageAborted,
} from "@/lib/repositories";

/**
 * Chat Service
 * 处理会话管理的业务逻辑
 * 不包含鉴权，鉴权由 Action 层处理
 */

export interface ChatCreateInput {
  userId: string;
  title?: string;
}

export interface ChatUpdateInput {
  chatId: string;
  userId: string;
  title: string;
}

export interface ChatDeleteInput {
  chatId: string;
  userId: string;
}

export interface ChatWithMessages {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: {
    id: string;
    role: string;
    content: string;
    reasoningContent: string | null;
    isAborted: boolean;
    createdAt: Date;
  }[];
}

/**
 * 创建新会话
 * @param input - 创建参数
 * @returns 创建的会话
 */
export async function createChatService(input: ChatCreateInput) {
  const title = input.title?.trim() || "New Chat";
  return createChat(input.userId, title);
}

/**
 * 获取用户的所有会话列表
 * @param userId - 用户ID
 * @returns 会话列表
 */
export async function getUserChatsService(userId: string) {
  return getChatsByUserId(userId);
}

/**
 * 获取会话详情（包含消息）
 * @param chatId - 会话ID
 * @param userId - 用户ID
 * @returns 会话及消息
 */
export async function getChatDetailService(
  chatId: string,
  userId: string
): Promise<ChatWithMessages | null> {
  // Repository 层会验证用户权限
  const chat = await getChatById(chatId, userId);

  if (!chat) {
    return null;
  }

  const messages = await getMessagesByChatId(chatId, userId);

  return {
    ...chat,
    messages: messages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      reasoningContent: msg.reasoningContent,
      isAborted: msg.isAborted,
      createdAt: msg.createdAt,
    })),
  };
}

/**
 * 更新会话标题
 * @param input - 更新参数
 * @returns 更新结果
 */
export async function updateChatTitleService(input: ChatUpdateInput) {
  const title = input.title.trim();

  if (title.length === 0) {
    throw new Error("标题不能为空");
  }

  if (title.length > 100) {
    throw new Error("标题长度不能超过100个字符");
  }

  return updateChatTitle(input.chatId, input.userId, title);
}

/**
 * 删除会话及其消息
 * @param input - 删除参数
 */
export async function deleteChatService(input: ChatDeleteInput) {
  // Repository 层会验证用户权限并级联删除
  return deleteChat(input.chatId, input.userId);
}

/**
 * 创建用户消息并获取上下文
 * 用于流式请求前的准备
 * @param chatId - 会话ID
 * @param userId - 用户ID
 * @param content - 消息内容
 * @returns 创建的消息ID和上下文历史
 */
export async function createUserMessageService(
  chatId: string,
  userId: string,
  content: string
) {
  if (!content.trim()) {
    throw new Error("消息内容不能为空");
  }

  if (content.length > 10000) {
    throw new Error("消息长度不能超过10000个字符");
  }

  // 创建用户消息
  const userMessage = await createUserMessage(chatId, userId, content.trim());

  // 更新会话时间
  await touchChat(chatId, userId);

  // 获取历史消息作为上下文（最近20条）
  const history = await getMessagesByChatId(chatId, userId);
  const context = history.slice(-20).map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));

  // 创建AI消息占位
  const assistantMessage = await createAssistantMessage(chatId, userId);

  return {
    userMessageId: userMessage.id,
    assistantMessageId: assistantMessage.id,
    context,
  };
}

/**
 * 保存AI消息的最终内容
 * @param messageId - AI消息ID
 * @param chatId - 会话ID
 * @param userId - 用户ID
 * @param content - 完整内容
 * @param reasoningContent - 思考过程
 */
export async function saveAssistantMessageService(
  messageId: string,
  chatId: string,
  userId: string,
  content: string,
  reasoningContent?: string
) {
  return updateMessageContent(
    messageId,
    chatId,
    userId,
    content,
    reasoningContent
  );
}

/**
 * 标记消息为中断状态
 * @param messageId - 消息ID
 * @param chatId - 会话ID
 * @param userId - 用户ID
 */
export async function abortMessageService(
  messageId: string,
  chatId: string,
  userId: string
) {
  return markMessageAborted(messageId, chatId, userId);
}

/**
 * 生成会话标题
 * 根据用户第一条消息内容生成简短标题
 * @param content - 用户消息内容
 * @returns 生成的标题
 */
export async function generateChatTitleService(content: string): Promise<string> {
  // 清理内容，移除附件等额外信息
  const cleanContent = content.split('\n\n---')[0].trim();

  if (cleanContent.length <= 20) {
    return cleanContent;
  }

  const apiKey = process.env.XUNFEI_API_KEY;
  const apiSecret = process.env.XUNFEI_API_SECRET;
  const token = `${apiKey}:${apiSecret}`;

  try {
    const response = await fetch(
      "https://spark-api-open.xf-yun.com/x2/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: "spark-lite",
          messages: [
            {
              role: "system",
              content: "你是一个标题生成助手。请根据用户的问题生成一个简短的标题（10-15个字），标题应该概括问题的核心内容。直接返回标题，不要加引号或其他格式。",
            },
            {
              role: "user",
              content: cleanContent,
            },
          ],
          stream: false,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`API 响应异常：${response.status}`);
    }

    const data = await response.json();
    const title = data.choices?.[0]?.message?.content?.trim();

    if (title) {
      // 移除可能的引号和多余空格
      return title.replace(/[""]/g, "").trim().slice(0, 20);
    }
    console.log("API 未返回标题，使用内容前20字符作为标题");

    // 生成失败，返回前20个字符
    return cleanContent.slice(0, 20);
  } catch (error) {
    console.error("生成标题失败:", error);
    // 失败时返回前20个字符作为标题
    return cleanContent.slice(0, 20);
  }
}
