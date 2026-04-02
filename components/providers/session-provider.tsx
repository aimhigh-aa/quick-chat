"use client"

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"
import { ReactNode } from "react"

/**
 * SessionProvider 客户端包装器
 * 解决 NextAuth SessionProvider 需要在客户端运行的问题
 * @param children - 子组件
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>
}
