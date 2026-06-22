/**
 * 去云推理引擎统一接口。
 *
 * 这是整个 App 的「算法接入点」。无论底层用占位逻辑、ONNX、TFLite 还是其它推理方式，
 * 业务层（界面）都只依赖这个接口，因此后续替换成真实模型时无需改动上层代码。
 *
 * 接入真实模型的步骤见 EngineProvider 的注释。
 */
export interface CloudRemovalEngine {
  /** 引擎名称，用于界面展示与区分当前是占位还是真实模型。 */
  readonly name: string;

  /**
   * 对输入的（含云）遥感图像进行去云处理，返回结果图。
   *
   * @param inputUri 含云原图的本地 uri（如相册选择得到的 file:// 地址）
   * @returns 去云结果图的本地 uri
   */
  removeCloud(inputUri: string): Promise<string>;
}
