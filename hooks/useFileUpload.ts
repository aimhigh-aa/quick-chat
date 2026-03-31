import { useState, useRef, useCallback } from 'react'

export interface UploadedFile {
  id: string
  name: string
  type: string
  size: number
  content: string
  status: 'uploading' | 'success' | 'error'
  errorMessage?: string
}

interface UseFileUploadOptions {
  /** 上传成功回调 */
  onSuccess?: (file: UploadedFile) => void
  /** 上传失败回调 */
  onError?: (error: string) => void
}

export const useFileUpload = (options: UseFileUploadOptions = {}) => {
  const { onSuccess, onError } = options
  
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /**
   * 上传单个文件到后端
   */
  const uploadFile = useCallback(async (file: File, id: string): Promise<void> => {
    const formData = new FormData()
    formData.append('file', file)

    try {
      setFiles(prev => prev.map(f => 
        f.id === id ? { ...f, status: 'uploading' } : f
      ))

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '上传失败')
      }

      // 后端返回格式: { name, size, type, content }
      const uploadedFile: UploadedFile = {
        id,
        name: data.name,
        type: data.type,
        size: data.size,
        content: data.content,
        status: 'success'
      }

      setFiles(prev => prev.map(f => f.id === id ? uploadedFile : f))
      onSuccess?.(uploadedFile)

    } catch (error) {
      const message = error instanceof Error ? error.message : '上传失败'
      setFiles(prev => prev.map(f => 
        f.id === id ? { ...f, status: 'error', errorMessage: message } : f
      ))
      onError?.(message)
    }
  }, [onSuccess, onError])

  /**
   * 处理文件选择
   */
  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList?.length) return

    setIsUploading(true)

    const filesArray = Array.from(fileList)
    
    // 同时上传多个文件
    await Promise.all(filesArray.map(async (file) => {
      const id = crypto.randomUUID()
      
      // 先添加到列表（pending 状态）
      setFiles(prev => [...prev, {
        id,
        name: file.name,
        type: file.name.endsWith('.md') ? 'md' : 'txt',
        size: file.size,
        content: '',
        status: 'uploading'
      }])

      await uploadFile(file, id)
    }))

    setIsUploading(false)
    
    // 清空 input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [uploadFile])

  /**
   * 删除文件
   */
  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }, [])

  /**
   * 清空所有文件
   */
  const clearFiles = useCallback(() => {
    setFiles([])
  }, [])

  /**
   * 触发文件选择
   */
  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  return {
    files,
    isUploading,
    handleFiles,
    removeFile,
    clearFiles,
    openFilePicker,
    fileInputRef
  }
}
