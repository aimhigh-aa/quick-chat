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
import { useEffect, useState } from "react"
import { useChatStore } from "@/store/chat"
import { StreamParser } from "@/lib/streamParser"
import type { Message } from "@/store/chat";
import { testChat } from "@/test/chatTest"
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition"
import { useFileUpload, UploadedFile } from '@/hooks/useFileUpload'

interface ChatInputProps {
    className?: string;
}
export const AppChatInput: React.FC<ChatInputProps> = ({ className = '' }) => {
    // 从 Store 获取状态和操作方法
    const { activeChatId, addMessage, addChat, appendMessageContent, appendReasoningContent, abortController, setAbortController, stopStreaming, isStreaming } = useChatStore()
    // 输入框文本状态
    const [text, setText] = useState("")
    // Dialog 显示状态
    const [showDialog, setShowDialog] = useState(false)
    //语音Dialog 显示状态
    const [speechErrorDialog, setSpeechErrorDialog] = useState<{ open: boolean, message: string }>({ open: false, message: "" })




    //使用语音识别hook
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

    //使用文件上传hook
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


    //监听语音错误
    useEffect(() => {
        if (speechError) {
            setSpeechErrorDialog({
                open: true,
                message: speechError
            })
        }
    }, [speechError])

    //关闭dialog回调
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
    const handleSend = () => {
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

        //创建 AbortController 
        const controller = new AbortController();
        setAbortController(controller)

        // 发送用户消息
        addMessage(activeChatId, 'user', textToUse)


        //生成一个预定义的AI消息ID
        const assistantMsgId = crypto.randomUUID();

        //创建空的AI消息占位符
        addMessage(activeChatId, 'assistant', '', assistantMsgId)

        // 启动流式请求
        const parser = new StreamParser()
        parser.fetchStream({ content: finalContent } as Message, {
            onChunk: (content) => {
                //利用消息ID更新AI消息
                appendMessageContent(assistantMsgId, content);
            },
            onReasoningChunk: (reasoningContent) => {
                // 追加思考内容
                appendReasoningContent(assistantMsgId, reasoningContent);
            },
            onDone: () => {
                console.log('流式输出结束');
                setAbortController(null);
                //TODO 将数据保存到数据库
            },
            onError: (error) => {
                console.error('流式输出错误:', error);
                appendMessageContent(assistantMsgId, `\n\n[错误]: ${error}`);
                setAbortController(null);
            },
            onAbort: () => {
                console.log('流式请求被取消');
            }
        }, controller.signal)

    }

    //中断按钮回调
    const handleStop = () => {
        stopStreaming()
    }

    /**
     * 处理立即创建会话并发送消息
     * 创建新会话后自动激活，然后发送当前输入的内容
     */
    const handleCreateAndSend = () => {
        // 创建新会话（addChat 会自动激活新会话）
        addChat({ title: text.slice(0, 20) || 'New Chat' })
        // 关闭 Dialog
        setShowDialog(false)
        // 获取新创建的会话 ID（在 addChat 后 activeChatId 已更新）
        const newChatId = useChatStore.getState().activeChatId
        // 发送消息
        if (newChatId) {
            addMessage(newChatId, 'user', text)
            setText("")
        }
    }
    return (
        <div className={`flex-col  hover:shadow-md rounded-xl transition-shadow w-[40vw] mb-3.5 shadow-sm border-2 border border-gray-200 ${className}`}>
            {/* 隐藏的文件输入框，用于触发文件选择 */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".txt,.md"
                multiple
                className="hidden"
            />

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
                    className="border-none focus-visible:ring-0 resize-none overflow-hidden min-h-5  "

                />

                {isStreaming ? (
                    <Button onClick={handleStop} variant='destructive' size='icon' className="m-[8px]  border-0">
                        <Square className="size-4"></Square>
                    </Button>) : text.length ? (
                        <Button onClick={handleSend} variant='outline' className="m-[8px] text-gray-500 hover:text-gray-800 border-0">
                            <Send />
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
                        disabled={!isSupported || isStreaming}
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