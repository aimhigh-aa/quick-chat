import { Badge } from "../../ui/badge"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Avatar, AvatarImage, AvatarFallback, AvatarBadge } from "@/components/ui/avatar"
interface HeaderProps {
    className?: string;
}

export const AppHeader: React.FC<HeaderProps> = ({ className = '' }) => {
    return (
        <div className={`flex items-center justify-between p-5 w-full border-b ${className}`}>
            <SidebarTrigger className="ml-[-20px] mt-[-40px]" />
            <Badge variant="secondary" className="w-1/4 h-10 text-sm">正在使用gemini</Badge>
            <Avatar className="w-12 h-12">
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback>CN</AvatarFallback>
                <AvatarBadge className="bg-green-600 dark:bg-green-800" />
            </Avatar>
        </div>
    )
}