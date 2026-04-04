import { Textarea } from "../../ui/textarea"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem, DropdownMenuLabel } from "../../ui/dropdown-menu"
import { Button } from "../../ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "../../ui/dialog"
import { Link, Plus, ImageUp, ChevronDown, Brain, Sparkle, Mic, Send, MessageSquare, Square } from "lucide-react"
import { useEffect, useState, useRef } from "react"
import { StreamParser } from "@/lib/streamParser"
import { useChatStore } from "@/store/chat"
import type { Message } from "@/store/chat";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition"
import { useFileUpload, UploadedFile } from '@/hooks/useFileUpload'

interface ChatInputProps {
    className?: string;
}

/**
 * 聊天输入组件
 *
 * 架构：渲染与交互层（第四层 - 与四层架构对应）
 * - 负责用户输入、发送消息
 * - 通过 Server Actions 与后端通信
 * - 使用渲染缓冲区接收流式数据
 * - 通过定时器周期刷新缓冲区，实现节奏控制
 *
 * 数据流：
 * 1. 用户发送 -> createUserMessage (Server Action) 创建消息
 * 2. StreamParser 解析 SSE 数据
 * 3. 回调 pushToRenderBuffer 存入缓冲区（本地渲染）
 * 4. 本地定时器按 flushInterval 调用 flushRenderBuffer
 * 5. 流式结束后 -> saveAssistantMessage (Server Action) 保存最终内容
 */
