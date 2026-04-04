import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { enableMapSet } from "immer";
import {
  createChatAction,
  getUserChatsAction,
  getChatDetailAction,
  deleteChatAction,
  updateChatTitleAction,
  createUserMessageAction,
  saveAssistantMessageAction,
  abortMessageAction,
  generateChatTitleAction,
} from "@/app/actions";

// 启用 Immer 的 MapSet 插件（支持 Map 类型）
enableMapSet();

/**
 * Chat 数据接口定义
 * @property id - 唯一标识符
 * @property title - 聊天标题
 * @property createdAt - 创建时间戳
 */
export interface Chat {
  id: string;
  title: string;
  createdAt: number;
}

/**
 * Message 数据接口定义
 * @property id - 唯一标识符
 * @property chatId - 所属聊天的 ID
 * @property role - 发送者角色：user 或 assistant
 * @property content - 消息内容
 * @property reasoningContent - 思考过程内容
 * @property isAborted - 是否被中断
 * @property createdAt - 创建时间戳
 */
export interface Message {
  id: string;
  chatId: string;
  role: "user" | "assistant";
  content: string;
  reasoningContent?: string;
  isAborted?: boolean;
  createdAt: number;
}

/**
 * 渲染缓冲区单元
 * 用于暂存待渲染的内容片段
 */
interface RenderBufferUnit {
  content: string;
  reasoningContent?: string;
  timestamp: number;
}

/**
 * 异步操作状态
 */
interface AsyncState {
  isLoading: boolean;
  error: string | null;
}

/**
 * Chat 状态定义
 * @property chats - 聊天列表数组
 * @property messages - 消息列表数组（当前活跃会话的消息）
 * @property activeChatId - 当前活跃聊天的 ID
 * @property messageCache - 消息缓存 Map<chatId, Message[]>
 * @property renderBuffer - 渲染缓冲区（消息ID -> 待渲染内容）
 * @property flushInterval - 刷新间隔（毫秒），控制渲染节奏
 * @property abortController - 用于取消流式请求
 * @property isStreaming - 流式请求状态
 * @property chatsState - 会话列表加载状态
 * @property messagesState - 消息加载状态
 */
interface ChatState {
  chats: Chat[];
  messages: Message[];
  activeChatId: string | null;
  messageCache: Map<string, Message[]>; // 消息缓存：chatId -> messages
  renderBuffer: Map<string, RenderBufferUnit[]>; // 消息ID -> 缓冲区
  flushInterval: number; // 刷新间隔 ms
  abortController: AbortController | null;
  isStreaming: boolean;
  chatsState: AsyncState;
  messagesState: AsyncState;
}

/**
 * Chat 操作方法定义
 */
interface ChatActions {
  // ==================== 异步加载 ====================
  /** 从服务器加载用户的所有会话 */
  loadChats: () => Promise<void>;
  /** 加载指定会话的消息 */
  loadMessages: (chatId: string) => Promise<void>;
  /** 清空错误状态 */
  clearError: () => void;

  // ==================== 会话管理 ====================
  /** 添加新聊天 */
  addChat: (title?: string) => Promise<string | null>;
  /** 设置当前活跃聊天 */
  setActiveChat: (id: string | null) => void;
  /** 删除指定 ID 的聊天 */
  deleteChat: (id: string) => Promise<void>;
  /** 更新聊天标题 */
  updateChatTitle: (id: string, title: string) => Promise<void>;

  // ==================== 消息管理 ====================
  /** 创建用户消息并准备流式请求（返回AI消息ID） */
  createUserMessage: (chatId: string, content: string) => Promise<{ userMessageId: string; assistantMessageId: string } | null>;
  /** 保存AI消息的最终内容 */
  saveAssistantMessage: (messageId: string, chatId: string, content: string, reasoningContent?: string) => Promise<void>;
  /** 标记消息为中断 */
  abortMessage: (messageId: string, chatId: string) => Promise<void>;
  /** 获取指定聊天的消息列表（从本地缓存） */
  getMessagesByChatId: (chatId: string) => Message[];
  /** 删除指定聊天的所有消息（本地缓存） */
  clearMessages: (chatId: string) => void;

