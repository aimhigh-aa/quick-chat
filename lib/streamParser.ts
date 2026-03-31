import type { Message } from "@/store/chat";

interface StreamCallbacks {
  onChunk?: (content: string) => void; // 收到新片段
  onReasoningChunk?: (reasoningContent: string) => void;
  onDone?: () => void; // 流结束
  onError?: (error: String) => void; // 发生错误
  onAbort?: () => void; // 请求被取消
}

export class StreamParser {
  // 1. 在这里显式声明属性及其类型
  private textDecoder: TextDecoder;
  private sseBuffer: string;
  private abortController: AbortController | null = null; // 用于取消请求

  constructor() {
    this.textDecoder = new TextDecoder("utf-8");
    this.sseBuffer = "";
  }

  async fetchStream(
    message: Message,
    callbacks: StreamCallbacks,
    signal?: AbortSignal, //取消信号
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
        console.error("响应体为空，可能服务器没有返回任何流数据");
        return;
      }

      const reader = response.body.getReader();

      while (true) {
        //检查是否取消
        if (signal?.aborted) {
          console.log("请求已被取消");
          return;
        }
        const { value, done } = await reader.read();
        if (done) {
          callbacks.onDone?.();
          break;
        }

        const chunk = this.textDecoder.decode(value, { stream: true });
        // console.log("收到碎片:", chunk);
        this.sseBuffer += chunk;
        const lines = this.sseBuffer.split("\n");
        this.sseBuffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();

            if (data === "[DONE]") {
              callbacks.onDone?.();
              return;
            }
            try {
              const json = JSON.parse(data);
              if (json.error) {
                const errorMessage = json.error;
                console.log("检测到业务级错误", errorMessage);
                callbacks.onError?.(errorMessage);
                return;
              }
              const content = json.choices?.[0]?.delta?.content;
              const reasoningContent =
                json.choices?.[0]?.delta?.reasoning_content;
              if (content) {
                callbacks.onChunk?.(content);
              }
              if (reasoningContent) {
                callbacks.onReasoningChunk?.(reasoningContent);
              }
            } catch (jsonError) {
              console.warn("SSE JSON parse error:", jsonError);
            }
          }
        }
      }
    } catch (e) {
      console.log(e);
      // 区分取消错误和其他错误
      if (e instanceof Error && e.name === "AbortError") {
        callbacks.onAbort?.();
        return;
      }
      const errorMessage = e instanceof Error ? e.message : String(e);
      callbacks.onError?.(errorMessage);
    }
  }
}