export const AppChatInput: React.FC<ChatInputProps> = ({ className = '' }) => {
    // 从 Store 获取状态和操作方法
    const {
        activeChatId,
        addChat,
        createUserMessage,
        saveAssistantMessage,
        abortMessage,
        pushToRenderBuffer,
        flushRenderBuffer,
        flushAllBuffers,
        flushInterval,
        setAbortController,
        stopStreaming,
        isStreaming,
        messagesState
    } = useChatStore()

    // 输入框文本状态
    const [text, setText] = useState("")
    // Dialog 显示状态
    const [showDialog, setShowDialog] = useState(false)
    // 语音Dialog 显示状态
    const [speechErrorDialog, setSpeechErrorDialog] = useState<{ open: boolean, message: string }>({ open: false, message: "" })
    // 发送状态
    const [isSending, setIsSending] = useState(false)

    // 当前活跃的消息 ID（流式响应）
    const activeMessageIdRef = useRef<string | null>(null)
    const activeChatIdRef = useRef<string | null>(null)
    // 刷新定时器引用
    const flushTimerRef = useRef<NodeJS.Timeout | null>(null)
    // 累积内容（用于最终保存）
    const accumulatedContentRef = useRef("")
    const accumulatedReasoningRef = useRef("")

    // 使用语音识别hook
    const {
        status,
        recordingTime,
        error: speechError,
        startRecording,
        stopRecording,
        isSupported
    } = useSpeechRecognition(
        // 识别成功回调：追加到输入框
        (recognizedText) => {
            setText(prev => prev + recognizedText)
        },
        60 // 最大录音60秒
    )

    // 使用文件上传hook
    const {
        files,
        isUploading,
        handleFiles,
        removeFile,
        clearFiles,
        openFilePicker,
        fileInputRef
    } = useFileUpload({
        onSuccess: (file) => console.log('上传成功:', file.name),
        onError: (err) => console.error('上传失败:', err)
    })

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleFiles(e.target.files)
    }

    /**
     * 将附件内容拼接到用户消息
     */
    const buildMessageWithAttachments = (
        content: string,
        files: UploadedFile[]
    ): string => {
        if (!files || files.length === 0) return content

        const attachmentsText = files
            .filter(f => f.status === 'success')  // 只取成功上传的文件
            .map(f => `\n\n---\n**附件: ${f.name}**\n\`\`\`\n${f.content}\n\`\`\``)
            .join('')

        return content + attachmentsText
    }

    // 监听语音错误
    useEffect(() => {
        if (speechError) {
            setSpeechErrorDialog({
                open: true,
                message: speechError
            })
        }
    }, [speechError])

    // 关闭dialog回调
    const handleCloseErrorDialog = () => {
        setSpeechErrorDialog({ open: false, message: '' })
    }

    // 录音中显示红色脉冲按钮，空闲显示普通按钮
    const isRecording = status === 'recording'

    /**
     * 处理麦克风按钮点击
     */
    const handleMicClick = () => {
        if (status === 'recording') {
            stopRecording()
        } else {
            startRecording()
        }
    }

    /**
     * 处理输入框内容变化
     */
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)

    /**
     * 处理发送消息
     * 如果没有活跃会话，弹出 Dialog 提示创建
     * 如果有活跃会话，直接发送消息
     */
    const handleSend = async () => {
        // 没有输入内容时不处理
        if (!text.trim()) return

        // 没有活跃会话时弹出提示
        if (!activeChatId) {
            setShowDialog(true)
            return
        }

        const textToUse = text
        // 过滤成功上传的文件
        const successFiles = files.filter(f => f.status === 'success')

        // 构建带附件的完整消息内容
        const finalContent = buildMessageWithAttachments(textToUse, successFiles)
        clearFiles()
        setText("")
        setIsSending(true)

        try {
            // 1. 创建用户消息和AI消息占位（通过 Server Action）
            const result = await createUserMessage(activeChatId, finalContent)

            if (!result) {
                setIsSending(false)
                return
            }

            const { assistantMessageId } = result
            activeMessageIdRef.current = assistantMessageId
            activeChatIdRef.current = activeChatId

            // 重置累积内容
            accumulatedContentRef.current = ""
            accumulatedReasoningRef.current = ""

            // 2. 创建 AbortController
            const controller = new AbortController()
            setAbortController(controller)

            // 3. 启动流式请求（使用渲染缓冲区）
            const parser = new StreamParser()

            // 启动定时器：按固定节奏刷新渲染缓冲区
            flushTimerRef.current = setInterval(() => {
                if (activeMessageIdRef.current) {
                    flushRenderBuffer(activeMessageIdRef.current)
                }
            }, flushInterval)

            parser.fetchStream({ content: finalContent } as Message, {
                onChunk: (content: string) => {
                    // 推入渲染缓冲区（解耦数据接收与渲染）
                    pushToRenderBuffer(assistantMessageId, content)
                    // 累积内容用于最终保存
                    accumulatedContentRef.current += content
                },
                onReasoningChunk: (reasoningContent: string) => {
                    // 推入渲染缓冲区
                    pushToRenderBuffer(assistantMessageId, "", reasoningContent)
                    // 累积思考过程
                    accumulatedReasoningRef.current += reasoningContent
                },
                onDone: async () => {
                    console.log('流式输出结束')
                    // 清除定时器
                    if (flushTimerRef.current) {
                        clearInterval(flushTimerRef.current)
                        flushTimerRef.current = null
                    }
                    // 强制刷新剩余缓冲区
                    flushAllBuffers()
                    setAbortController(null)
                    setIsSending(false)

                    // 4. 保存AI消息的最终内容到服务器（异步，不阻塞）
                    if (activeChatIdRef.current && activeMessageIdRef.current) {
                        await saveAssistantMessage(
                            activeMessageIdRef.current,
                            activeChatIdRef.current,
                            accumulatedContentRef.current,
                            accumulatedReasoningRef.current || undefined
                        )
                    }

                    // 清理引用
                    activeMessageIdRef.current = null
                    activeChatIdRef.current = null
                },
                onError: async (error: string) => {
                    console.error('流式输出错误:', error)
                    // 清除定时器
                    if (flushTimerRef.current) {
                        clearInterval(flushTimerRef.current)
                        flushTimerRef.current = null
                    }
                    // 强制刷新剩余缓冲区
                    flushAllBuffers()

                    // 保存错误信息到消息
                    const errorContent = accumulatedContentRef.current + `\n\n[错误]: ${error}`
                    if (activeChatIdRef.current && activeMessageIdRef.current) {
                        await saveAssistantMessage(
                            activeMessageIdRef.current,
                            activeChatIdRef.current,
                            errorContent,
                            accumulatedReasoningRef.current || undefined
                        )
                    }

                    setAbortController(null)
                    setIsSending(false)
                    activeMessageIdRef.current = null
                    activeChatIdRef.current = null
                },
                onAbort: async () => {
                    console.log('流式请求被取消')
                    // 清除定时器
                    if (flushTimerRef.current) {
                        clearInterval(flushTimerRef.current)
                        flushTimerRef.current = null
                    }

                    // 标记消息为中断状态并保存
                    if (activeChatIdRef.current && activeMessageIdRef.current) {
                        await abortMessage(
                            activeMessageIdRef.current,
                            activeChatIdRef.current
                        )
                        // 保存已生成的内容
                        if (accumulatedContentRef.current) {
                            await saveAssistantMessage(
                                activeMessageIdRef.current,
                                activeChatIdRef.current,
                                accumulatedContentRef.current,
                                accumulatedReasoningRef.current || undefined
                            )
                        }
                    }

                    setIsSending(false)
                    activeMessageIdRef.current = null
                    activeChatIdRef.current = null
                }
            }, controller.signal)
        } catch (error) {
            console.error('发送消息失败:', error)
            setIsSending(false)
        }
    }

    // 中断按钮回调
    const handleStop = () => {
        stopStreaming()
    }

    /**
     * 处理立即创建会话并发送消息
     * 创建新会话后自动激活，然后发送当前输入的内容
     */
    const handleCreateAndSend = async () => {
        // 创建新会话（addChat 会自动激活新会话）
        const newChatId = await addChat(text.slice(0, 20) || 'New Chat')
        // 关闭 Dialog
        setShowDialog(false)
        // 发送消息（activeChatId 会在 addChat 后更新，但异步可能还没完成）
        // 使用 setTimeout 确保状态更新后再发送
        if (newChatId) {
            setTimeout(() => {
                handleSend()
            }, 100)
        }
    }

    // 清理定时器（组件卸载时）
    useEffect(() => {
        return () => {
            if (flushTimerRef.current) {
                clearInterval(flushTimerRef.current)
            }
        }
    }, [])

    return (
        <div className={`flex-col hover:shadow-md rounded-xl transition-shadow w-[40vw] mb-3.5 shadow-sm border-2 border border-gray-200 ${className}`}>
            {/* 隐藏的文件输入框，用于触发文件选择 */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".txt,.md"
                multiple
                className="hidden"
            />

            {/* 错误提示 */}
            {messagesState.error && (
                <div className="px-4 pt-2 text-xs text-destructive">
                    {messagesState.error}
                </div>
            )}

            {/* 文件列表展示  */}
            {files.length > 0 && (
                <div className="flex flex-wrap gap-2 px-4 pt-2">
                    {files.map(file => (
                        <div
                            key={file.id}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border ${file.status === 'success' ? 'bg-muted border-border' :
                                    file.status === 'error' ? 'bg-red-50 border-red-200 text-red-600' :
                                        'bg-blue-50 border-blue-200'
                                }`}
                        >
                            <span className="max-w-[100px] truncate">{file.name}</span>
                            <span className="text-muted-foreground text-[10px]">
                                ({(file.size / 1024).toFixed(1)}KB)
                            </span>
                            {file.status === 'uploading' && (
                                <span className="animate-pulse text-blue-500 text-[10px]">上传中...</span>
                            )}
                            {file.status === 'error' && (
                                <span className="text-[10px]">失败</span>
                            )}
                            {/* 删除按钮 */}
                            {file.status !== 'uploading' && (
                                <button
                                    onClick={() => removeFile(file.id)}
                                    className="ml-1 hover:text-destructive"
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <div className="flex justify-center rounded-2xl ">
                <Textarea
                    value={text}
                    onChange={handleInputChange}
                    placeholder={isRecording ? `录音中 ${recordingTime}s...` : "问问 Gemini..."}
                    rows={1} // 初始一行
                    className="border-none focus-visible:ring-0 resize-none overflow-hidden min-h-5"
                    disabled={isStreaming || isSending}
                />

                {isStreaming ? (
                    <Button onClick={handleStop} variant='destructive' size='icon' className="m-[8px] border-0">
                        <Square className="size-4"></Square>
                    </Button>) : text.length ? (
                        <Button
                            onClick={handleSend}
                            variant='outline'
                            className="m-[8px] text-gray-500 hover:text-gray-800 border-0"
                            disabled={isSending || isUploading}
                        >
                            {isSending ? (
                                <span className="animate-spin">⌛</span>
                            ) : (
                                <Send />
                            )}
                        </Button>) : null
                }

            </div>

            <div className="flex justify-between">
                <div className="m-2">
                    <DropdownMenu >
                        <DropdownMenuTrigger asChild >
                            <div className="flex flex-wrap items-center gap-2 ">
                                <Button variant="outline" className=" text-gray-400 hover:text-gray-500 border-0">
                                    <Plus className="size-5"></Plus>
                                </Button>
                            </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="text-gray-500  w-30 h-25 p-3">
                            <DropdownMenuItem className="focus:text-gray-700 text-base" onClick={openFilePicker} disabled={isUploading}>
                                <Link />
                                {isUploading ? '上传中...' : '文件上传'}

                            </DropdownMenuItem>
                            <DropdownMenuItem className="focus:text-gray-700 text-base mt-3">
                                <ImageUp />
                                图片上传
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <div className="flex mr-2">

                    <DropdownMenu >
                        <DropdownMenuTrigger asChild >
                            <div className="flex flex-wrap items-center gap-2 ">
                                <Button variant="outline" className="m-2 text-gray-500 hover:text-gray-700 border-0">
                                    <ChevronDown className="size-5"></ChevronDown>
                                </Button>
                            </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="text-gray-500 w-50 h-60 p-3">
                            <DropdownMenuLabel className="text-base">选择模式</DropdownMenuLabel>
                            <DropdownMenuItem className="focus:text-gray-700 ">
                                <Brain className="mt-[-20px]"></Brain>
                                <div className="flex flex-col p-2">
                                    <div className="text-base text-black">思考</div>
                                    <div className="text-nowrap mt-1.5">可以解决复杂问题</div>
                                </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <Sparkle className="mt-[-20px]"></Sparkle>
                                <div className="flex flex-col p-2">
                                    <div className="text-base text-black">快速</div>
                                    <div className="text-nowrap mt-1.5">可以快速回答问题</div>
                                </div>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    {/* 麦克风按钮 */}
                    <Button
                        variant={isRecording ? "destructive" : "outline"}
                        onClick={handleMicClick}
                        disabled={!isSupported || isStreaming || isSending}
                        className="border-0 mt-[8px] relative"
                        title={!isSupported ? '浏览器不支持语音' : isRecording ? '点击停止录音' : '点击开始录音'}
                    >
                        {isRecording ? (
                            <>
                                <Mic className="size-4 animate-pulse" />
                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-ping" />
                            </>
                        ) : (
                            <Mic className="size-4" />
                        )}
                    </Button>
                </div>

            </div>

            {/* 无会话提示 Dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <MessageSquare className="size-5" />
                            创建新会话
                        </DialogTitle>
                        <DialogDescription>
                            当前没有活跃的聊天会话，需要创建一个新会话来发送消息。
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-2 sm:justify-end">
                        <Button
                            variant="outline"
                            onClick={() => setShowDialog(false)}
                        >
                            取消
                        </Button>
                        <Button
                            onClick={handleCreateAndSend}
                            className="gap-2"
                        >
                            <Plus className="size-4" />
                            立即创建
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 新增：语音错误提示 Dialog */}
            <Dialog open={speechErrorDialog.open} onOpenChange={handleCloseErrorDialog}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" x2="12" y1="8" y2="12" />
                                <line x1="12" x2="12.01" y1="16" y2="16" />
                            </svg>
                            语音识别失败
                        </DialogTitle>
                        <DialogDescription className="pt-2">
                            {speechErrorDialog.message}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button onClick={handleCloseErrorDialog}>
                            知道了
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
