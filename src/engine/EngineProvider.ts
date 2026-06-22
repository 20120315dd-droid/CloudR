import { CloudRemovalEngine } from './CloudRemovalEngine';
import { MockCloudRemovalEngine } from './MockCloudRemovalEngine';

/**
 * 去云引擎的统一获取入口（工厂）。
 *
 * 当前返回 MockCloudRemovalEngine 占位实现。整个 App 只在这里决定用哪个引擎，
 * 因此接入真实模型时你只需要改这一处。
 *
 * ============================================================================
 * 如何接入你自己的去云模型（推荐 onnxruntime-react-native）
 * ----------------------------------------------------------------------------
 * 大多数遥感去云模型（如 SpA-GAN、STGAN、RSC-Net 等）都用 PyTorch 训练，
 * 导出为 ONNX 后用 onnxruntime-react-native 推理是 RN/Expo 端最通用的路线。
 *
 * 注意：onnxruntime 是「原生模块」，无法在 Expo Go 里直接运行，
 *      需要用 EAS 做一次 development build（或 prebuild 本地编译）后才能调试。
 *
 * 步骤：
 * 1) 安装依赖：
 *        npx expo install onnxruntime-react-native
 *    并确保使用 development build（npx expo run:android 或 eas build --profile development）。
 *
 * 2) 把导出的 .onnx 模型放进 assets，并在代码里加载：
 *        例如放到 assets/models/cloud_removal.onnx，
 *        用 expo-asset 解析出本地路径后交给 InferenceSession 加载。
 *
 * 3) 新建一个类实现 CloudRemovalEngine，例如 OnnxCloudRemovalEngine，
 *    在 removeCloud(inputUri) 中完成：
 *        - 预处理：把图片缩放到模型输入尺寸（如 256x256），
 *                  转成 NCHW Float32 张量并按训练时的方式归一化（如 /255 或 [-1,1]）
 *        - 推理：const session = await InferenceSession.create(modelPath);
 *                const output = await session.run({ input: tensor });
 *        - 后处理：把输出张量反归一化、转回图片像素，编码写文件，返回 uri
 *
 * 4) 把下面 create() 的返回值改成你的实现：
 *        return new OnnxCloudRemovalEngine();
 *    界面层无需任何改动。
 * ============================================================================
 */
export const EngineProvider = {
  create(): CloudRemovalEngine {
    return new MockCloudRemovalEngine();
    // 接入真实模型后改为：
    // return new OnnxCloudRemovalEngine();
  },
};
