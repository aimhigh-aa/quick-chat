import { useSession, signOut } from "next-auth/react"
import { useCallback } from "react"

/**
 * 用户信息接口
 * @property id - 用户唯一标识
 * @property email - 用户邮箱
 * @property name - 用户昵称
 * @property image - 头像 URL
 */
export interface User {
  id: string
  email: string
  name: string | null
  image: string | null
}

/**
 * 认证状态接口
 * @property isAuthenticated - 是否已认证
 * @property user - 当前用户信息
 * @property isLoading - 是否正在加载认证状态
 * @property showLoginDialog - 是否应显示登录弹窗（未认证时）
 * @property logout - 登出函数
 */
export interface AuthState {
  isAuthenticated: boolean
  user: User | null
  isLoading: boolean
  showLoginDialog: boolean
  logout: () => Promise<void>
}

/**
 * 认证 Hook
 * 封装 NextAuth.js 的 useSession，提供统一的认证状态管理
 *
 * 使用示例：
 * const { isAuthenticated, user, logout } = useAuth()
 *
 * @returns AuthState - 认证状态和相关操作
 */
export const useAuth = (): AuthState => {
  const { data: session, status } = useSession()

  /**
   * 登出函数
   * 调用 NextAuth signOut，登出后跳转到首页
   */
  const logout = useCallback(async () => {
    await signOut({ callbackUrl: "/" })
  }, [])

  return {
    isAuthenticated: status === "authenticated",
    user: session?.user as User | null,
    isLoading: status === "loading",
    showLoginDialog: status === "unauthenticated",
    logout,
  }
}
