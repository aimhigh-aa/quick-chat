import type { Message } from "@/store/chat";

interface StreamCallbacks {
  onChunk?: (content: string) => void; // 收到新片段
  onReasoningChunk?: (reasoningContent: string) => void;
  onDone?: () => void; // 流结束
  onError?: (error: String) => void; // 发生错误
}

export class StreamParser {
  // 1. 在这里显式声明属性及其类型
  private textDecoder: TextDecoder;
  private sseBuffer: string;

  constructor() {
    this.textDecoder = new TextDecoder("utf-8");
    this.sseBuffer = "";
  }

  async fetchStream(
    message: Message,
    callbacks: StreamCallbacks,
  ): Promise<void> {
    try {
      const response = await fetch("api/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: [{ role: "user", content: message.content }],
        }),
      });

      if (!response.body) {
        console.error("响应体为空，可能服务器没有返回任何流数据");
        return;
      }

      const reader = response.body.getReader();

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          callbacks.onDone?.();
          break;
        }

        const chunk = this.textDecoder.decode(value, { stream: true });
        console.log("收到碎片:", chunk);
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
      const errorMessage = e instanceof Error ? e.message : String(e);
      callbacks.onError?.(errorMessage);
    }
  }
}
