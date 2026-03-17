"use client"

import { AppChatInput } from "./components/app-chat-input"
import { AppHeader } from "./components/app-header"
import { AppChatBox } from "./components/app-chat-box"


export function AppMain() {
    return (
        <div className="flex-1  flex-col items-center relative">
            <AppHeader/>
            <main className="flex justify-center">
                <AppChatBox/>
            </main>
            <footer className="flex flex-col  absolute bottom-0 w-full items-center  justify-center ">
                <AppChatInput />
                <div className="mb-4">
                    <span className="text-s text-gray-500">quick-chat 是一款ai工具，其内容未必真实有效</span>
                </div>
            </footer>
        </div>

    )
}