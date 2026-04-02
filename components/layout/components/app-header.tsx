import { Badge } from "../../ui/badge"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOut } from "next-auth/react"
import { LogOut, User } from "lucide-react"

interface HeaderProps {
    className?: string;
}

/**
 * AppHeader 组件
 * 应用顶部导航栏，包含侧边栏触发器、AI模型标识和用户信息下拉菜单
 * 用户头像悬停显示退出登录选项
 */
export const AppHeader: React.FC<HeaderProps> = ({ className = '' }) => {
    /**
     * 处理退出登录
     * 调用 NextAuth signOut 并重定向到首页
     */
    const handleLogout = async () => {
        await signOut({ callbackUrl: '/' })
    }

    return (
        <div className={`flex items-center justify-between p-5 w-full border-b ${className}`}>
            <SidebarTrigger className="ml-[-20px] mt-[-40px]" />
            <Badge variant="secondary" className="w-1/4 h-10 text-sm">正在使用gemini</Badge>

            {/* 用户头像下拉菜单 */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Avatar className="w-12 h-12 cursor-pointer hover:opacity-80 transition-opacity">
                        <AvatarImage src="https://github.com/shadcn.png" />
                        <AvatarFallback>
                            <User className="w-6 h-6" />
                        </AvatarFallback>
                    </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem
                        onClick={handleLogout}
                        className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        退出登录
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}