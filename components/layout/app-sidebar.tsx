"use client"

import { useCallback } from "react"
import { Plus, MessageSquare, Trash2 } from "lucide-react"
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
import { cn } from "@/lib/utils"
import { useChatStore } from "@/store/chat"

/**
 * AppSidebar 组件
 * 实现功能：
 * 1. 显示 New Chat 按钮，点击添加新聊天卡片
 * 2. 显示聊天卡片列表，支持选中高亮
 * 3. 支持删除聊天卡片
 * 4. 空状态提示
 */
export function AppSidebar() {
  // 从全局 Store 获取聊天状态和操作方法
  const { chats, activeChatId, addChat, setActiveChat, deleteChat } = useChatStore()

  /**
   * 处理新建聊天
   * 使用 useCallback 避免不必要的函数重新创建
   */
  const handleNewChat = useCallback(() => {
    addChat()
  }, [addChat])

  /**
   * 处理删除聊天
   * @param e - 鼠标事件，用于阻止冒泡避免触发选中
   * @param id - 要删除的聊天 ID
   */
  const handleDeleteChat = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    deleteChat(id)
  }, [deleteChat])

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
        minute: "2-digit"
      })
    }
    return date.toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric"
    })
  }

  return (
    <Sidebar>
      {/* Header 区域：放置 New Chat 按钮 */}
      <SidebarHeader className="p-3">
        <Button
          onClick={handleNewChat}
          variant="outline"
          // 使用虚线边框和透明背景，hover 时显示背景色（符合简洁美观要求）
          className="w-full justify-start gap-2 rounded-lg border-dashed border-border/60 bg-transparent hover:bg-accent hover:border-accent-foreground/20 transition-colors"
        >
          <Plus className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">New Chat1111</span>
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
              {/* 空状态显示 */}
              {chats.length === 0 ? (
                <div className="px-2 py-8 text-center">
                  <MessageSquare className="size-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground/60">
                    No chats yet
                  </p>
                  <p className="text-xs text-muted-foreground/40 mt-0.5">
                    Click New Chat to start
                  </p>
                </div>
              ) : (
                // 聊天卡片列表
                chats.map((chat) => (
                  <SidebarMenuItem key={chat.id} className="relative group/menu-item">
                    {/**
                     * 使用 div 代替 SidebarMenuButton 避免 button 嵌套问题
                     * 完全复制 SidebarMenuButton 的样式以保持视觉一致性
                     */}
                    <div
                      data-active={chat.id === activeChatId}
                      onClick={() => setActiveChat(chat.id)}
                      className={cn(
                        "peer/menu-button flex w-full cursor-pointer items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm ring-sidebar-ring transition-colors",
                        "hover:bg-accent hover:text-accent-foreground",
                        chat.id === activeChatId && "bg-accent font-medium text-accent-foreground"
                      )}
                    >
                      <MessageSquare className="size-4 shrink-0 text-muted-foreground group-hover/menu-item:text-accent-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{chat.title}</p>
                        <p className="text-xs text-muted-foreground/60">
                          {formatDate(chat.createdAt)}
                        </p>
                      </div>
                    </div>
                    {/**
                     * 删除按钮：使用绝对定位放在卡片右侧
                     * hover 卡片时显示，避免嵌套 button 问题
                     */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDeleteChat(e, chat.id)}
                      // active:translate-y-0 覆盖 Button 默认的 active:translate-y-px，防止点击时下移
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center active:translate-y-[-40%]"
                    >
                      <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </SidebarMenuItem>
                ))
              )}
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