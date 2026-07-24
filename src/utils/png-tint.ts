/**
 * PNG 着色工具：接收一张透明底、主体为白色的 PNG，将主体染成指定颜色。
 *
 * 基于 OffscreenCanvas 实现，不依赖 DOM，可同时在 service worker 与页面上下文中使用。
 * 原理：先绘制原图，再以 "source-in" 合成模式填充目标颜色，
 * 使颜色只覆盖非透明像素，同时完整保留原图的 alpha 通道（抗锯齿边缘不受影响）。
 */

/** 支持的图片来源：URL（含 dataURL / chrome.runtime.getURL 结果）、Blob 或已解码的 ImageBitmap */
export type PngSource = string | Blob | ImageBitmap;

/**
 * 将任意来源统一解码为 ImageBitmap
 * @param source 图片来源
 * @returns 解码后的 ImageBitmap
 */
async function toBitmap(source: PngSource): Promise<ImageBitmap> {
    if (source instanceof ImageBitmap) return source;
    const blob = typeof source === "string" ? await (await fetch(source)).blob() : source;
    return createImageBitmap(blob);
}

/**
 * 核心着色逻辑：在 OffscreenCanvas 上完成绘制与颜色合成
 * @param source 图片来源
 * @param color 目标颜色，任意合法 CSS 颜色值（如 "#ff6b35"、"rgb(255 107 53)"）
 * @returns 已完成着色的画布
 */
async function tintToCanvas(source: PngSource, color: string): Promise<OffscreenCanvas> {
    const bitmap = await toBitmap(source);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建 2D 绘图上下文");

    ctx.drawImage(bitmap, 0, 0);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    bitmap.close();
    return canvas;
}

/**
 * 着色并返回 ImageData（适用于 chrome.action.setIcon 等 API）
 * @param source 图片来源
 * @param color 目标颜色
 * @returns 着色后的像素数据
 */
export async function tintPngToImageData(source: PngSource, color: string): Promise<ImageData> {
    const canvas = await tintToCanvas(source, color);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建 2D 绘图上下文");
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * 着色并返回 PNG Blob（适用于下载、上传或 URL.createObjectURL）
 * @param source 图片来源
 * @param color 目标颜色
 * @returns 着色后的 PNG Blob
 */
export async function tintPngToBlob(source: PngSource, color: string): Promise<Blob> {
    const canvas = await tintToCanvas(source, color);
    return canvas.convertToBlob({ type: "image/png" });
}

/**
 * 着色并返回 dataURL（适用于 <img> src、CSS 背景等场景）
 * @param source 图片来源
 * @param color 目标颜色
 * @returns 形如 "data:image/png;base64,..." 的字符串
 */
export async function tintPngToDataUrl(source: PngSource, color: string): Promise<string> {
    const blob = await tintPngToBlob(source, color);
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error ?? new Error("读取 Blob 失败"));
        reader.readAsDataURL(blob);
    });
}
