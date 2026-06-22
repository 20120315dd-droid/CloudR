import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode as jpegDecode, encode as jpegEncode } from 'jpeg-js';

import { CloudRemovalEngine } from './CloudRemovalEngine';

/** 处理时图像最长边的上限，超过则先缩小，避免纯 JS 像素处理过慢。 */
const MAX_SIDE = 1024;
/** 饱和度增强系数（>1 增强）。 */
const SATURATION = 1.25;

/**
 * 占位（Mock）去云引擎。
 *
 * ⚠️ 注意：这并不是真正的去云模型，只是一个临时实现。
 * 它通过「逐通道自动对比度拉伸 + 轻微饱和度增强」来模拟去云后的视觉效果
 * （含云/雾的遥感图通常发白、对比度低，这里把白雾压下去、把对比度和色彩还原回来），
 * 目的是先把整个流程（选图 → 处理 → 展示 → 保存）跑通。
 *
 * 后续请用你自己的模型实现 CloudRemovalEngine 接口来替换它，
 * 并在 EngineProvider 中切换返回值即可。
 */
export class MockCloudRemovalEngine implements CloudRemovalEngine {
  readonly name = 'Mock 去云（占位算法）';

  async removeCloud(inputUri: string): Promise<string> {
    // 1) 探测原图尺寸，决定是否需要缩小
    const probe = await ImageManipulator.manipulate(inputUri).renderAsync();
    const maxSide = Math.max(probe.width, probe.height);
    const scale = maxSide > MAX_SIDE ? MAX_SIDE / maxSide : 1;

    // 2) 规整为 JPEG（必要时缩小），便于纯 JS 解码处理
    const context = ImageManipulator.manipulate(inputUri);
    if (scale < 1) {
      context.resize({ width: Math.round(probe.width * scale) });
    }
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 1 });

    // 3) 读取并解码像素（RGBA）
    const bytes = await new File(saved.uri).bytes();
    const decoded = jpegDecode(bytes, { useTArray: true, formatAsRGBA: true });

    // 4) 去云占位处理
    const processed = this.enhance(decoded.data, decoded.width, decoded.height);

    // 5) 重新编码为 JPEG 并写入缓存目录
    const encoded = jpegEncode(
      { data: processed, width: decoded.width, height: decoded.height },
      92
    );
    const output = new File(Paths.cache, `cloudr_result_${Date.now()}.jpg`);
    output.create();
    output.write(encoded.data);
    return output.uri;
  }

  /** 自动对比度拉伸 + 饱和度增强。data 为 RGBA。 */
  private enhance(data: Uint8Array, width: number, height: number): Uint8Array {
    const count = width * height;
    const histR = new Int32Array(256);
    const histG = new Int32Array(256);
    const histB = new Int32Array(256);

    for (let i = 0; i < count; i++) {
      const o = i * 4;
      histR[data[o]]++;
      histG[data[o + 1]]++;
      histB[data[o + 2]]++;
    }

    const lutR = this.buildStretchLut(
      this.percentile(histR, count, 0.02),
      this.percentile(histR, count, 0.98)
    );
    const lutG = this.buildStretchLut(
      this.percentile(histG, count, 0.02),
      this.percentile(histG, count, 0.98)
    );
    const lutB = this.buildStretchLut(
      this.percentile(histB, count, 0.02),
      this.percentile(histB, count, 0.98)
    );

    const out = new Uint8Array(count * 4);
    for (let i = 0; i < count; i++) {
      const o = i * 4;
      let r = lutR[data[o]];
      let g = lutG[data[o + 1]];
      let b = lutB[data[o + 2]];

      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = this.clamp(gray + (r - gray) * SATURATION);
      g = this.clamp(gray + (g - gray) * SATURATION);
      b = this.clamp(gray + (b - gray) * SATURATION);

      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = 255;
    }
    return out;
  }

  private buildStretchLut(low: number, high: number): Uint8Array {
    const lut = new Uint8Array(256);
    const range = Math.max(1, high - low);
    for (let v = 0; v < 256; v++) {
      lut[v] = this.clamp(((v - low) * 255) / range);
    }
    return lut;
  }

  private percentile(hist: Int32Array, total: number, fraction: number): number {
    const target = Math.floor(total * fraction);
    let cumulative = 0;
    for (let v = 0; v < 256; v++) {
      cumulative += hist[v];
      if (cumulative >= target) return v;
    }
    return 255;
  }

  private clamp(value: number): number {
    if (value < 0) return 0;
    if (value > 255) return 255;
    return Math.round(value);
  }
}
