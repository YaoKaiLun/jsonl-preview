# Chrome Web Store 提交资料

以下文案可用于首版商店条目，提交时应与最终扩展行为核对。

## 提交流程

1. 登录 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)。首次发布需要注册开发者账户、支付一次性注册费用，并验证联系邮箱。
2. 在本地正式安装态验收扩展；从**真实扩展界面**拍摄至少一张脱敏截图，尺寸为 1280×800 或 640×400 像素。本仓库已有 128 px 图标和 440×280 像素宣传图，见下方素材清单。
3. 首次上传时在后台点击 **Add new item**，选择仓库中的 [`dist/jsonl-preview-v1.0.0.zip`](dist/jsonl-preview-v1.0.0.zip)。如果已上传旧版草稿，在该项目的 **Package** 页选择 **Upload New Package**，上传 v1.0.0；不用新建第二个项目。不要上传源代码仓库的整体 ZIP。后续更新需增加 `manifest.json` 中的版本号并重新打包。
4. 填写 **Store Listing**（描述、类别、截图、宣传图、支持链接）、**Privacy**（单一用途、权限与数据处理声明）及 **Distribution**（公开、非公开链接或仅限测试者，以及发布地区）。下面的文案和隐私信息可直接作为起点，但提交前要与实际行为逐项核对。
5. 点击 **Submit for Review**。可以选择审核通过后自动发布，或暂缓发布并在审核通过后手动发布。遇到审核反馈时按后台提示修正，再上传新版包。

官方指引：[本地加载扩展](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked)、[注册账户](https://developer.chrome.com/docs/webstore/register/)、[首次发布](https://developer.chrome.com/docs/webstore/publish)、[图片规格](https://developer.chrome.com/docs/webstore/images)。

## 商店文案

名称：JSONL Viewer（由 Manifest 本地化消息提供，各语言一致）

简短说明：在浏览器本地预览 JSONL 与 JSONL.ZSTD，逐行查看结构、搜索内容并定位异常行。

详细说明：

> 打开或拖入 JSONL、NDJSON 与 JSONL.ZSTD 文件，也可以直接粘贴多行 JSON。逐行预览适合字段结构不一致的数据；公共字段表适合比较常见字段。点击任意记录查看可折叠的 JSON 树，长文本可在独立阅读视图中展开，异常行会显示原文和行号。支持按字段名、字段值或原始行内容搜索。所有解析和解压都在本机浏览器完成，文件内容不会发送给开发者。

类别建议：开发者工具。默认语言：英语；扩展界面另支持简体中文、繁体中文、日语、韩语、西班牙语、法语、德语和巴西葡萄牙语。商店详情说明若需按语言展示，还要在后台为各语言分别填写。

## 隐私实践

- 单一用途：本地预览和检索用户主动提供的 JSONL 数据。
- 扩展声明权限：无；网站主机权限：无。
- 用户主动提供的 JSONL 内容在浏览器中临时处理；开发者不接收文件或搜索词，也不做跨会话存储。数据传输：无。广告、分析和远程代码：无。即使只在本地处理，也需按后台要求披露。
- 隐私政策 URL：`https://github.com/YaoKaiLun/jsonl-preview/blob/main/PRIVACY.md`
- 支持 URL：`https://github.com/YaoKaiLun/jsonl-preview/issues`
- 项目主页：`https://github.com/YaoKaiLun/jsonl-preview`

## 素材与发布检查

- [x] 扩展图标 16/48/128 px：`icons/`
- [x] 小型宣传图 440×280 px：`store/promo-440x280.png`
- [x] 可上传的扩展包：`dist/jsonl-preview-v1.0.0.zip`
- [ ] 真实扩展截图至少 1 张，1280×800 或 640×400 px；使用脱敏示例，不展示私人日志。
- [ ] 在 Chrome Web Store 注册/验证开发者账户，填写列表、隐私实践和支持链接。
- [ ] 将仓库内的扩展 ZIP 上传后台；确认审核反馈。
- [ ] 在 Chrome 正式安装态复测文件选择、拖拽、粘贴、zstd、搜索、长文本和剪贴板。
- [ ] 首次可选择 private/trusted testers 验收，再由所有者决定公开发布。

商店后台的表单与图片要求可能变化，提交时以 [Chrome 官方图片要求](https://developer.chrome.com/docs/webstore/images)和[发布指南](https://developer.chrome.com/docs/webstore)为准。
