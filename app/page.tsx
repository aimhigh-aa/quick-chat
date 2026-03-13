import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { AppMain } from "@/components/layout/app-main"

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
          <AppSidebar />
          <AppMain/>
      </div>
      
    </SidebarProvider>
  )
}