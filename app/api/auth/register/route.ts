import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

/**
 * 用户注册 API 路由
 * POST /api/auth/register
 * 接收邮箱、密码、昵称，创建新用户账号
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password, name, confirmPassword } = await request.json()

    // 必填字段校验
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "请填写所有必填字段" },
        { status: 400 }
      )
    }

    // 邮箱格式正则校验
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "邮箱格式不正确" },
        { status: 400 }
      )
    }

    // 密码长度校验（至少6位）
    if (password.length < 6) {
      return NextResponse.json(
        { error: "密码至少需要6位" },
        { status: 400 }
      )
    }

    // 确认密码一致性校验
    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "两次密码输入不一致" },
        { status: 400 }
      )
    }

    // 检查邮箱是否已被注册
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "该邮箱已注册" },
        { status: 400 }
      )
    }

    // 使用 bcrypt 对密码进行加密（salt rounds = 10）
    const hashedPassword = await bcrypt.hash(password, 10)

    // 创建新用户，自动标记邮箱已验证
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        emailVerified: new Date(),
      },
    })

    return NextResponse.json(
      {
        success: true,
        message: "注册成功",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        }
      },
      { status: 201 }
    )

  } catch (error) {
    console.error("注册错误:", error)
    return NextResponse.json(
      { error: "注册失败，请重试" },
      { status: 500 }
    )
  }
}
