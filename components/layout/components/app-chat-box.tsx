"use client"

import { useMemo, useState, useRef, useEffect } from "react"
import { ScrollArea } from "../../ui/scroll-area"
import { Avatar, AvatarImage, AvatarFallback } from "../../ui/avatar"
import { cn } from "@/lib/utils"
import { useChatStore, type Message } from "@/store/chat"
import { User, Bot } from "lucide-react"
import { Sparkles, ChevronDown, ChevronRight } from "lucide-react"
import { Markdown } from "@/components/MarkdownRender/MarkdownRender"

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

  //思考过程展开状态
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false)

  //是否有思考过程内容
  const hasReasoning = !!message.reasoningContent && message.reasoningContent.length > 0

  // 是否正在思考中（有思考内容但还没有回答内容）
  const isThinking = hasReasoning && !message.content

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
        {/* AI 消息的思考过程（可折叠） */}
        {!isUser && hasReasoning && (
          <div className="w-full mb-2">
            {/* 思考过程头部（可点击折叠） */}
            <button
              onClick={() => setIsReasoningExpanded(!isReasoningExpanded)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs font-medium transition-colors",
                "bg-zinc-50 text-zinc-800 hover:bg-zinc-100 border border-zinc-200 border-b-0",
                !isReasoningExpanded && "rounded-b-lg border-b"
              )}
            >
              <Sparkles className="size-3" />
              <span>思考过程</span>
              {isThinking && (
                <span className="ml-1 flex gap-0.5">
                  <span className="animate-bounce">·</span>
                  <span className="animate-bounce delay-75">·</span>
                  <span className="animate-bounce delay-150">·</span>
                </span>
              )}
              {isReasoningExpanded ? (
                <ChevronDown className="size-3 ml-1" />
              ) : (
                <ChevronRight className="size-3 ml-1" />
              )}
            </button>

            {/* 思考过程内容 */}
            {isReasoningExpanded && (
              <div className="px-3 py-2 bg-zinc-50 rounded-b-lg border border-zinc-200 border-t-0">
                <div className="text-xs text-zinc-800 whitespace-pre-wrap leading-relaxed">
                  {message.reasoningContent}
                </div>
              </div>
            )}
          </div>
        )}
        {/* 气泡 */}
        <div
          className={cn(
            "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
            // 用户消息：主色调背景，圆角在右侧
            isUser
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : // AI 消息：浅色背景，圆角在左侧
              "bg-muted text-muted-foreground rounded-bl-sm",
            // 如果正在思考中但还没有内容，显示半透明提示
            !isUser && !message.content && "opacity-50 italic"
          )}
        >
          {isUser ? message.content : message.content ? (
            <Markdown content={message.content} />
          ) : (
            isThinking && !message.isAborted && '思考中...'
          )}
          {/*中断提示*/}
          {message.isAborted && (
            <div className="mt-2 pt-2 border-t border-dashed border-muted-foreground/30 text-s text-zinc-950!  italic">
              你已让系统停止这条回答
            </div>
          )}
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)

  /**
   * 获取 ScrollArea 内部的 Viewport 元素
   * Shadcn ScrollArea 结构：ScrollArea > ScrollAreaViewport > 内容
   */

  const getViewport = () => {
    // ScrollArea 的第一个子元素就是 Viewport
    return scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null
  }

  //检查是否滑动到底部
  const checkIsAtBottom = () => {
    const viewPort = getViewport();
    if (!viewPort) return true;
    const { scrollTop, scrollHeight, clientHeight } = viewPort;
    console.log('scrollTop:', scrollTop, 'scrollHeight:', scrollHeight, 'clientHeight:', clientHeight)
    return scrollHeight - scrollTop - clientHeight < 50; // 50px 的阈值
  }

  //滚动到底部
  const scrollToBottom = () => {
    const viewPort = getViewport();
    if (!viewPort) return;
    viewPort.scrollTo({ top: viewPort.scrollHeight, behavior: 'smooth' })
  }


  //消息变化时自动滚动（仅在底部）
  useEffect(() => {
    if (isAtBottom) {
      // 使用 setTimeout 确保 DOM 更新后再滚动
      setTimeout(scrollToBottom, 0)
    }
  }, [messages])

  /**
    * 监听滚动事件
    * 使用 useEffect 绑定，因为 onScroll 属性不生效
    */
  useEffect(() => {
    const viewPort = getViewport();
    if (!viewPort) return;

    const handleScroll = () => {
      setIsAtBottom(checkIsAtBottom())
    }
    viewPort.addEventListener('scroll', handleScroll)
    // 初始化时检查一次
    handleScroll()

    return () => {
      viewPort.removeEventListener('scroll', handleScroll)
    }
  }, [])


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
      <ScrollArea className="w-[45vw] h-[calc(100vh-200px)]" ref={scrollRef} >
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