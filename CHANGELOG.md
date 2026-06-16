# Changelog

## [v0.2.0] - 2026-06-16

> Orchid 的第一个正式版（原 novel-craft-studio）。重命名、协议变更、引入反盗版指纹。

### Rebrand & licensing

- 应用更名为 **Orchid**（原 `novel-craft-studio`），新增 app icon
- 协议从 **MIT** 改为 **PolyForm Noncommercial 1.0.0**
  - 允许：个人学习、研究、修改、非商业传播、公益/学校/政府使用
  - 禁止（除另行书面授权）：销售 / 付费 SaaS / 商业贴牌 / 二次包装售卖 / 移除指纹
- 顶栏新增 About 模态（`i` 按钮）：展示版本号、构建指纹、协议摘要、上游链接、商业授权入口

### Anti-misuse fingerprinting

- 每次 release 由 CI 注入唯一 `BUILD_FINGERPRINT`（含 release 私钥盐 hash）
- 嵌入位置：启动 banner、`app:build-info` IPC、所有 LLM system prompt（含 5 个零宽字符 + 可 grep 的诱饵句）
- 私有 ledger 仓库自动追加 `tag → token → commit → run_id` 映射，用于追溯二次分发来源

### Chat & workflow

- chat 改为复用 Codex CLI sessions（不再自建持久化）
- workflow subtask id 修复：UI 不再卡在"待执行"
- Codex v0.140+ batch output 解析适配

### CI

- release workflow 修复：先 `electron-vite build` 再 `electron-builder`
- 新增 git tag 必须等于 `v{package.json.version}` 的一致性 gate

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
