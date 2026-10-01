# Chrome Web Store 提交资料

以下文案可用于首版商店条目，提交时应与最终扩展行为核对。

## 商店文案

名称：JSONL 预览器

简短说明：在浏览器本地预览 JSONL 与 JSONL.ZSTD，逐行查看结构、搜索内容并定位异常行。

详细说明：

> 打开或拖入 JSONL、NDJSON 与 JSONL.ZSTD 文件，也可以直接粘贴多行 JSON。逐行预览适合字段结构不一致的数据；公共字段表适合比较常见字段。点击任意记录查看可折叠的 JSON 树，长文本可在独立阅读视图中展开，异常行会显示原文和行号。支持按字段名、字段值或原始行内容搜索。所有解析和解压都在本机浏览器完成，文件内容不会发送给开发者。

类别建议：开发者工具。语言：中文。

## 隐私实践

- 单一用途：本地预览和检索用户主动提供的 JSONL 数据。
- 扩展声明权限：无；网站主机权限：无。
- 数据收集：无。数据传输：无。广告、分析和远程代码：无。
- 隐私政策 URL：`https://github.com/YaoKaiLun/jsonl-preview/blob/main/PRIVACY.md`
- 支持 URL：`https://github.com/YaoKaiLun/jsonl-preview/issues`
- 项目主页：`https://github.com/YaoKaiLun/jsonl-preview`

## 素材与发布检查

- [x] 扩展图标 16/48/128 px：`icons/`
- [x] 小型宣传图 440×280 px：`store/promo-440x280.png`
- [ ] 真实扩展截图至少 1 张，1280×800 或 640×400 px；使用脱敏示例，不展示私人日志。
- [ ] 在 Chrome Web Store 注册/验证开发者账户，填写列表、隐私实践和支持链接。
- [ ] 将 `npm run package:extension` 生成的 ZIP 上传后台；确认审核反馈。
- [ ] 在 Chrome 正式安装态复测文件选择、拖拽、粘贴、zstd、搜索、长文本和剪贴板。
- [ ] 首次可选择 private/trusted testers 验收，再由所有者决定公开发布。

商店后台的表单与图片要求可能变化，提交时以 [Chrome 官方图片要求](https://developer.chrome.com/docs/webstore/images)和[发布指南](https://developer.chrome.com/docs/webstore)为准。
