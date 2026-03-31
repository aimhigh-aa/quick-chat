import { NextRequest, NextResponse } from 'next/server'

/**
 * 硅基流动 API 配置
 * 从环境变量读取密钥
 */
const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY
const SILICONFLOW_API_URL = 'https://api.siliconflow.cn/v1/audio/transcriptions'

/**
 * POST 处理音频识别请求
 * 接收前端上传的音频文件，调用硅基流动 API 返回识别文本
 */
export async function POST(request: NextRequest) {
  try {
    // 检查 API Key 配置
    if (!SILICONFLOW_API_KEY) {
      console.error('SILICONFLOW_API_KEY 未配置')
      return NextResponse.json(
        { error: '服务器配置错误，缺少 API Key' },
        { status: 500 }
      )
    }

    // 1. 接收上传的音频文件
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    
    if (!audioFile) {
      return NextResponse.json(
        { error: '未找到音频文件' },
        { status: 400 }
      )
    }

    // 2. 构建硅基流动 API 请求
    const apiFormData = new FormData()
    apiFormData.append('file', audioFile, 'recording.webm')
    apiFormData.append('model', 'FunAudioLLM/SenseVoiceSmall') // 或其他支持的模型
    // 可选参数：
    // apiFormData.append('language', 'zh') // 指定语言，可选：zh, en, ja 等
    // apiFormData.append('response_format', 'json') // 响应格式
    // apiFormData.append('temperature', '0') // 采样温度

    // 3. 调用硅基流动语音识别 API
    const response = await fetch(SILICONFLOW_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SILICONFLOW_API_KEY}`
        // 注意：不要手动设置 Content-Type，让 fetch 自动设置 multipart boundary
      },
      body: apiFormData
    })


    // 4. 处理响应
    if (!response.ok) {
      const errorData = await response.text()
      console.error('硅基流动 API 错误:', response.status, errorData)
      throw new Error(`API 请求失败: ${response.status}`)
    }

    const result = await response.json() //持续等待可读流完全到达后，转换为对象
    console.log('硅基流动 API 返回结果:', result)


    // 硅基流动返回格式：{ "text": "识别结果" }
    if (result.text) {
      return NextResponse.json({ 
        text: result.text,
        success: true 
      })
    } else {
      throw new Error('识别结果为空')
    }

  } catch (error) {
    console.error('语音识别处理错误:', error)

    const errorMessage = error instanceof Error ? error.message : String(error)
    //默认返回配置
    let errorText = '语音识别失败'
    let statusCode = 500

    if (errorMessage.includes('识别结果为空')) {
      errorText = '您的声音过小'
      statusCode = 200
    }else if(errorMessage.includes('API 请求失败')) {
      errorText = 'API 请求失败'
      statusCode = 500
    }
    
    return NextResponse.json(
      { 
        error: errorText, 
        details: errorMessage
      },
      { status: statusCode }
    )
  }
}
