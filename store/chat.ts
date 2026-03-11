import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

/**
 * Chat 数据接口定义
 * @property id - 唯一标识符
 * @property title - 聊天标题
 * @property createdAt - 创建时间戳
 */
export interface Chat {
  id: string
  title: string
  createdAt: number
}

/**
 * Chat 状态定义
 * @property chats - 聊天列表数组
 * @property activeChatId - 当前活跃聊天的 ID
 */
interface ChatState {
  chats: Chat[]
  activeChatId: string | null
}

/**
 * Chat 操作方法定义
 */
interface ChatActions {
  /** 添加新聊天，可传入部分属性进行自定义 */
  addChat: (chat?: Partial<Chat>) => void
  /** 设置当前活跃聊天 */
  setActiveChat: (id: string) => void
  /** 删除指定 ID 的聊天 */
  deleteChat: (id: string) => void
  /** 更新聊天标题 */
  updateChatTitle: (id: string, title: string) => void
}

/**
 * Chat 全局状态管理 Store
 * 使用 Zustand + Immer 实现不可变状态更新
 * 仅存储必须全局共享的聊天列表和当前活跃聊天 ID（符合编码规范第 3 条）
 */
export const useChatStore = create<ChatState & ChatActions>()(
  immer((set) => ({
    // 初始状态
    chats: [],
    activeChatId: null,

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
        }
        // 新聊天插入到列表头部
        state.chats.unshift(newChat)
        // 自动设为当前活跃聊天
        state.activeChatId = newChat.id
      }),

    /**
     * 设置当前活跃聊天 ID
     */
    setActiveChat: (id) =>
      set((state) => {
        state.activeChatId = id
      }),

    /**
     * 删除指定聊天
     * 如果删除的是当前活跃聊天，自动切换到第一个可用聊天
     */
    deleteChat: (id) =>
      set((state) => {
        state.chats = state.chats.filter((chat) => chat.id !== id)
        if (state.activeChatId === id) {
          state.activeChatId = state.chats[0]?.id || null
        }
      }),

    /**
     * 更新指定聊天的标题
     */
    updateChatTitle: (id, title) =>
      set((state) => {
        const chat = state.chats.find((c) => c.id === id)
        if (chat) {
          chat.title = title
        }
      }),
  }))
)
