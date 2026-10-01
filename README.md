# JSONL 预览器

一个无需构建步骤的开源 Chrome Manifest V3 扩展。点击工具栏图标打开独立预览页，支持粘贴 JSONL，或选择、拖入 `.jsonl`、`.ndjson`、`.jsonl.zstd`、`.jsonl.zst` 文件。文件始终留在浏览器本地。

## 安装与使用

1. 打开 `chrome://extensions`，开启「开发者模式」，点击「加载已解压的扩展程序」，选择本目录。
2. 点击扩展图标，在新标签页粘贴内容并按 `⌘/Ctrl + Enter`，或点击「打开文件」。也可以把文件拖到页面任意位置，看到放置提示后松开。
3. 左侧默认按行显示各自的字段摘要，适合字段不固定的 JSONL；需要跨行对比时可切换到「公共字段表」。搜索框可选择字段名（默认，包含嵌套键）、字段值或原始行；异常行始终按原文搜索。点击记录，在右侧展开 JSON 树、复制原始 JSON 或字段路径。长字符串可点「阅读全文」，在宽幅阅读视图中按原始换行查看和复制。

也可以直接用 `file://` 打开 `viewer.html` 试用：此时解析器在页面中分批运行，较大的文件可能短暂影响交互。通过扩展图标打开时仍使用独立 Worker。扩展本身不需要服务器、权限或联网。`vendor/fzstd.js` 是随扩展打包的 [fzstd 0.1.1](https://github.com/101arrowz/fzstd)，MIT 许可证见 `vendor/fzstd.LICENSE`。

## 设计与边界

- 扩展页面在 Web Worker 中分块读取；直接打开 HTML 时复用同一解析器并在页面中运行。zstd 通过流式解压器处理；UTF-8 解码可以跨块；每行单独 `JSON.parse`，坏行保留原始片段和行号。
- 表格只绘制当前视口附近的行。Worker 保存原始行，点击/滚动时才把可见行转成表格值，树节点按需展开。搜索在 Worker 中执行。
- 当前上限是 **256 MiB 解码后数据、100 万条有效记录、单行 400 万字符**。超长行会进入「异常行」，后续行继续解析。这些是内存保护阈值，不等于已经对接近阈值的文件做过性能承诺。粘贴内容本身仍需浏览器持有一份文本，搜索目前会线性扫描所有行。
- 「逐行预览」按每条记录自己的字段生成摘要，不依赖统一 schema；有 `type`、`event`、`kind` 或 `role` 时仅用它作概览标签，没有这些字段也能正常显示。「公共字段表」从前 1000 条有效记录中按出现频率选最多 6 个字段，完整记录可在树中查看。JSONL 每行可以是任意合法 JSON 值；空行忽略。
- `fzstd` 对压缩时使用超大回溯窗口的 zstd 文件有[已知限制](https://github.com/101arrowz/fzstd#considerations)。如果要稳定处理数 GB 文件、极高压缩级别、随机跳转和复杂筛选，需要磁盘索引或更完整的 WASM zstd 实现。
- 目前只处理用户主动选择的本地文件与粘贴内容；没有自动接管网页上的 JSONL 响应。

## 已有产品与是否值得做

截至 2026-09-30，普通 JSONL 预览已有多个方案：[JSONL Viewer 扩展](https://chromewebstore.google.com/detail/jsonl-viewer/phgkbdbkiamfpnkigmgmoegbfanidlia)提供本地文件、虚拟滚动、树与导出；[jsonlviewer.com](https://jsonlviewer.com/)提供粘贴/文件、搜索过滤和折叠；[OmniViewer](https://omniviewer.org/jsonl)也有本地 Worker 解析、记录和 schema 视图。这些是各产品公开页面的功能描述，未对它们做独立压力测试，也未确认是否支持 `.jsonl.zstd`。

因此仅做「JSONL 转树」差异很小。更明确的方向是：**压缩文件原生预览 + 日志分析工作流**，例如按嵌套路径筛选、时间轴、跨行 schema 漂移、错误上下文、超大文件随机访问。FeHelper 截图中的双栏、折叠树和节点复制适合单份 JSON；JSONL 还需要行级导航、坏行隔离和跨行比较。

技术难点主要是：压缩流无法像普通文本那样按行随机定位；复杂条件筛选会扫描大量行；几 GB 数据不能全部留在 Worker 内存；不可信 JSON 内容必须用文本节点渲染，不能插进 HTML。本版解决了流式读取、行级错误、界面不卡顿和本地 zstd 解压的基础链路，但尚未解决磁盘索引与超大文件随机访问。

## 验证

运行 `npm ci && npm test`。测试覆盖跨块 UTF-8、CRLF、空行、错误行、超长行恢复、搜索、zstd 流式解压，以及直接打开 HTML 时的解析器路径。扩展页面的示例记录、树展开与真实 `.jsonl.zstd` 文件此前已在浏览器中验证；直接打开 HTML 的新路径尚未做浏览器界面验收。

## 发布

运行 `npm run package:extension` 会验证 Manifest、图标、运行文件与权限声明，并生成 `dist/jsonl-preview-v0.1.0.zip`。ZIP 只包含扩展运行所需的文件；不用把整个 Git 仓库或 `node_modules` 上传到 Chrome Web Store。图标和商店宣传图的源脚本为 `scripts/generate-assets.py`（重新生成需要 Pillow）。

提交商店前还需从**真实安装的扩展**拍摄至少一张 1280×800 或 640×400 的界面截图，并在开发者后台填写商店文案、隐私实践、支持地址和 [隐私说明](PRIVACY.md) URL。文案与检查项见 [STORE_LISTING.md](STORE_LISTING.md)。开发者账户注册、截图审阅与最终发布需仓库所有者在 Chrome Web Store 后台完成。首次正式发布建议先用 private/trusted testers 做一次完整试用。

## 开源

项目使用 [MIT License](LICENSE)；打包的 `fzstd` 保留其 [MIT 许可证](vendor/fzstd.LICENSE)。欢迎通过 [Issues](https://github.com/YaoKaiLun/jsonl-preview/issues) 报告可复现的问题，贡献方式见 [CONTRIBUTING.md](CONTRIBUTING.md)。请勿上传包含真实个人信息或密钥的 JSONL 样本。
