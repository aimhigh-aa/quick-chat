import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { enableMapSet } from "immer";

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
 * @property createdAt - 创建时间戳
 *
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
 * Chat 状态定义
 * @property chats - 聊天列表数组
 * @property messages - 消息列表数组
 * @property activeChatId - 当前活跃聊天的 ID
 * @property renderBuffer - 渲染缓冲区（消息ID -> 待渲染内容）
 * @property flushInterval - 刷新间隔（毫秒），控制渲染节奏
 * @property abortController - 用于取消流式请求
 * @property isStreaming - 流式请求状态
 */
interface ChatState {
  chats: Chat[];
  messages: Message[];
  activeChatId: string | null;
  renderBuffer: Map<string, RenderBufferUnit[]>; // 消息ID -> 缓冲区
  flushInterval: number; // 刷新间隔 ms
  abortController: AbortController | null;
  isStreaming: boolean;
}

/**
 * Chat 操作方法定义
 */
interface ChatActions {
  /** 添加新聊天，可传入部分属性进行自定义 */
  addChat: (chat?: Partial<Chat>) => void;
  /** 设置当前活跃聊天 */
  setActiveChat: (id: string) => void;
  /** 删除指定 ID 的聊天 */
  deleteChat: (id: string) => void;
  /** 更新聊天标题 */
  updateChatTitle: (id: string, title: string) => void;
  /** 添加新消息到指定聊天 */
  addMessage: (
    chatId: string,
    role: Message["role"],
    content: string,
    id?: string,
  ) => void;
  /** 获取指定聊天的消息列表 */
  getMessagesByChatId: (chatId: string) => Message[];
  /** 删除指定聊天的所有消息 */
  clearMessages: (chatId: string) => void;
  /** 追加消息内容（直接写入，非缓冲） */
  appendMessageContent: (messageId: string, content: string) => void;
  /** 追加思考过程内容（直接写入，非缓冲） */
  appendReasoningContent: (messageId: string, reasoningContent: string) => void;
  /** 将内容推入渲染缓冲区（解耦数据接收与渲染） */
  pushToRenderBuffer: (messageId: string, content: string, reasoningContent?: string) => void;
  /** 刷新渲染缓冲区（将缓冲内容写入实际消息） */
  flushRenderBuffer: (messageId: string) => void;
  /** 刷新所有活跃的渲染缓冲区 */
  flushAllBuffers: () => void;
  /** 设置刷新间隔（控制渲染节奏） */
  setFlushInterval: (interval: number) => void;
  /** 设置当前的 AbortController */
  setAbortController: (controller: AbortController | null) => void;
  /** 中断生成 */
  stopStreaming: () => void;
}

/**
 * Chat 全局状态管理 Store
 * 
 * 架构设计：三层架构
 * 1. 流式解析层：StreamParser（lib/streamParser.ts）- 解析 SSE 数据
 * 2. 消息状态管理层：Chat Store（当前文件）- 渲染缓冲区 + 节奏控制
 * 3. 渲染与交互层：React 组件 - UI 展示
 * 
 * 双缓冲区设计：
 * - SSE 解析缓冲区：StreamParser.parseBuffer - 暂存不完整的 SSE 行
 * - 渲染缓冲区：renderBuffer - 暂存待渲染的内容，批量写入避免频繁状态更新
 * 
 * 节奏控制机制：
 * - flushInterval：刷新间隔，控制数据到达与渲染的解耦
 * - 接收端无阻塞，渲染端按固定节奏批量更新
 */