  // ==================== 本地状态操作 ====================
  /** 追加消息内容（仅本地，不保存） */
  appendMessageContent: (messageId: string, content: string) => void;
  /** 追加思考过程内容（仅本地，不保存） */
  appendReasoningContent: (messageId: string, reasoningContent: string) => void;
  /** 将内容推入渲染缓冲区 */
  pushToRenderBuffer: (messageId: string, content: string, reasoningContent?: string) => void;
  /** 刷新渲染缓冲区 */
  flushRenderBuffer: (messageId: string) => void;
  /** 刷新所有活跃的渲染缓冲区 */
  flushAllBuffers: () => void;
  /** 设置刷新间隔 */
  setFlushInterval: (interval: number) => void;
  /** 设置当前的 AbortController */
  setAbortController: (controller: AbortController | null) => void;
  /** 中断生成 */
  stopStreaming: () => void;
}

/**
 * Chat 全局状态管理 Store
 *
 * 架构设计：四层架构
 * 1. Repository 层：lib/repositories/ - 纯粹数据访问，严格 userId 隔离
 * 2. Service 层：server/services/ - 业务逻辑、事务处理
 * 3. Action 层：app/actions/ - 鉴权、参数校验
 * 4. Store 层：当前文件 - 前端状态管理、本地缓存
 *
 * 双缓冲区设计：
 * - SSE 解析缓冲区：StreamParser.parseBuffer - 暂存不完整的 SSE 行
 * - 渲染缓冲区：renderBuffer - 暂存待渲染的内容，批量写入避免频繁状态更新
 *
 * 消息缓存设计：
 * - messageCache: Map<chatId, Message[]> - 本地消息缓存，支持会话切换时快速恢复
 */
