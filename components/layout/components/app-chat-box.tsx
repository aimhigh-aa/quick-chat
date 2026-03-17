"use client"

import { useMemo } from "react"
import { ScrollArea } from "../../ui/scroll-area"
import { Avatar, AvatarImage, AvatarFallback } from "../../ui/avatar"
import { cn } from "@/lib/utils"
import { useChatStore, type Message } from "@/store/chat"
import { User, Bot } from "lucide-react"

/**
 * 格式化时间戳为友好显示
 * 当天显示时间，其他显示日期
 */
const formatTime = (timestamp: number) => {
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

/**
 * 单条消息气泡组件
 * @property message - 消息数据
 */
interface ChatMessageProps {
  message: Message
}

const ChatMessage = ({ message }: ChatMessageProps) => {
  // 判断是否为当前用户发送的消息
  const isUser = message.role === "user"

  return (
    <div
      className={cn(
        "flex gap-3 mb-6",
        // 用户消息右对齐，AI 消息左对齐
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* 头像 */}
      <Avatar className="size-8 shrink-0">
        {isUser ? (
          <>
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>
              <User className="size-4" />
            </AvatarFallback>
          </>
        ) : (
          <>
            <AvatarImage src="/ai-avatar.png" />
            <AvatarFallback className="bg-primary/10">
              <Bot className="size-4 text-primary" />
            </AvatarFallback>
          </>
        )}
      </Avatar>

      {/* 消息内容区域 */}
      <div className={cn("flex flex-col max-w-[75%]", isUser ? "items-end" : "items-start")}>
        {/* 气泡 */}
        <div
          className={cn(
            "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
            // 用户消息：主色调背景，圆角在右侧
            isUser
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : // AI 消息：浅色背景，圆角在左侧
                "bg-muted text-muted-foreground rounded-bl-sm"
          )}
        >
          {message.content}
        </div>
        {/* 时间戳 */}
        <span className="text-xs text-muted-foreground/60 mt-1.5 px-1">
          {formatTime(message.createdAt)}
        </span>
      </div>
    </div>
  )
}

/**
 * 聊天消息列表组件
 * 显示当前活跃聊天的所有消息气泡
 */
export const AppChatBox = () => {
  // 从全局 Store 获取消息和当前活跃聊天 ID
  const { messages, activeChatId } = useChatStore()

  /**
   * 过滤并排序当前聊天的消息
   * 按创建时间升序排列（旧消息在前）
   */
  const currentMessages = useMemo(() => {
    if (!activeChatId) return []
    return messages
      .filter((msg: Message) => msg.chatId === activeChatId)
      .sort((a: Message, b: Message) => a.createdAt - b.createdAt)
  }, [messages, activeChatId])

  return (
    <div className="bg-gray-50 h-full">
      <ScrollArea className="w-[45vw] h-[calc(100vh-200px)]">
        <div className="p-5">
          {/* 空状态：没有活跃聊天或没有消息 */}
          {currentMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Bot className="size-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground/60 text-sm">开始你的对话</p>
              <p className="text-muted-foreground/40 text-xs mt-1">
                在下方输入框发送消息
              </p>
            </div>
          ) : (
            // 消息列表
            currentMessages.map((message: Message) => (
              <ChatMessage key={message.id} message={message} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}