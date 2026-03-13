"use client"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Avatar, AvatarImage, AvatarFallback, AvatarBadge } from "@/components/ui/avatar"
import { ScrollArea } from "../ui/scroll-area"
import { Badge } from "../ui/badge"
import { Textarea } from "../ui/textarea"


export function AppMain() {
    return (
        <div className="flex-1  flex-col items-center relative">
            <header className="flex items-center justify-between p-5 w-full bg-amber-300">
                <SidebarTrigger className="ml-[-20px] mt-[-40px]" />
                <Badge variant="secondary" className="w-1/4 h-10 text-sm">正在使用gemini</Badge>
                <Avatar className="w-12 h-12">
                    <AvatarImage src="https://github.com/shadcn.png" />
                    <AvatarFallback>CN</AvatarFallback>
                    <AvatarBadge className="bg-green-600 dark:bg-green-800" />
                </Avatar>
            </header>
            <main className="flex justify-center">
                <ScrollArea className="bg-gray-50  w-[45vw]">
                    <div className="p-5">
                        <h1 className="text-3xl font-bold">Hello world</h1>
                    </div>
                </ScrollArea>
            </main>
            <footer className="flex flex-col  absolute bottom-0 w-full items-center  justify-center ">
                <div className="flex-col  hover:shadow-md rounded-xl transition-shadow w-[40vw] mb-3.5 shadow-sm border-2 border border-gray-200">
                    <div className="flex justify-center rounded-2xl ">
                        <Textarea
                            placeholder="问问 Gemini..."
                            rows={1} // 初始一行
                            className="border-none focus-visible:ring-0 resize-none overflow-hidden min-h-5 bg-amber-300"
                            onInput={(e) => {
                                const target = e.currentTarget;
                                target.style.height = "auto"; // 让 scrollHeight 重新计算
                            }}
                        />
                    </div>
                    <div>

                    </div>
                </div>
            </footer>
        </div>

    )
}