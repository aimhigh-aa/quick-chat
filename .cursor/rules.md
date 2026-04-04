quick-chat 项目编码行为规范
1. 核心原则：

拒绝过度工程（Over-engineering）：不要为了“以后可能存在的扩展性”去写复杂的抽象类、策略模式或多层接口（例如：禁止为了“防备以后换模型”而编写 BaseAIProvider 抽象类）。

拒绝过度封装：如果业务代码和 UI 代码严重耦合，可以提取独立的 Hooks 或纯函数。但如果逻辑简单，优先采用直接实现的扁平化代码（KISS 原则：Keep It Simple, Stupid）。

具体行为规范：

数据请求：优先在组件中直接写原生的 fetch。只有当同一个 fetch 逻辑在 3 个以上地方复用时，才提取成独立的 API 函数。

服务端逻辑：在 Next.js 的 route.ts 中，优先直接写 Prisma 查询或调用 AI SDK，不要为了隐藏底层细节而创建类似 DatabaseService 或 StreamManager 这样厚重的服务层类。

UI 与逻辑解耦：如果组件内的事件处理、状态管理超过 50 行，可以将其封装进一个自定义 Hook（如 useChatState），但这个 Hook 内部应该只包含纯粹的、当前的业务逻辑。

TypeScript
// app/api/chat/route.ts
// 直接在路由里处理流，不创建复杂的 StreamManager 类
const reader = aiResponse.body.getReader();
const stream = new ReadableStream({ ... });


2. 响应式流处理规范 (Fetch + ReadableStream)
规则: 必须手动处理原始 ReadableStream，确保对流的每一帧都有控制权。

服务端: 使用 TransformStream 或 new ReadableStream 构造响应。

客户端: 使用 response.body.getReader() 进行递归或循环读取。

数据结构: 传输过程中统一使用 Uint8Array 编码的文本，禁止在流中间传输复杂的二进制对象。

逻辑拆分:

POST 请求处理参数校验和数据库初始化。

Stream 内部处理 AI 调用和数据库最终状态更新。


3. 状态管理规范 (Zustand + Immer)
规则: 仅存储“必须全局共享”的状态（如当前对话列表、用户信息）。

局部状态优先: 单个输入框的 value 使用 useState。

Zustand 定义: 严禁在 Store 中写 UI 逻辑，只写数据变更。

示例:

TypeScript
// store/chat.ts
import { create } from 'zustand'

interface ChatState {
  messages: Message[]
  addMessage: (msg: Message) => void
  updateLastMessage: (content: string) => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  updateLastMessage: (content) => set((state) => {
    const last = state.messages[state.messages.length - 1]
    if (last) last.content += content
    return { messages: [...state.messages] }
  })
}))

4. 数据库规范 (Prisma + PostgreSQL)
规则: 严禁在前端直接操作数据库，所有数据库行为必须锁定在 server-side。

连接单例: 在 lib/prisma.ts 中实现单例，防止 Next.js 热更新导致连接溢出。

异步不阻塞: 记录 AI 响应时，应在流 close 之后或通过 waitUntil 执行，不要阻塞首字节返回（TTFB）。

命名: 数据库字段使用下划线 snake_case，Prisma 模型使用大驼峰 PascalCase。

5. UI 规范 (Shadcn UI + Tailwind)
规则: 必须保持 Shadcn UI 的原子性，禁止直接修改 components/ui 下的代码。

样式覆盖: 通过 className 和 cn() 工具函数进行样式定制。

响应式: 聊天窗口必须适配移动端，使用 flex-1 和 overflow-y-auto 处理长对话滚动。

禁止表情包: UI 文字描述和代码注释中禁止使用 ✅, ❌, 🚀 等表情。


6. Skills 调用与工程自动化
规则: 优先使用本地 Skills 路径下的工具进行代码生成、页面生成，重构和数据库迁移，保持工程一致
性。本地skills文件地址：C:\Users\12544\.claude\skills


7. 深度思考：编码前的“逻辑拆解”
要求： 在输出任何正式代码块之前，必须先以有序列表的形式陈述你的实现思路。

功能理解： 简述你对当前需求的理解。

技术路径： 说明你准备采用的技术方案（例如：使用哪个 Hook、哪个 CSS 类或特定的逻辑算法）。

边缘情况： 考虑可能出现的错误或特殊状态（如：空数据、加载中、移动端适配）。

步骤分解： 将编码过程拆分为 1, 2, 3 步，让我能预知代码的结构。

8. 代码注释：核心逻辑的“自解释”
要求： 代码不仅仅是运行的工具，更是沟通的媒介。请为函数和关键代码段添加注释：

函数级注释 (JSDoc)： 使用标准格式说明函数的功能、参数类型 (@param) 和返回值 (@returns)。

关键逻辑注释： 在复杂的条件判断、特殊的样式计算（如 cn() 中的逻辑）或副作用 (useEffect) 旁添加单行简短说明。

样式说明： 对于特殊的 Tailwind 类名组合（如你之前关心的 rounded-full 药丸形状），请注明其视觉目的。

9. 组件优先原则 (Component-First)
禁止使用原生标签：除非 Shadcn 库中没有对应组件，否则严禁使用原生 <button>, <input>, <select> 等。

自动导入路径：当需要新组件时，优先检查 @/components/ui 路径。如果该组件尚未安装，请提醒我运行 npx shadcn-ui@latest add [component]。

图标规范：统一使用 lucide-react 图标库，保持图标大小一致（通常为 size-4 或 size-5）。