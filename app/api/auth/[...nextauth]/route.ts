import NextAuth from "next-auth"
import { authOptions } from "@/server/auth/auth"

/**
 * NextAuth.js 动态路由处理器
 * 捕获所有以 /api/auth 开头的请求
 * 统一由 NextAuth 处理登录、登出、回调等认证流程
 */
const handler = NextAuth(authOptions)

/**
 * 导出 HTTP 方法处理器
 * GET: 处理登录页面、会话查询等 GET 请求
 * POST: 处理登录凭证提交、OAuth 回调等 POST 请求
 */
export { handler as GET, handler as POST }
