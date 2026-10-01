# JSONL Viewer隐私说明

JSONL Viewer只处理你主动粘贴或选择、拖入的 JSONL 文件。解析、搜索、展示和 zstd 解压都在你的浏览器本地完成。扩展不向开发者或第三方服务器发送文件内容、搜索词或使用数据，也不添加分析、广告或远程脚本。

文件内容仅在当前预览页及其 Worker 的内存中使用。关闭页面后，扩展不会保留或同步内容；使用“复制”按钮时，只有你选定的文本会写入系统剪贴板。扩展不读取浏览历史、其他网页内容或未由你选择的文件。

当前版本不要求扩展权限。若未来版本改变数据处理方式，我们会先更新本说明及 Chrome Web Store 的隐私披露。

如有问题，请在 [GitHub Issues](https://github.com/YaoKaiLun/jsonl-preview/issues) 中反馈。请勿在公开 Issue 中粘贴敏感 JSONL 内容。
