import sharp from "sharp";

export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_STORED_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export class ImageUploadError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// Content-Length만 믿지 않고 실제 스트림을 읽으면서 제한한다.
export async function readImageBody(request: Request): Promise<Buffer> {
  if (Number(request.headers.get("content-length")) > MAX_IMAGE_UPLOAD_BYTES)
    throw new ImageUploadError(413, "이미지는 10MB 이하로 선택해주세요.");
  if (!request.body) throw new ImageUploadError(400, "이미지 파일이 없습니다.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_IMAGE_UPLOAD_BYTES) {
        await reader.cancel();
        throw new ImageUploadError(413, "이미지는 10MB 이하로 선택해주세요.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (!size) throw new ImageUploadError(400, "빈 이미지 파일입니다.");
  return Buffer.concat(chunks, size);
}

export async function normalizeImage(input: Buffer) {
  const magic = input.subarray(0, 12);
  const supported =
    magic
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    magic.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ||
    ["GIF87a", "GIF89a"].includes(magic.subarray(0, 6).toString()) ||
    (magic.subarray(0, 4).toString() === "RIFF" &&
      magic.subarray(8, 12).toString() === "WEBP");
  if (!supported)
    throw new ImageUploadError(
      415,
      "PNG, JPEG, WebP, GIF 이미지만 사용할 수 있습니다.",
    );
  try {
    const { data, info } = await sharp(input, {
      limitInputPixels: 40_000_000,
      failOn: "error",
    })
      .rotate()
      .resize({
        width: 2560,
        height: 2560,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer({ resolveWithObject: true });
    if (data.length > MAX_STORED_IMAGE_BYTES)
      throw new ImageUploadError(
        413,
        "변환 후 이미지가 너무 큽니다. 더 작은 이미지를 선택해주세요.",
      );
    return {
      data,
      width: info.width,
      height: info.height,
      byteLength: data.length,
    };
  } catch (error) {
    if (error instanceof ImageUploadError) throw error;
    throw new ImageUploadError(
      400,
      "이미지를 읽을 수 없습니다. 손상되었거나 해상도가 너무 큰 파일입니다.",
    );
  }
}
