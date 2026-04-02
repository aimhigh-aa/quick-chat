"use client"

import { useState } from "react"
import { OAuth2Login } from "../OAuth2Login"
import { signIn } from "next-auth/react"

interface LoginDialogProps {
  isOpen: boolean
  onClose: () => void
}

type TabType = "oauth" | "login" | "register"

export const LoginDialog: React.FC<LoginDialogProps> = ({
  isOpen,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("oauth")

  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [loginError, setLoginError] = useState("")
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const [regEmail, setRegEmail] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [regConfirmPassword, setRegConfirmPassword] = useState("")
  const [regName, setRegName] = useState("")
  const [regError, setRegError] = useState("")
  const [isRegistering, setIsRegistering] = useState(false)

  if (!isOpen) return null

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError("")
    setIsLoggingIn(true)

    try {
      const result = await signIn("credentials", {
        email: loginEmail,
        password: loginPassword,
        redirect: false,
      })

      if (result?.error) {
        setLoginError("邮箱或密码错误")
      } else {
        onClose()
        window.location.reload()
      }
    } catch (error) {
      setLoginError("登录失败，请重试")
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegError("")

    if (regPassword !== regConfirmPassword) {
      setRegError("两次密码输入不一致")
      return
    }

    setIsRegistering(true)

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: regEmail,
          password: regPassword,
          name: regName,
          confirmPassword: regConfirmPassword,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setRegError(data.error || "注册失败")
      } else {
        await signIn("credentials", {
          email: regEmail,
          password: regPassword,
          redirect: false,
        })
        onClose()
        window.location.reload()
      }
    } catch (error) {
      setRegError("注册失败，请重试")
    } finally {
      setIsRegistering(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
        >
          ✕
        </button>

        <div className="flex border-b">
          <button
            onClick={() => setActiveTab("oauth")}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === "oauth"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            社交登录
          </button>
          <button
            onClick={() => setActiveTab("login")}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === "login"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            邮箱登录
          </button>
          <button
            onClick={() => setActiveTab("register")}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === "register"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            注册
          </button>
        </div>

        <div className="p-6">
          {activeTab === "oauth" && (
            <div>
              <h3 className="text-lg font-semibold mb-4 text-center">
                选择登录方式
              </h3>
              <OAuth2Login />
            </div>
          )}

          {activeTab === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <h3 className="text-lg font-semibold text-center">邮箱登录</h3>

              {loginError && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-md">
                  {loginError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  邮箱
                </label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  密码
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoggingIn ? "登录中..." : "登录"}
              </button>
            </form>
          )}

          {activeTab === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <h3 className="text-lg font-semibold text-center">注册账号</h3>

              {regError && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-md">
                  {regError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  昵称
                </label>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  邮箱
                </label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  密码
                </label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  确认密码
                </label>
                <input
                  type="password"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isRegistering}
                className="w-full py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {isRegistering ? "注册中..." : "注册"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
