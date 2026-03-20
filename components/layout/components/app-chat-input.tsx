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
import { Link, Plus, ImageUp, ChevronDown,Brain,Sparkle,Mic,Send, MessageSquare} from "lucide-react"
import { useState } from "react"
import { useChatStore } from "@/store/chat"
import {StreamParser} from "@/lib/streamParser"
import type { Message } from "@/store/chat";
import { testChat } from "@/test/chatTest"

interface ChatInputProps {
    className?:string;
}
export const AppChatInput: React.FC<ChatInputProps> = ({className=''})=> {
    // 从 Store 获取状态和操作方法
    const {activeChatId, addMessage, addChat,appendMessageContent} = useChatStore()
    // 输入框文本状态
    const [text,setText]=useState("")
    // Dialog 显示状态
    const [showDialog, setShowDialog] = useState(false)

    /**
     * 处理输入框内容变化
     */
    const handleInputChange=(e:React.ChangeEvent<HTMLTextAreaElement>)=>setText(e.target.value)

    /**
     * 处理发送消息
     * 如果没有活跃会话，弹出 Dialog 提示创建
     * 如果有活跃会话，直接发送消息
     */
    const handleSend=()=>{
        // 没有输入内容时不处理
        if (!text.trim()) return

        // 没有活跃会话时弹出提示
        if (!activeChatId) {
            setShowDialog(true)
            return
        }

        const textToUse = text
        setText("")

        // 发送用户消息
        addMessage(activeChatId,'user',textToUse)


        //生成一个预定义的AI消息ID
        const assistantMsgId = crypto.randomUUID();

        //创建空的AI消息占位符
        addMessage(activeChatId,'assistant','',assistantMsgId)

        // 启动流式请求
        const parser = new StreamParser()
        parser.fetchStream({content:textToUse} as Message,{
            onChunk:(content) => {
                //利用消息ID更新AI消息
                appendMessageContent(assistantMsgId,content);
            },
            onDone: () => {
                console.log('流式输出结束');
                //TODO 将数据保存到数据库
            },
            onError: (error) => {
                console.error('流式输出错误:', error);
                appendMessageContent( assistantMsgId, `\n\n[错误]: ${error}`);
            },
        })

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
            <div className="flex justify-center rounded-2xl ">
                <Textarea
                    value={text}
                    onChange={handleInputChange}
                    placeholder="问问 Gemini..."
                    rows={1} // 初始一行
                    className="border-none focus-visible:ring-0 resize-none overflow-hidden min-h-5  "

                />
                {text.length?(
                <Button onClick={handleSend} variant='outline' className="m-[8px] text-gray-500 hover:text-gray-800 border-0">
                    <Send />
                </Button>):null
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
                            <DropdownMenuItem className="focus:text-gray-700 text-base">
                                <Link />
                                文件上传

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
                    <Button variant="outline" className="border-0 mt-[8px]">
                        <Mic></Mic>
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
        </div>
    )
}