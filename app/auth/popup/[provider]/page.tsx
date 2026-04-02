"use client"

import { useEffect, useState } from "react"
import { signIn } from "next-auth/react"
import { useParams, useSearchParams } from "next/navigation"

/**
 * OAuth 弹窗回调页面
 * 用于在弹窗中完成 OAuth 认证流程
 * 通过 postMessage 与父窗口通信，实现无刷新登录
 *
 * 工作流程：
 * 1. 从 URL 获取 provider 和 state 参数
 * 2. 调用 NextAuth signIn 完成认证
 * 3. 通过 postMessage 通知父窗口登录结果
 * 4. 成功时关闭弹窗，失败时显示错误
 */
export default function OAuthPopupPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const provider = params.provider as string
  const [error, setError] = useState<string>("")

  // 从 URL 查询参数中获取 state 和回调地址
  const state = searchParams.get("state")
  const callbackUrl = searchParams.get("callbackUrl") || "/"

  /**
   * useEffect 副作用：页面加载后自动执行 OAuth 登录
   * 依赖项：[provider, state, callbackUrl]
   */
  useEffect(() => {
    if (!provider) return

    // 校验 state 是否存在，防止 CSRF 攻击
    if (!state) {
      setError("无效的认证请求")
      return
    }

    /**
     * 执行登录流程
     * 使用 redirect: false 获取登录结果，不自动跳转
     */
    const doSignIn = async () => {
      try {
        const result = await signIn(provider, {
          callbackUrl,
          redirect: false,
        })

        if (result?.error) {
          setError(result.error)
          // 向父窗口发送错误消息
          if (window.opener) {
            window.opener.postMessage(
              {
                type: "oauth-error",
                error: result.error,
                state
              },
              window.location.origin
            )
          }
        } else if (result?.ok) {
          // 向父窗口发送成功消息
          if (window.opener) {
            window.opener.postMessage(
              {
                type: "oauth-success",
                state
              },
              window.location.origin
            )
          }
          // 延迟关闭弹窗，确保消息发送完成
          setTimeout(() => window.close(), 500)
        }
      } catch (err) {
        setError("登录过程中发生错误")
        console.error(err)
      }
    }

    doSignIn()
  }, [provider, state, callbackUrl])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      {error ? (
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">登录失败</h2>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => window.close()}
            className="mt-4 px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
          >
            关闭窗口
          </button>
        </div>
      ) : (
        <div className="text-center">
          {/* 使用 CSS 动画的加载指示器 */}
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-lg font-medium">正在登录...</h2>
          <p className="text-gray-500 text-sm mt-2">请稍候，正在完成认证</p>
        </div>
      )}
    </div>
  )
}
