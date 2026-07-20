# CloudR · 云去除

> 上传一张含云 / 含雾的遥感（卫星）图像，一键输出去云后的基础图像，并可保存到相册。

CloudR 是一个基于 **Expo / React Native (TypeScript)** 的移动端应用。它的核心设计目标不是「实现某一个去云算法」，而是提供一套**算法可插拔**的端上推理骨架：UI、图像 I/O、权限、编解码等工程链路已经跑通，接入真实去云模型时只需替换一个引擎实现，上层代码零改动。

当前内置的是一个 **占位（Mock）引擎**，用传统图像处理近似去云的视觉效果，用于打通端到端流程与演示。

---

## 目录

- [核心特性](#核心特性)
- [技术栈](#技术栈)
- [架构设计](#架构设计)
- [去云处理流水线](#去云处理流水线)
- [占位算法说明](#占位算法说明)
- [工程要点与踩坑](#工程要点与踩坑)
- [快速开始](#快速开始)
- [接入真实去云模型](#接入真实去云模型)
- [目录结构](#目录结构)
- [校验与打包](#校验与打包)

---

## 核心特性

- **算法可插拔**：通过 `CloudRemovalEngine` 接口 + `EngineProvider` 工厂隔离算法与业务，替换模型只改一处。
- **纯端上处理**：图像不出设备，选图 → 处理 → 展示 → 保存全流程本地完成，无需网络与后端。
- **完整图像 I/O 链路**：封装了缩放、JPEG 编解码、像素级 RGBA 处理、缓存写盘、相册保存。
- **最小权限**：仅申请相册读写，主动 `blockedPermissions` 掉 media-library 默认携带的音频 / 视频权限。
- **类型安全**：全 TypeScript，`tsc --noEmit` 零报错。

---

## 技术栈

| 领域 | 选型 | 说明 |
|---|---|---|
| 框架 | Expo SDK ~56 / React Native 0.85 / React 19 | 标准独立 Expo 工程 |
| 语言 | TypeScript ~6 | 严格类型 |
| 图像变换 | `expo-image-manipulator` | 缩放 / 规整 / 编码为 JPEG |
| 文件系统 | `expo-file-system` | 读字节、写缓存文件（新 `File` / `Paths` API） |
| 编解码 | `jpeg-js` | 纯 JS JPEG 解码 → 得到 RGBA 像素 → 处理后再编码 |
| 相册 | `expo-image-picker` / `expo-media-library` | 选图与保存结果 |
| Polyfill | `buffer` | 为 `jpeg-js` 编码提供 RN 缺失的全局 `Buffer` |

---

## 架构设计

整个应用围绕一个「算法接入点」抽象来组织，界面层只依赖接口，不感知底层用的是占位逻辑、ONNX 还是 TFLite。

```
┌───────────────────────────────────────────────┐
│  App.tsx  （UI：选图 / 触发 / 展示 / 保存）      │
│    - 只调用 engine.removeCloud(uri)             │
└───────────────┬───────────────────────────────┘
                │ 依赖倒置：仅依赖接口
                ▼
┌───────────────────────────────────────────────┐
│  EngineProvider.create()  ← 唯一的算法切换点    │
└───────────────┬───────────────────────────────┘
                │ 返回
                ▼
┌───────────────────────────────────────────────┐
│  interface CloudRemovalEngine                   │
│    name: string                                 │
│    removeCloud(inputUri): Promise<string>       │
└───────────────┬───────────────────────────────┘
                │ 实现
    ┌───────────┴────────────┐
    ▼                        ▼
MockCloudRemovalEngine   OnnxCloudRemovalEngine（待接入）
（传统图像处理占位）      （ONNX Runtime 端上推理）
```

关键点：

- **依赖倒置**：`App.tsx` 通过 `EngineProvider.create()` 拿到一个 `CloudRemovalEngine`，全程只调用 `removeCloud(inputUri)`，对具体实现无感知。
- **单一切换点**：接入 / 切换模型只需修改 `src/engine/EngineProvider.ts` 的 `create()` 返回值，界面与流水线不动。
- **统一契约**：引擎输入输出都是本地图片 `uri`（`file://`），屏蔽了张量、编解码等实现细节，让 UI 与算法彻底解耦。

相关源码：

- 接口：`src/engine/CloudRemovalEngine.ts:9`
- 工厂：`src/engine/EngineProvider.ts:41`
- 占位实现：`src/engine/MockCloudRemovalEngine.ts:23`

---

## 去云处理流水线

`removeCloud(inputUri)` 内部是一条标准的「端上图像推理」流水线，真实模型接入时也复用同样的骨架（仅把第 4 步换成模型推理）：

```
inputUri (file://)
   │
   ├─ 1. 探测尺寸        ImageManipulator.manipulate(uri).renderAsync()
   │
   ├─ 2. 规整 / 缩放      最长边 > 1024 时按比例缩小，避免纯 JS 像素处理过慢
   │                      → saveAsync({ format: JPEG })
   │
   ├─ 3. 解码为像素       File(uri).bytes() → jpegDecode(..., formatAsRGBA)
   │                      得到 RGBA Uint8Array
   │
   ├─ 4. 去云处理         【当前：传统图像增强】/【未来：模型推理】
   │
   ├─ 5. 编码回 JPEG      jpegEncode({ data, width, height }, quality)
   │
   └─ 6. 写入缓存         File(Paths.cache, 'cloudr_result_*.jpg').write()
          │
          ▼
     outputUri (file://)  → UI 展示 → 可保存到相册
```

源码见 `src/engine/MockCloudRemovalEngine.ts:26`。

---

## 占位算法说明

> ⚠️ 当前引擎 **不是真正的去云模型**，只是让流程可运行、可演示的临时实现。

含云 / 含雾的遥感图通常表现为「整体发白、对比度低、色彩被稀释」。占位引擎用两步传统图像处理来近似「拨云见日」的视觉效果：

1. **逐通道自动对比度拉伸（Percentile Stretch）**
   对 R / G / B 分别统计直方图，取 2% ~ 98% 分位点作为拉伸区间，构建查找表（LUT）把该区间线性映射到 `0~255`。等效于把「白雾」压下去、把有效动态范围重新铺满整个色阶。

2. **饱和度增强**
   以亮度 `gray = 0.299R + 0.587G + 0.114B` 为锚点，按系数 `1.25` 放大每个像素与灰度的差值，恢复被雾稀释的色彩。

实现细节（直方图 / 分位数 / LUT / clamp）见 `src/engine/MockCloudRemovalEngine.ts:59` 起。

---

## 工程要点与踩坑

这些是把纯 JS 图像处理塞进 RN 运行时时容易踩的坑，已在代码中处理：

- **`Buffer` polyfill**：`jpeg-js` 编码依赖 Node 的全局 `Buffer`，而 RN 运行时默认没有。因此在应用最早期（`index.ts`）注入 `buffer` polyfill，必须先于任何编码调用。见 `index.ts:3`。
- **性能保护**：纯 JS 逐像素处理成本随分辨率线性增长，流水线在处理前把最长边限制到 `1024`，避免大图卡顿。
- **SDK 56 新 API**：
  - 图像变换用新的链式 `ImageManipulator.manipulate(uri).resize().renderAsync()` → `saveAsync()`（旧 `manipulateAsync` 已废弃）。
  - 文件读写用新的 `File` / `Paths` API（`new File(uri).bytes()` 读、`file.create()/write()` 写）。
  - 相册保存用 `Asset.create(uri)`（从主入口直接调用旧的 `saveToLibraryAsync` 会报错）。
- **最小权限**：`app.json` 用 `blockedPermissions` 去掉了 media-library 默认带的 `RECORD_AUDIO` / `READ_MEDIA_AUDIO` / `READ_MEDIA_VIDEO`，本应用只需图片权限。

---

## 快速开始

前置：Node ≥ 20、npm。

```bash
# 安装依赖
npm install

# 启动开发服务器
npm start
# 或直接指定平台
npm run android
npm run ios
```

启动后用手机 **Expo Go** 扫码即可实时预览（占位引擎为纯 JS，可在 Expo Go 中直接运行）。

---

## 接入真实去云模型

大多数遥感去云模型（如 SpA-GAN、STGAN、RSC-Net 等）用 PyTorch 训练，导出为 **ONNX** 后用 `onnxruntime-react-native` 端上推理是 RN / Expo 最通用的路线。

> ⚠️ `onnxruntime` 是**原生模块**，无法在 Expo Go 中运行，需要一次 **EAS development build**（或 `expo prebuild` 本地编译）。

步骤：

1. **安装依赖并切到 development build**
   ```bash
   npx expo install onnxruntime-react-native
   npx expo run:android   # 或 eas build --profile development
   ```

2. **放置模型**：把 `.onnx` 放进 `assets/models/`，用 `expo-asset` 解析出本地路径交给 `InferenceSession` 加载。

3. **实现引擎**：新建 `OnnxCloudRemovalEngine implements CloudRemovalEngine`，在 `removeCloud(inputUri)` 中完成：
   - **预处理**：缩放到模型输入尺寸（如 256×256），转成 NCHW `Float32` 张量，并按训练时方式归一化（`/255` 或 `[-1,1]`）。
   - **推理**：`const session = await InferenceSession.create(modelPath); const output = await session.run({ input: tensor });`
   - **后处理**：输出张量反归一化 → 转回像素 → 编码写文件 → 返回 `uri`。

4. **切换引擎**：把 `EngineProvider.create()` 的返回值改为 `new OnnxCloudRemovalEngine()`。界面层无需任何改动。

完整注释见 `src/engine/EngineProvider.ts:10`。

---

## 目录结构

```
CloudR/
├── App.tsx                         # 单屏 UI：选图 → 原图 → 一键去云 → 结果 → 保存
├── index.ts                        # 入口 + Buffer polyfill 注入
├── app.json                        # Expo 配置（权限、图标、插件）
├── src/
│   └── engine/
│       ├── CloudRemovalEngine.ts   # 去云引擎统一接口（算法接入点）
│       ├── EngineProvider.ts       # 工厂 / 唯一切换点
│       └── MockCloudRemovalEngine.ts  # 传统图像处理占位实现
└── assets/                         # 图标 / 启动图
```

---

## 校验与打包

```bash
# 类型检查
npx tsc --noEmit

# 查看解析后的 Expo 公共配置
npx expo config --type public

# 打包校验（Metro 能成功 bundle 即 OK；校验后可删除 dist）
npx expo export --platform android --output-dir dist

# 出 APK（EAS）
eas build -p android --profile preview
```