export const useChatStore = create<ChatState & ChatActions>()(
  immer((set, get) => ({
    // ==================== 初始状态 ====================
    chats: [],
    messages: [],
    activeChatId: null,
    messageCache: new Map(),
    renderBuffer: new Map(),
    flushInterval: 50, // 默认 50ms 刷新一次（20fps 渲染频率）
    abortController: null,
    isStreaming: false,
    chatsState: { isLoading: false, error: null },
    messagesState: { isLoading: false, error: null },

    // ==================== 异步加载 ====================

    /**
     * 从服务器加载用户的所有会话
     */
    loadChats: async () => {
      set((state) => {
        state.chatsState.isLoading = true;
        state.chatsState.error = null;
      });

      try {
        const result = await getUserChatsAction();

        if (!result.success) {
          set((state) => {
            state.chatsState.error = result.error || "加载失败";
            state.chatsState.isLoading = false;
          });
          return;
        }

        // 转换数据格式
        const chats: Chat[] = result.data?.map((chat: { id: string; title: string; createdAt: Date }) => ({
          id: chat.id,
          title: chat.title,
          createdAt: chat.createdAt.getTime(),
        })) || [];

        set((state) => {
          state.chats = chats;
          state.chatsState.isLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.chatsState.error = error instanceof Error ? error.message : "加载失败";
          state.chatsState.isLoading = false;
        });
      }
    },

    /**
     * 加载指定会话的消息
     * @param chatId - 会话ID
     */
    loadMessages: async (chatId: string) => {
      set((state) => {
        state.messagesState.isLoading = true;
        state.messagesState.error = null;
      });

      try {
        const result = await getChatDetailAction(chatId);

        if (!result.success || !result.data) {
          set((state) => {
            state.messagesState.error = result.error || "加载失败";
            state.messagesState.isLoading = false;
          });
          return;
        }

        // 转换消息格式
        const messages: Message[] = result.data.messages.map((msg: { id: string; role: string; content: string; reasoningContent: string | null; isAborted: boolean; createdAt: Date }) => ({
          id: msg.id,
          chatId: result.data.id,
          role: msg.role as "user" | "assistant",
          content: msg.content,
          reasoningContent: msg.reasoningContent || undefined,
          isAborted: msg.isAborted,
          createdAt: msg.createdAt.getTime(),
        }));

        // 更新缓存
        set((state) => {
          state.messageCache.set(chatId, messages);
          // 如果是当前活跃会话，同时更新 messages
          if (state.activeChatId === chatId) {
            state.messages = messages;
          }
          state.messagesState.isLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.messagesState.error = error instanceof Error ? error.message : "加载失败";
          state.messagesState.isLoading = false;
        });
      }
    },

    /**
     * 清空错误状态
     */
    clearError: () => {
      set((state) => {
        state.chatsState.error = null;
        state.messagesState.error = null;
      });
    },

    // ==================== 会话管理 ====================

    /**
     * 创建新会话
     * @param title - 可选标题
     * @returns 新会话ID
     */
    addChat: async (title?: string) => {
      const result = await createChatAction(title);

      if (!result.success || !result.data) {
        set((state) => {
          state.chatsState.error = result.error || "创建失败";
        });
        return null;
      }

      const newChat: Chat = {
        id: result.data.id,
        title: result.data.title,
        createdAt: result.data.createdAt.getTime(),
      };

      set((state) => {
        state.chats.unshift(newChat);
        state.activeChatId = newChat.id;
        state.messages = []; // 新会话清空消息
      });

      return newChat.id;
    },

    /**
     * 设置当前活跃会话
     * @param id - 会话ID，null 表示清空
     */
    setActiveChat: (id: string | null) => {
      set((state) => {
        state.activeChatId = id;
        // 从缓存加载消息
        if (id && state.messageCache.has(id)) {
          state.messages = state.messageCache.get(id) || [];
        } else {
          state.messages = [];
        }
      });
    },

    /**
     * 删除会话
     * @param id - 会话ID
     */
    deleteChat: async (id: string) => {
      const result = await deleteChatAction(id);

      if (!result.success) {
        set((state) => {
          state.chatsState.error = result.error || "删除失败";
        });
        return;
      }

      set((state) => {
        state.chats = state.chats.filter((chat) => chat.id !== id);
        if (state.activeChatId === id) {
          state.activeChatId = state.chats[0]?.id || null;
          state.messages = state.activeChatId
            ? state.messageCache.get(state.activeChatId) || []
            : [];
        }
        // 清理缓存
        state.messageCache.delete(id);
        // 清理渲染缓冲区
        state.renderBuffer.forEach((_, key) => {
          const msg = state.messages.find((m) => m.id === key);
          if (msg?.chatId === id) {
            state.renderBuffer.delete(key);
          }
        });
      });
    },

    /**
     * 更新会话标题
     * @param id - 会话ID
     * @param title - 新标题
     */
    updateChatTitle: async (id: string, title: string) => {
      const result = await updateChatTitleAction(id, title);

      if (!result.success) {
        set((state) => {
          state.chatsState.error = result.error || "更新失败";
        });
        return;
      }

      set((state) => {
        const chat = state.chats.find((c) => c.id === id);
        if (chat) {
          chat.title = title;
        }
      });
    },

    // ==================== 消息管理 ====================

    /**
     * 创建用户消息并准备流式请求
     * @param chatId - 会话ID
     * @param content - 消息内容
     * @returns userMessageId 和 assistantMessageId
     */
    createUserMessage: async (chatId: string, content: string) => {
      const result = await createUserMessageAction(chatId, content);

      if (!result.success || !result.data) {
        set((state) => {
          state.messagesState.error = result.error || "创建消息失败";
        });
        return null;
      }

      const { userMessageId, assistantMessageId, context } = result.data;

      // 添加用户消息到本地状态
      const userMessage: Message = {
        id: userMessageId,
        chatId,
        role: "user",
        content,
        createdAt: Date.now(),
      };

      // 添加AI消息占位
      const assistantMessage: Message = {
        id: assistantMessageId,
        chatId,
        role: "assistant",
        content: "",
        createdAt: Date.now(),
      };

      set((state) => {
        state.messages.push(userMessage, assistantMessage);
        // 初始化AI消息的渲染缓冲区
        state.renderBuffer.set(assistantMessageId, []);
        // 更新缓存
        state.messageCache.set(chatId, [...state.messages]);
      });

      // 如果是第一条消息（上下文只有当前消息），自动生成标题
      if (context.length <= 2) {
        // 异步生成标题，不阻塞主流程
        const chat = get().chats.find(c => c.id === chatId);
        if (chat && (chat.title === "New Chat" || chat.title === "新会话")) {
          generateChatTitleAction(content).then(titleResult => {
            if (titleResult.success && titleResult.data) {
              // 更新标题
              get().updateChatTitle(chatId, titleResult.data);
            }
          }).catch(console.error);
        }
      }

      return { userMessageId, assistantMessageId };
    },

    /**
     * 保存AI消息的最终内容
     * @param messageId - AI消息ID
     * @param chatId - 会话ID
     * @param content - 完整内容
     * @param reasoningContent - 思考过程
     */
    saveAssistantMessage: async (messageId: string, chatId: string, content: string, reasoningContent?: string) => {
      // 先刷新本地缓冲区确保数据完整
      get().flushAllBuffers();

      // 异步保存到服务器（不阻塞）
      saveAssistantMessageAction(messageId, chatId, content, reasoningContent)
        .catch((error) => {
          console.error("保存消息失败:", error);
        });
    },

    /**
     * 标记消息为中断
     * @param messageId - 消息ID
     * @param chatId - 会话ID
     */
    abortMessage: async (messageId: string, chatId: string) => {
      set((state) => {
        const message = state.messages.find((m) => m.id === messageId);
        if (message) {
          message.isAborted = true;
        }
        // 更新缓存
        state.messageCache.set(chatId, [...state.messages]);
      });

      // 异步保存到服务器
      abortMessageAction(messageId, chatId).catch((error) => {
        console.error("标记中断失败:", error);
      });
    },

    /**
     * 获取指定聊天的消息列表（本地）
     * @param chatId - 聊天 ID
     * @returns 该聊天的消息数组，按时间排序
     */
    getMessagesByChatId: (chatId: string): Message[] => {
      return get().messageCache.get(chatId) || [];
    },

    /**
     * 清空指定聊天的本地消息缓存
     * @param chatId - 聊天 ID
     */
    clearMessages: (chatId: string) => {
      set((state) => {
        state.messageCache.delete(chatId);
        if (state.activeChatId === chatId) {
          state.messages = [];
        }
        // 清理相关渲染缓冲区
        const messageIds = state.messages
          .filter((msg: Message) => msg.chatId === chatId)
          .map((msg: Message) => msg.id);
        messageIds.forEach((id) => state.renderBuffer.delete(id));
      });
    },

    // ==================== 本地状态操作 ====================

    /**
     * 追加消息内容（直接写入，仅本地）
     * @param messageId - 消息 ID
     * @param content - 追加的内容
     */
    appendMessageContent: (messageId: string, content: string) => {
      set((state) => {
        const message = state.messages.find((m) => m.id === messageId);
        if (!message) return;
        message.content += content;
        // 同步更新缓存
        if (state.activeChatId) {
          const cached = state.messageCache.get(state.activeChatId) || [];
          const cachedMsg = cached.find((m) => m.id === messageId);
          if (cachedMsg) {
            cachedMsg.content += content;
          }
        }
      });
    },

    /**
     * 追加思考过程内容（直接写入，仅本地）
     * @param messageId - 消息 ID
     * @param reasoningContent - 思考内容片段
     */
    appendReasoningContent: (messageId, reasoningContent) => {
      set((state) => {
        const message = state.messages.find((m) => m.id === messageId);
        if (!message) return;
        if (!message.reasoningContent) {
          message.reasoningContent = reasoningContent;
        } else {
          message.reasoningContent += reasoningContent;
        }
        // 同步更新缓存
        if (state.activeChatId) {
          const cached = state.messageCache.get(state.activeChatId) || [];
          const cachedMsg = cached.find((m) => m.id === messageId);
          if (cachedMsg) {
            if (!cachedMsg.reasoningContent) {
              cachedMsg.reasoningContent = reasoningContent;
            } else {
              cachedMsg.reasoningContent += reasoningContent;
            }
          }
        }
      });
    },

    // ==================== 渲染缓冲区（核心亮点） ====================

    /**
     * 将内容推入渲染缓冲区
     *
     * 设计意图：解耦数据接收与渲染
     * - 解析层快速接收数据，存入缓冲区
     * - 渲染层按固定节奏（flushInterval）批量读取缓冲区
     * - 避免每个 chunk 都触发 React 重渲染
     *
     * @param messageId - 消息 ID
     * @param content - 正文内容
     * @param reasoningContent - 思考过程内容（可选）
     */
    pushToRenderBuffer: (messageId, content, reasoningContent) => {
      set((state) => {
        const buffer = state.renderBuffer.get(messageId) || [];
        buffer.push({
          content,
          reasoningContent,
          timestamp: Date.now(),
        });
        state.renderBuffer.set(messageId, buffer);
      });
    },

    /**
     * 刷新指定消息的渲染缓冲区
     *
     * 作用：将缓冲区中的内容批量写入实际消息
     * 配合节奏控制，实现数据接收与渲染的解耦
     *
     * @param messageId - 消息 ID
     */
    flushRenderBuffer: (messageId) => {
      set((state) => {
        const buffer = state.renderBuffer.get(messageId);
        if (!buffer || buffer.length === 0) return;

        const message = state.messages.find((m) => m.id === messageId);
        if (!message) return;

        let contentToAppend = "";
        let reasoningToAppend = "";

        for (const unit of buffer) {
          contentToAppend += unit.content;
          if (unit.reasoningContent) {
            reasoningToAppend += unit.reasoningContent;
          }
        }

        // 写入实际消息
        message.content += contentToAppend;
        if (reasoningToAppend) {
          message.reasoningContent =
            (message.reasoningContent || "") + reasoningToAppend;
        }

        // 同步更新缓存
        if (state.activeChatId) {
          const cached = state.messageCache.get(state.activeChatId);
          if (cached) {
            const cachedMsg = cached.find((m) => m.id === messageId);
            if (cachedMsg) {
              cachedMsg.content += contentToAppend;
              if (reasoningToAppend) {
                cachedMsg.reasoningContent =
                  (cachedMsg.reasoningContent || "") + reasoningToAppend;
              }
            }
          }
        }

        // 清空缓冲区
        state.renderBuffer.set(messageId, []);
      });
    },

    /**
     * 刷新所有活跃的渲染缓冲区
     * 用途：流式结束时强制刷新剩余内容
     */
    flushAllBuffers: () => {
      set((state) => {
        state.renderBuffer.forEach((buffer, messageId) => {
          if (buffer.length === 0) return;

          const message = state.messages.find((m) => m.id === messageId);
          if (!message) return;

          let contentToAppend = "";
          let reasoningToAppend = "";

          for (const unit of buffer) {
            contentToAppend += unit.content;
            if (unit.reasoningContent) {
              reasoningToAppend += unit.reasoningContent;
            }
          }

          message.content += contentToAppend;
          if (reasoningToAppend) {
            message.reasoningContent =
              (message.reasoningContent || "") + reasoningToAppend;
          }

          // 同步更新缓存
          if (state.activeChatId) {
            const cached = state.messageCache.get(state.activeChatId);
            if (cached) {
              const cachedMsg = cached.find((m) => m.id === messageId);
              if (cachedMsg) {
                cachedMsg.content += contentToAppend;
                if (reasoningToAppend) {
                  cachedMsg.reasoningContent =
                    (cachedMsg.reasoningContent || "") + reasoningToAppend;
                }
              }
            }
          }

          state.renderBuffer.set(messageId, []);
        });
      });
    },

    /**
     * 设置刷新间隔（控制渲染节奏）
     *
     * 调节建议：
     * - 值越小，渲染越快，但 React 重渲染越频繁
     * - 值越大，批量处理越多，但感官延迟越高
     * - 推荐范围：30-100ms
     *
     * @param interval - 刷新间隔（毫秒）
     */
    setFlushInterval: (interval) =>
      set((state) => {
        state.flushInterval = Math.max(10, Math.min(500, interval));
      }),

    // ==================== 流式控制 ====================

    /**
     * 设置当前的 AbortController
     */
    setAbortController: (controller) =>
      set((state) => {
        state.abortController = controller;
        state.isStreaming = controller !== null;
      }),

    /**
     * 中断当前的流式请求
     */
    stopStreaming: () => {
      set((state) => {
        if (state.abortController) {
          state.abortController.abort();
          // 找到最后一条 AI 消息，标记为中断
          const lastAiMessage = [...state.messages]
            .reverse()
            .find((msg) => msg.role === "assistant");
          if (lastAiMessage) {
            lastAiMessage.isAborted = true;
            // 异步保存中断状态
            abortMessageAction(lastAiMessage.id, lastAiMessage.chatId).catch(
              console.error
            );
          }
          state.abortController = null;
          state.isStreaming = false;
          // 中断时强制刷新剩余缓冲区
          state.renderBuffer.forEach((buffer, messageId) => {
            if (buffer.length > 0) {
              const message = state.messages.find((m) => m.id === messageId);
              if (message) {
                let contentToAppend = "";
                let reasoningToAppend = "";
                for (const unit of buffer) {
                  contentToAppend += unit.content;
                  if (unit.reasoningContent) {
                    reasoningToAppend += unit.reasoningContent;
                  }
                }
                message.content += contentToAppend;
                if (reasoningToAppend) {
                  message.reasoningContent =
                    (message.reasoningContent || "") + reasoningToAppend;
                }
              }
              state.renderBuffer.set(messageId, []);
            }
          });
        }
      });
    },
  }))
);