export const useChatStore = create<ChatState & ChatActions>()(
  immer((set, get) => ({
    // ==================== 初始状态 ====================
    chats: [],
    messages: [],
    activeChatId: null,
    renderBuffer: new Map(),
    flushInterval: 50, // 默认 50ms 刷新一次（20fps 渲染频率）
    abortController: null,
    isStreaming: false,

    // ==================== 聊天管理 ====================

    /**
     * 添加新聊天到列表头部
     * 自动生成 ID 和创建时间，标题默认为 "New Chat N"
     */
    addChat: (chat) =>
      set((state) => {
        const newChat: Chat = {
          id: chat?.id || crypto.randomUUID(),
          title: chat?.title || `New Chat ${state.chats.length + 1}`,
          createdAt: chat?.createdAt || Date.now(),
        };
        state.chats.unshift(newChat);
        state.activeChatId = newChat.id;
      }),

    /**
     * 设置当前活跃聊天 ID
     */
    setActiveChat: (id) =>
      set((state) => {
        state.activeChatId = id;
      }),

    /**
     * 删除指定聊天
     * 如果删除的是当前活跃聊天，自动切换到第一个可用聊天
     */
    deleteChat: (id) =>
      set((state) => {
        state.chats = state.chats.filter((chat) => chat.id !== id);
        if (state.activeChatId === id) {
          state.activeChatId = state.chats[0]?.id || null;
        }
        // 同时清理该聊天相关的渲染缓冲区
        state.renderBuffer.forEach((_, key) => {
          const msg = state.messages.find(m => m.id === key);
          if (msg?.chatId === id) {
            state.renderBuffer.delete(key);
          }
        });
      }),

    /**
     * 更新指定聊天的标题
     */
    updateChatTitle: (id, title) =>
      set((state) => {
        const chat = state.chats.find((c) => c.id === id);
        if (chat) {
          chat.title = title;
        }
      }),

    /**
     * 添加新消息到指定聊天
     * @param chatId - 所属聊天的 ID
     * @param role - 发送者角色：user 或 assistant
     * @param content - 消息内容
     * @param id - 可传入可选 ID
     */
    addMessage: (chatId, role, content, id?) =>
      set((state) => {
        const newMessageId = id || crypto.randomUUID();
        const newMessage: Message = {
          id: newMessageId,
          chatId,
          role,
          content,
          createdAt: Date.now(),
        };
        state.messages.push(newMessage);
        // 新消息初始化渲染缓冲区
        state.renderBuffer.set(newMessageId, []);
      }),

    /**
     * 获取指定聊天的消息列表
     * @param chatId - 聊天 ID
     * @returns 该聊天的消息数组，按时间排序
     */
    getMessagesByChatId: (chatId: string): Message[] => {
      return get()
        .messages.filter((msg: Message) => msg.chatId === chatId)
        .sort((a: Message, b: Message) => a.createdAt - b.createdAt);
    },

    /**
     * 删除指定聊天的所有消息
     * @param chatId - 聊天 ID
     */
    clearMessages: (chatId: string) =>
      set((state) => {
        const messageIds = state.messages
          .filter((msg: Message) => msg.chatId === chatId)
          .map((msg: Message) => msg.id);
        // 清理相关渲染缓冲区
        messageIds.forEach((id) => state.renderBuffer.delete(id));
        state.messages = state.messages.filter(
          (msg: Message) => msg.chatId !== chatId,
        );
      }),

    // ==================== 消息内容操作 ====================

    /**
     * 追加消息内容（直接写入）
     * @param messageId - 消息 ID
     * @param content - 追加的内容
     */
    appendMessageContent: (messageId: string, content: string) =>
      set((state) => {
        const message = state.messages.find((m) => m.id === messageId);
        if (!message) return;
        message.content += content;
      }),

    /**
     * 追加思考过程内容（直接写入）
     * @param messageId - 消息 ID
     * @param reasoningContent - 思考内容片段
     */
    appendReasoningContent: (messageId, reasoningContent) =>
      set((state) => {
        const message = state.messages.find((m) => m.id === messageId);
        if (!message) return;
        if (!message.reasoningContent) {
          message.reasoningContent = reasoningContent;
        } else {
          message.reasoningContent += reasoningContent;
        }
      }),

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
    pushToRenderBuffer: (messageId, content, reasoningContent) =>
      set((state) => {
        // 获取或初始化该消息的缓冲区
        const buffer = state.renderBuffer.get(messageId) || [];
        
        // 添加新的渲染单元
        buffer.push({
          content,
          reasoningContent,
          timestamp: Date.now(),
        });
        
        state.renderBuffer.set(messageId, buffer);
      }),

    /**
     * 刷新指定消息的渲染缓冲区
     * 
     * 作用：将缓冲区中的内容批量写入实际消息
     * 配合节奏控制，实现数据接收与渲染的解耦
     * 
     * @param messageId - 消息 ID
     */
    flushRenderBuffer: (messageId) =>
      set((state) => {
        const buffer = state.renderBuffer.get(messageId);
        if (!buffer || buffer.length === 0) return;

        const message = state.messages.find((m) => m.id === messageId);
        if (!message) return;

        // 合并缓冲区内容
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

        // 清空缓冲区
        state.renderBuffer.set(messageId, []);
      }),

    /**
     * 刷新所有活跃的渲染缓冲区
     * 用途：流式结束时强制刷新剩余内容
     */
    flushAllBuffers: () =>
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

          state.renderBuffer.set(messageId, []);
        });
      }),

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
    stopStreaming: () =>
      set((state) => {
        if (state.abortController) {
          state.abortController.abort();
          // 找到最后一条 AI 消息，标记为中断
          const lastAiMessage = [...state.messages].reverse()
            .find((msg) => msg.role === "assistant");
          if (lastAiMessage) {
            lastAiMessage.isAborted = true;
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
      }),
  })),
);