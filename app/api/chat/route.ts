export const runtime = "edge";

export async function POST(req: Request) {
  const apiKey = process.env.XUNFEI_API_KEY;
  const apiSecret = process.env.XUNFEI_API_SECRET;
  const { messages } = await req.json();
  const token = `${apiKey}:${apiSecret}`;

  try {
    console.log('准备发送请求到 Xunfei API');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);// 30 秒超时

    console.log('token为：：',token)

    const aiResponse = await fetch(
      "https://spark-api-open.xf-yun.com/x2/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: "spark-x",
          messages,
          stream: true,
        }),
      },
    );

    clearTimeout(timeoutId);// 清除超时
    
    console.log('MaaS API 响应状态码:', aiResponse.status);
    if(!aiResponse.ok){
        throw new Error(`API 响应异常：${aiResponse.status}`);
    }

    console.log('API 响应成功');

    return new Response(aiResponse.body, {
      headers: {
        "content-type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e:any) {
    console.log('请求发生错误')
    const errorType = e.name === 'AbortError' ? '请求超时' : '流式请求失败';

    const errorResponse = `data:{ "error": "${errorType}: ${e.message}" }\n\ndata: [DONE]\n\n`;
    return new Response(errorResponse, {
      status: e.name === 'AbortError' ? 408 : 500,
      headers: {
        "content-type": "text/event-stream",
      },
    });

  }
}
