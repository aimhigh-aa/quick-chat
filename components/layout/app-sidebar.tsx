"use client"

import { useCallback, useEffect, useState, useRef } from "react"
import { Plus, MessageSquare, Trash2, Loader2, Check, X, Pencil } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useChatStore } from "@/store/chat"

/**
 * AppSidebar 组件
 * 职责：会话列表展示、新建会话、切换会话、删除会话、编辑会话标题
 *
 * 数据流：
 * 1. 组件挂载时调用 loadChats() 从 Server Actions 加载会话列表
 * 2. 用户操作调用 Store 方法，Store 内部调用 Server Actions
 * 3. 错误处理通过 Store 中的 chatsState.error 统一管理
 */
export function AppSidebar() {
  // 从全局 Store 获取聊天状态和操作方法
  const {
    chats,
    activeChatId,
    chatsState,
    messagesState,
    loadChats,
    loadMessages,
    addChat,
    setActiveChat,
    deleteChat,
    updateChatTitle,
  } = useChatStore()

  // 编辑状态
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  /**
   * 组件挂载时加载会话列表
   */
  useEffect(() => {
    loadChats()
  }, [loadChats])

  /**
   * 进入编辑模式时聚焦输入框
   */
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingId])

  /**
   * 处理新建聊天
   */
  const handleNewChat = useCallback(async () => {
    await addChat()
  }, [addChat])

  /**
   * 处理切换聊天
   * @param id - 要切换到的聊天 ID
   */
  const handleSwitchChat = useCallback(
    async (id: string) => {
      // 如果正在编辑，不切换
      if (editingId) return
      // 先设置活跃会话（UI 立即响应）
      setActiveChat(id)
      // 从服务器加载消息
      await loadMessages(id)
    },
    [setActiveChat, loadMessages, editingId]
  )

  /**
   * 开始编辑标题
   * @param chat - 聊天对象
   * @param e - 鼠标事件
   */
  const handleStartEdit = useCallback((chat: typeof chats[0], e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(chat.id)
    setEditingTitle(chat.title)
  }, [])

  /**
   * 保存标题
   */
  const handleSaveTitle = useCallback(async () => {
    if (!editingId) return

    const trimmedTitle = editingTitle.trim()
    if (!trimmedTitle) {
      // 标题不能为空，恢复原标题
      setEditingId(null)
      return
    }

    // 获取原标题
    const chat = chats.find(c => c.id === editingId)
    if (chat && trimmedTitle !== chat.title) {
      await updateChatTitle(editingId, trimmedTitle)
    }
    setEditingId(null)
  }, [editingId, editingTitle, chats, updateChatTitle])

  /**
   * 取消编辑
   */
  const handleCancelEdit = useCallback(() => {
    setEditingId(null)
    setEditingTitle("")
  }, [])

  /**
   * 处理键盘事件
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveTitle()
    } else if (e.key === "Escape") {
      handleCancelEdit()
    }
  }, [handleSaveTitle, handleCancelEdit])

  /**
   * 处理删除聊天
   * @param e - 鼠标事件，用于阻止冒泡避免触发选中
   * @param id - 要删除的聊天 ID
   */
  const handleDeleteChat = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation()
      await deleteChat(id)
    },
    [deleteChat]
  )

  /**
   * 格式化时间戳为友好显示
   * 当天显示时间，其他显示日期
   * @param timestamp - 时间戳
   * @returns 格式化后的时间字符串
   */
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()

    if (isToday) {
      return date.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    }
    return date.toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
    })
  }

  return (
    <Sidebar>
      {/* Header 区域：放置 New Chat 按钮 */}
      <SidebarHeader className="p-3">
        <Button
          onClick={handleNewChat}
          variant="outline"
          disabled={chatsState.isLoading}
          // 使用虚线边框和透明背景，hover 时显示背景色
          className="w-full justify-start gap-2 rounded-lg border-dashed border-border/60 bg-transparent hover:bg-accent hover:border-accent-foreground/20 transition-colors"
        >
          {chatsState.isLoading ? (
            <Loader2 className="size-4 text-muted-foreground animate-spin" />
          ) : (
            <Plus className="size-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">New Chat</span>
        </Button>
      </SidebarHeader>

      {/* Content 区域：聊天卡片列表 */}
      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground/70 px-2">
            Recent Chats
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {/* 加载状态 */}
              {chatsState.isLoading && chats.length === 0 && (
                <div className="px-2 py-8 text-center">
                  <Loader2 className="size-8 mx-auto text-muted-foreground/30 mb-2 animate-spin" />
                  <p className="text-xs text-muted-foreground/60">加载中...</p>
                </div>
              )}

              {/* 错误状态 */}
              {chatsState.error && (
                <div className="px-2 py-4 text-center">
                  <p className="text-xs text-destructive">{chatsState.error}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => loadChats()}
                    className="mt-2 text-xs"
                  >
                    重试
                  </Button>
                </div>
              )}

              {/* 空状态显示 */}
              {!chatsState.isLoading &&
                !chatsState.error &&
                chats.length === 0 && (
                  <div className="px-2 py-8 text-center">
                    <MessageSquare className="size-8 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-xs text-muted-foreground/60">
                      No chats yet
                    </p>
                    <p className="text-xs text-muted-foreground/40 mt-0.5">
                      Click New Chat to start
                    </p>
                  </div>
                )}

              {/* 聊天卡片列表 */}
              {chats.map((chat) => (
                <SidebarMenuItem
                  key={chat.id}
                  className="relative group/menu-item"
                >
                  {/* 使用 div 代替 SidebarMenuButton 避免 button 嵌套问题 */}
                  <div
                    data-active={chat.id === activeChatId}
                    onClick={() => handleSwitchChat(chat.id)}
                    className={cn(
                      "peer/menu-button flex w-full cursor-pointer items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm ring-sidebar-ring transition-colors pr-20",
                      "hover:bg-accent hover:text-accent-foreground",
                      chat.id === activeChatId &&
                        "bg-accent font-medium text-accent-foreground"
                    )}
                  >
                    <MessageSquare className="size-4 shrink-0 text-muted-foreground group-hover/menu-item:text-accent-foreground" />
                    <div className="flex-1 min-w-0 overflow-hidden">
                      {editingId === chat.id ? (
                        // 编辑模式
                        <div className="flex items-center gap-1">
                          <Input
                            ref={inputRef}
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={handleSaveTitle}
                            onClick={(e) => e.stopPropagation()}
                            className="h-6 min-h-0 py-0 px-1 text-sm"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSaveTitle()
                            }}
                          >
                            <Check className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCancelEdit()
                            }}
                          >
                            <X className="size-3" />
                          </Button>
                        </div>
                      ) : (
                        // 显示模式
                        <>
                          <p className="text-sm truncate">{chat.title}</p>
                          <p className="text-xs text-muted-foreground/60">
                            {formatDate(chat.createdAt)}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  {/* 操作按钮组 */}
                  {editingId !== chat.id && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                      {/* 编辑按钮 */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleStartEdit(chat, e)}
                        className="h-7 w-7 flex items-center justify-center opacity-0 group-hover/menu-item:opacity-100 transition-opacity"
                      >
                        <Pencil className="size-3.5 text-muted-foreground hover:text-accent-foreground" />
                      </Button>
                      {/* 删除按钮 */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleDeleteChat(e, chat.id)}
                        className="h-7 w-7 flex items-center justify-center"
                      >
                        <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      {/* Footer 区域：显示统计信息 */}
      <SidebarFooter className="p-3">
        <div className="flex items-center justify-between px-2">
          <span className="text-xs text-muted-foreground">
            {chats.length} chat{chats.length !== 1 ? "s" : ""}
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
