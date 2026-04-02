import { useState, useCallback, useEffect, useRef } from "react"

/**
 * useOAuthPopup Hook 返回值接口
 * @property loginWithProvider - 启动 OAuth 弹窗登录的函数
 * @property isProcessing - 是否正在处理登录流程
 */
interface UseOAuthPopupReturn {
  loginWithProvider: (provider: "google" | "github") => void
  isProcessing: boolean
}

/**
 * OAuth 弹窗登录 Hook
 * 封装 window.open + 轮询心跳 + postMessage + State 校验的完整流程
 *
 * 安全特性：
 * 1. CSRF 防护 - 使用随机 state 参数校验
 * 2. 弹窗死锁防护 - 500ms 心跳检测用户是否关闭弹窗
 * 3. 降级策略 - 弹窗被拦截时自动降级为全页跳转
 *
 * @returns UseOAuthPopupReturn - 登录函数和状态
 */
export const useOAuthPopup = (): UseOAuthPopupReturn => {
  const [isProcessing, setIsProcessing] = useState(false)
  const popupRef = useRef<Window | null>(null)
  const stateRef = useRef<string>("")
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * 生成随机 state 字符串
   * 用于 CSRF 防护，长度为 28 个字符的随机字符串
   * @returns string - 随机 state
   */
  const generateState = () => {
    return Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
  }

  /**
   * 清理资源
   * 清除定时器、重置状态，防止内存泄漏
   */
  const cleanup = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
    popupRef.current = null
    setIsProcessing(false)
  }, [])

  /**
   * useEffect: 监听来自弹窗的 postMessage 消息
   * 处理登录成功/失败的消息回调
   */
  useEffect(() => {
    /**
     * 处理 postMessage 消息
     * @param event - MessageEvent 对象
     */
    const handleMessage = (event: MessageEvent) => {
      // 安全校验：验证消息来源，防止 XSS 攻击
      if (event.origin !== window.location.origin) return

      const { type, state, error } = event.data

      // State 校验：防止 CSRF 攻击
      if (state !== sessionStorage.getItem("oauth_state")) {
        console.error("State 校验失败，可能的 CSRF 攻击")
        return
      }

      if (type === "oauth-success") {
        cleanup()
        window.location.reload()
      } else if (type === "oauth-error") {
        cleanup()
        console.error("OAuth 登录失败:", error)
        alert(`登录失败: ${error}`)
      }
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [cleanup])

  /**
   * 启动 OAuth 弹窗登录
   * @param provider - OAuth 提供商：google 或 github
   */
  const loginWithProvider = useCallback((provider: "google" | "github") => {
    // 生成 state 并存储到 sessionStorage 和 ref
    const state = generateState()
    stateRef.current = state
    sessionStorage.setItem("oauth_state", state)

    // 构建弹窗 URL，包含 state 和回调地址
    const callbackUrl = window.location.href
    const popupUrl = `/auth/popup/${provider}?state=${state}&callbackUrl=${encodeURIComponent(callbackUrl)}`

    // 计算弹窗居中位置
    const width = 500
    const height = 600
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2

    // 打开弹窗
    popupRef.current = window.open(
      popupUrl,
      "oauth-popup",
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
    )

    // 浏览器拦截检测：弹窗被拦截时 window.open 返回 null
    if (!popupRef.current) {
      console.log("弹窗被拦截，降级为全页跳转")
      window.location.href = `/api/auth/signin/${provider}?callbackUrl=${encodeURIComponent(callbackUrl)}`
      return
    }

    setIsProcessing(true)

    // 启动心跳检测（每 500ms 检查弹窗是否关闭）
    heartbeatRef.current = setInterval(() => {
      if (popupRef.current?.closed) {
        // 用户手动关闭弹窗，立即清理资源
        cleanup()
      }
    }, 500)

  }, [cleanup])

  return {
    loginWithProvider,
    isProcessing,
  }
}
