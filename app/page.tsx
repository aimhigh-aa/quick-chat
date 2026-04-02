"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { OAuth2Login } from "@/features/auth/components/OAuth2Login"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import { signIn } from "next-auth/react"

/**
 * Landing 页面（首页）
 * 未登录用户显示产品介绍和登录选项
 * 已登录用户自动跳转到聊天页面
 */
export default function LandingPage() {
  const router = useRouter()
  const { status } = useSession()

  // 登录表单状态
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  /**
   * 监听认证状态变化
   * 已认证时自动跳转到聊天页面
   */
  useEffect(() => {
    if (status === "authenticated") {
      router.push("/layout")
    }
  }, [status, router])

  /**
   * 处理邮箱密码登录
   * @param e - 表单提交事件
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError("邮箱或密码错误")
      } else {
        // 登录成功，刷新页面获取 session
        window.location.reload()
      }
    } catch (err) {
      setError("登录失败，请重试")
    } finally {
      setIsLoading(false)
    }
  }

  // 加载中状态
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full grid md:grid-cols-2 gap-8 items-center">
        {/* 左侧：产品介绍 */}
        <div className="space-y-6">
          <h1 className="text-4xl font-bold text-gray-900">
            Quick Chat
          </h1>
          <p className="text-lg text-gray-600">
            AI 智能对话助手，让沟通更高效
          </p>
          <ul className="space-y-3 text-gray-600">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
              支持多种 AI 模型
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
              文件上传分析
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
              语音输入识别
            </li>
          </ul>
        </div>

        {/* 右侧：登录选项 */}
        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          <h2 className="text-2xl font-semibold text-center text-gray-800">
            欢迎使用
          </h2>

          {/* 登录错误提示 */}
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-md">
              {error}
            </div>
          )}

          {/* OAuth 登录按钮 */}
          <OAuth2Login />

          {/* 分隔线 */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">或使用邮箱登录</span>
            </div>
          </div>

          {/* 邮箱登录表单 */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder="邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full"
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full"
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? "登录中..." : "登录"}
            </Button>
          </form>

          {/* 注册链接 */}
          <p className="text-center text-sm text-gray-500">
            还没有账号？
            <a href="#" className="text-blue-600 hover:underline">
              立即注册
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
