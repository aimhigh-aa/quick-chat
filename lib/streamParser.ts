import type { Message } from "@/store/chat";

/**
 * 流式解析层 - 解析后的结构化数据块
 * @property content - 正文内容片段
 * @property reasoningContent - 思考过程内容片段
 */
export interface ParsedChunk {
  content: string;
  reasoningContent?: string;
}

/**
 * 流式回调接口
 * 用于将解析后的数据传递给消费方
 */
interface StreamCallbacks {
  /** 收到正文内容片段 */
  onChunk?: (content: string) => void;
  /** 收到思考过程内容片段 */
  onReasoningChunk?: (reasoningContent: string) => void;
  /** 流式输出结束 */
  onDone?: () => void;
  /** 发生错误 */
  onError?: (error: string) => void;
  /** 请求被取消 */
  onAbort?: () => void;
}

/**
 * 流式解析器
 * 职责：接收 SSE 原始数据 -> 解析缓冲区 -> 输出结构化块
 * 设计：解析与消费解耦，只负责解析不负责消费
 */
export class StreamParser {
  /** UTF-8 解码器 */
  private textDecoder: TextDecoder;

  /** 
   * SSE 解析缓冲区 
   * 用途：暂存不完整的 SSE 行，等待下一个数据块补全
   */
  private parseBuffer: string;

  constructor() {
    this.textDecoder = new TextDecoder("utf-8");
    this.parseBuffer = "";
  }

  /**
   * 将原始 SSE 数据推入解析缓冲区并解析
   * @param chunk - 原始 SSE 数据块
   * @returns 解析后的结构化块数组
   */
  pushToParseBuffer(chunk: string): ParsedChunk[] {
    // 1. 将新数据追加到解析缓冲区
    this.parseBuffer += chunk;

    // 2. 按行分割（保持未完整行在缓冲区）
    const lines = this.parseBuffer.split("\n");
    
    // 3. 最后一行可能是未完整的行，保留到缓冲区
    this.parseBuffer = lines.pop() || "";

    // 4. 解析完整的行
    const parsedChunks: ParsedChunk[] = [];
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6).trim();
        const parsed = this.parseLine(data);
        if (parsed) parsedChunks.push(parsed);
      }
    }
    return parsedChunks;
  }

  /**
   * 解析单行 SSE 数据
   * @param rawData - 原始 data 字段内容
   * @returns 解析后的块或 null
   */
  private parseLine(rawData: string): ParsedChunk | null {
    // 流结束标记
    if (rawData === "[DONE]") return null;

    try {
      const json = JSON.parse(rawData);
      
      // 业务级错误
      if (json.error) return null;

      const content = json.choices?.[0]?.delta?.content;
      const reasoningContent = json.choices?.[0]?.delta?.reasoning_content;

      // 无有效内容则跳过
      if (!content && !reasoningContent) return null;

      return { 
        content: content || "", 
        reasoningContent 
      };
    } catch {
      return null;
    }
  }

  /**
   * 重置解析缓冲区
   * 用途：在新的流式请求开始前清空状态
   */
  reset() {
    this.parseBuffer = "";
  }

  /**
   * 执行流式请求（内部使用解析缓冲区）
   * @param message - 用户消息
   * @param callbacks - 回调函数
   * @param signal - AbortSignal 用于取消请求
   */
  async fetchStream(
    message: Message,
    callbacks: StreamCallbacks,
    signal?: AbortSignal,
  ): Promise<void> {
    try {
      const response = await fetch("api/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: [{ role: "user", content: message.content }],
        }),
        signal,
      });

      if (!response.body) {
        callbacks.onError?.("响应体为空");
        return;
      }

      const reader = response.body.getReader();

      while (true) {
        // 检查是否已取消
        if (signal?.aborted) {
          callbacks.onAbort?.();
          return;
        }

        const { value, done } = await reader.read();
        if (done) {
          callbacks.onDone?.();
          break;
        }

        // 使用解析缓冲区解析数据
        const chunks = this.pushToParseBuffer(
          this.textDecoder.decode(value, { stream: true })
        );

        // 将解析后的块通过回调传递给消费方
        for (const chunk of chunks) {
          if (chunk.content) {
            callbacks.onChunk?.(chunk.content);
          }
          if (chunk.reasoningContent) {
            callbacks.onReasoningChunk?.(chunk.reasoningContent);
          }
        }
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        callbacks.onAbort?.();
        return;
      }
      const errorMessage = e instanceof Error ? e.message : String(e);
      callbacks.onError?.(errorMessage);
    }
  }
}