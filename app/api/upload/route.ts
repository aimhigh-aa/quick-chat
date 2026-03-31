import { NextRequest, NextResponse } from "next/server";

/**
 * 允许上传的文件类型
 */
const ALLOWED_TYPES = ['text/plain', 'text/markdown'];
const ALLOWED_EXTENSIONS = ['.txt', '.md'];

/**
 * 最大文件大小：5MB
 */
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "未找到文件" }, { status: 400 });
    }

    //校验文件类型
    const fileName = file.name.toLowerCase();
    const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) =>
      fileName.endsWith(ext),
    );

    if (!hasValidExtension) {
      return NextResponse.json(
        { error: `不支持的文件类型，仅支持 ${ALLOWED_TYPES.join(",")}文件` },
        { status: 400 },
      );
    }

    //校验文件大小
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `文件大小超过限制，最大支持 ${MAX_SIZE / (1024 * 1024)}MB` },
        { status: 400 },
      );
    }

    //读取文件内容
    const arrayBuffer = await file.arrayBuffer();
    const content = new TextDecoder("utf-8").decode(arrayBuffer);

    //返回文件信息
    return NextResponse.json({
      name: file.name,
      size: file.size,
      type: fileName.endsWith(".md") ? "md" : "txt",
      content,
    });
  } catch (error) {
    console.error("文件上传错误:", error);
    return NextResponse.json(
      { error: "文件处理失败", details: String(error) },
      { status: 500 },
    );
  }
}
