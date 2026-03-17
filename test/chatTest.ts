export const testChat = async () => {
  const response = await fetch("/api/chat", {
    method: "POST",
    body: JSON.stringify({
      messages: [{ role: "user", content: "你是谁？" }],
    }),
  });
  if (!response.body) {
    console.error("响应体为空，可能服务器没有返回任何流数据");
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  console.log("--- 开始接收流 ---");
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    console.log("收到碎片:", decoder.decode(value));
  }
  console.log("--- 流传输结束 ---");
};
