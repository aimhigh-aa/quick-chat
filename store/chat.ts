import { log } from "console";
import { stat } from "fs";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

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
 * Chat 状态定义
 * @property chats - 聊天列表数组
 * @property messages - 消息列表数组
 * @property activeChatId - 当前活跃聊天的 ID
 */
interface ChatState {
  chats: Chat[];
  messages: Message[];
  activeChatId: string | null;
  abortController: AbortController|null; // 用于取消流式请求
  isStreaming: boolean; // 流式请求状态
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
  /** 追加消息内容 */
  appendMessageContent: (messageId: string, content: string) => void;
  /** 追加思考过程内容*/
  appendReasoningContent: (messageId: string, reasoningContent: string) => void;
  setAbortController: (controller: AbortController|null) => void;
  stopStreaming: () => void; //中断生成
}

/**
 * Chat 全局状态管理 Store
 * 使用 Zustand + Immer 实现不可变状态更新
 * 仅存储必须全局共享的聊天列表和当前活跃聊天 ID（符合编码规范第 3 条）
 */
export const useChatStore = create<ChatState & ChatActions>()(
  immer((set, get) => ({
    // 初始状态
    chats: [],
    messages: [],
    activeChatId: null,
    abortController: null,
    isStreaming: false,

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
        // 新聊天插入到列表头部
        state.chats.unshift(newChat);
        // 自动设为当前活跃聊天
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
     * @param id - 运行传入可选id
     *
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
        state.messages = state.messages.filter(
          (msg: Message) => msg.chatId !== chatId,
        );
      }),

    /**
     * 追加消息内容
     * @param chatId - 聊天 ID
     * @param messageId - 消息 ID
     * @param content - 追加的内容
     */

    appendMessageContent: (messageId: string, content: string) =>
      set((state) => {
        const message = state.messages.find((m) => m.id === messageId);
        if (!message) {
          return;
        }
        message.content += content;
      }),

    /**
     * 追加思考过程内容（用于流式渲染 reasoning_content）
     * @param messageId - 消息 ID
     * @param reasoningContent - 思考内容片段
     */
    appendReasoningContent: (messageId, reasoningContent) =>
      set((state) => {
        const message = state.messages.find((m) => m.id === messageId);
        if (!message) return;

        // 初始化或追加
        if (!message.reasoningContent) {
          message.reasoningContent = reasoningContent;
        } else {
          message.reasoningContent += reasoningContent;
        }
      }),
    /**
     * 设置当前的 AbortController
     */
    setAbortController: (controller) =>
      set((state) => {
        state.abortController = controller;
        state.isStreaming = controller !== null; // 根据 controller 是否存在设置流式状态
      }),
    /**
     * 中断当前的流式请求
     */
    stopStreaming: () =>
      set((state) => {
        if (state.abortController) {
          state.abortController.abort();
          //找到最后一条消息，标记为中断
          const lastAiMessage = [...state.messages].reverse().find((msg) => msg.role === "assistant");
          if (lastAiMessage) {
            lastAiMessage.isAborted = true;
          }
          state.abortController = null;
          state.isStreaming = false;
        }
      })


  })),
);
