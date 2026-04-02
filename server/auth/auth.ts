import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/**
 * NextAuth.js 配置选项
 * 定义认证 providers、回调函数、会话策略等核心配置
 * 支持 OAuth (Google/GitHub) 和 Credentials (邮箱/密码) 两种认证方式
 */
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  providers: [
    /**
     * Google OAuth Provider
     * 配置 Google 登录，使用弹窗方式选择账号
     * access_type: offline 允许获取刷新令牌
     */
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code",
        },
      },
      httpOptions: {
        timeout: 10000,
      },
    }),

    /**
     * GitHub OAuth Provider
     * 配置 GitHub 登录
     * prompt: consent 确保每次都请求授权
     */
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
        },
      },
      httpOptions: {
        timeout: 10000,
      },
    }),

    /**
     * Credentials Provider
     * 邮箱/密码登录实现
     * 使用 bcrypt 进行密码加密比对
     */
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
      },
      /**
       * 授权验证函数
       * @param credentials - 用户提交的邮箱和密码
       * @returns 用户对象（成功）或抛出错误（失败）
       */
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("请输入邮箱和密码");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) {
          throw new Error("用户不存在");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password,
        );

        if (!isPasswordValid) {
          throw new Error("密码错误");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],



  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },

  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7天有效期
  },

  callbacks: {
    /**
     * 登录回调
     * 处理 OAuth 账号关联逻辑：
     * 1. 检查邮箱是否已存在其他账号
     * 2. 如存在，自动关联到同一用户（避免重复注册）
     * 3. 如不存在，NextAuth 会自动创建新用户
     */
    async signIn({ user, account }) {
      if (account?.provider !== "credentials" && user.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
          include: { accounts: true },
        });

        if (existingUser) {
          const hasLinkedAccount = existingUser.accounts.some(
            (acc) =>
              acc.provider === account?.provider &&
              acc.providerAccountId === account.providerAccountId,
          );

          // 若未关联此 OAuth 账号，自动创建关联
          if (!hasLinkedAccount) {
            await prisma.account.create({
              data: {
                userId: existingUser.id,
                type: account?.type || "oauth",
                provider: account?.provider || "",
                providerAccountId: account?.providerAccountId || "",
                access_token: account?.access_token,
                refresh_token: account?.refresh_token,
                expires_at: account?.expires_at,
                token_type: account?.token_type,
                scope: account?.scope,
                id_token: account?.id_token,
              },
            });
          }

          // 将用户 ID 指向已存在的账号，避免创建重复用户
          user.id = existingUser.id;
        }
      }

      return true;
    },

    /**
     * JWT 回调
     * 在 JWT 令牌中注入用户 ID
     * 用于后续 session 回调中获取用户标识
     */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },

    /**
     * Session 回调
     * 从 JWT 令牌中提取用户 ID，注入到 session 对象
     * 使前端可以通过 useSession 获取到 user.id
     */
    async session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
  },

  events: {
    /**
     * 登录事件
     * 新用户首次登录时自动标记 emailVerified
     * OAuth 用户无需额外验证邮箱
     */
    async signIn({ user, isNewUser }) {
      if (isNewUser && user.email) {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: new Date() },
        });
      }
    },
  },
};
