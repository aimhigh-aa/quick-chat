import { NextResponse } from "next/server"
import { withAuth } from "next-auth/middleware"

/**
 * Next.js Middleware 路由守卫
 * 基于 NextAuth.js 实现页面访问控制
 *
 * 路由规则：
 * 1. 已登录用户访问 / → 重定向到 /layout（聊天页面）
 * 2. 未登录用户访问 /layout/* → 重定向到 /
 * 3. / 首页允许所有人访问（landing 页面）
 */
export default withAuth(
  async function middleware(request) {
    const { pathname } = request.nextUrl
    const token = request.nextauth.token

    // 规则1：已登录用户访问首页，跳转到聊天页面
    // if (pathname === "/" && token) {
    //   return NextResponse.redirect(new URL("/layout", request.url))
    // }

    // 其他情况允许访问
    return NextResponse.next()
  },
  {
    callbacks: {
      /**
       * 授权校验回调
       * 返回 true 表示允许访问，false 表示未授权
       */
      authorized({ req, token }) {
        const { pathname } = req.nextUrl
        // 1. 如果访问的是首页 "/"，无条件放行（不管登没登录都让看）
        if (pathname === "/") {
          return true
        }

        // /layout/* 路由需要认证
        if (pathname.startsWith("/layout")) {
          return token !== null
        }

        // / 首页允许所有人访问
        return true
      },
    },
    pages: {
      // 未认证时重定向到首页（landing 页面）
      signIn: "/",
    },
  }
)

/**
 * Middleware 配置
 * matcher: 指定哪些路由需要经过中间件处理
 */
export const config = {
  matcher: ["/", "/layout/:path*"],
}
