import { useState, useRef, useCallback, useEffect } from 'react'

/**
 * 录音状态类型
 */
type RecordingStatus = 'idle' | 'recording' | 'processing' | 'error'

/**
 * useSpeechRecognition Hook 返回值
 */
interface UseSpeechRecognitionReturn {
  /** 当前录音状态 */
  status: RecordingStatus
  /** 录音时长（秒） */
  recordingTime: number
  /** 识别结果文本 */
  transcript: string
  /** 错误信息 */
  error: string | null
  /** 开始录音 */
  startRecording: () => Promise<void>
  /** 停止录音 */
  stopRecording: () => void
  /** 清空识别结果 */
  clearTranscript: () => void
  /** 是否支持语音识别 */
  isSupported: boolean
}

/**
 * 语音识别 Hook
 * 封装 MediaRecorder 录音和讯飞后端识别逻辑
 * 
 * @param onTranscript - 识别成功的回调（可选）
 * @param maxDuration - 最大录音时长（秒），默认60
 * @returns Hook 返回值
 */
export const useSpeechRecognition = (
  onTranscript?: (text: string) => void,
  maxDuration: number = 60
): UseSpeechRecognitionReturn => {
  // 状态管理
  const [status, setStatus] = useState<RecordingStatus>('idle')
  const [recordingTime, setRecordingTime] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(true)

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  /**
   * 检查浏览器支持
   */
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setIsSupported(false)
      setError('当前浏览器不支持语音录音')
    }
  }, [])

  /**
   * 清理资源
   */
  const cleanup = useCallback(() => {
    // 停止计时器
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    // 停止 MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop()
      } catch (e) {
        // 忽略已停止的错误
      }
    }

    // 释放麦克风
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    mediaRecorderRef.current = null
  }, [])

  /**
   * 发送音频到后端识别
   */
  const sendAudioToServer = useCallback(async (audioBlob: Blob) => {
    setStatus('processing')

    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')

      const response = await fetch('/api/speech', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error(`识别请求失败: ${response.status}`)
      }

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      if (data.text) {
        setTranscript(data.text)
        onTranscript?.(data.text)
        setStatus('idle')
      } else {
        throw new Error('识别结果为空')
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '语音识别失败'
      setError(errorMessage)
      setStatus('error')
    }
  }, [onTranscript])

  /**
   * 开始录音
   */
  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError('当前浏览器不支持语音录音')
      return
    }

    // 清空之前的状态
    setError(null)
    setTranscript('')
    audioChunksRef.current = []

    try {
      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,  // 回声消除
          noiseSuppression: true,  // 降噪
          sampleRate: 16000        
        } 
      })
      
      streamRef.current = stream

      // 创建 MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm'
      })

      mediaRecorderRef.current = mediaRecorder

      // 收集音频数据
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      // 录音停止处理
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        sendAudioToServer(audioBlob)
      }

      // 错误处理
      mediaRecorder.onerror = () => {
        setError('录音设备错误')
        setStatus('error')
        cleanup()
      }

      // 开始录音
      mediaRecorder.start(100) // 每100ms收集一次
      setStatus('recording')
      setRecordingTime(0)

      // 开始计时
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= maxDuration - 1) {
            // 到达最大时长自动停止
            stopRecording()
            return maxDuration
          }
          return prev + 1
        })
      }, 1000)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '无法访问麦克风'
      setError(errorMessage)
      setStatus('error')
    }
  }, [isSupported, maxDuration, cleanup, sendAudioToServer])

  /**
   * 停止录音
   */
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && status === 'recording') {
      mediaRecorderRef.current.stop()
      // onstop 回调会处理后续发送逻辑
    }
    cleanup()
  }, [status, cleanup])

  /**
   * 清空识别结果
   */
  const clearTranscript = useCallback(() => {
    setTranscript('')
    setError(null)
  }, [])

  /**
   * 组件卸载时清理资源
   */
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return {
    status,
    recordingTime,
    transcript,
    error,
    startRecording,
    stopRecording,
    clearTranscript,
    isSupported
  }
}
