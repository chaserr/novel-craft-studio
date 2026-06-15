# Changelog

## [v0.1.0] - 2026-06-15

### 首次发布

- 三栏 IDE 布局：项目资料 / 章节编辑器 / LLM chat
- 支持 3 个 LLM provider streaming chat
  - **DeepSeek**（默认）—— 中文写作最易上手
  - **Claude (Anthropic)** —— 通过 API Key
  - **OpenAI** —— 通过 API Key
- API Key 走系统 keychain（Mac Keychain / Windows Credential Manager）
- 项目新建：从 [novel-craft](https://github.com/chaserr/novel-craft) plugin 仓库读模板，按字段渲染占位符
- 项目打开：自动扫描并按类别分组（RTK / 大纲 / 章节大纲 / 前情 / 伏笔 / 语录 / 人物档案 / 章节）
- CodeMirror 6 markdown 编辑器 + 防抖自动保存 + `Cmd/Ctrl+S` 立即保存
- system prompt 自动注入：项目 RTK.md + 当前章节上下文
- Mac (arm64 + x64) + Windows (x64) 跨平台打包
- GitHub Actions 自动构建 + 发布到 Releases

### Not in v0.1.0（未来版本）

- 5 个 skill 一键触发按钮
- 12 个 agent 角色切换面板
- reference 内嵌侧栏
- 结构化伏笔 / 语录 / 人物档案编辑面板
- 多项目并行 / 多窗口
- 自动更新
- 代码签名（用户首次启动需绕过 Gatekeeper / SmartScreen）
- 多语言（目前仅中文）
