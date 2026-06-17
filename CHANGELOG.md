# Changelog

## [v0.3.1] - 2026-06-17

### Fixes

- **主题切换会误弹设置**：useEffect 拆开 + once guard，colorScheme 变化不再触发"首次启动弹设置"分支
- **dev / 打包后 dock 图标仍是 Electron 默认**：BrowserWindow.icon + `app.dock.setIcon(resolveIconPath())`；electron-builder 增加 `extraResources` 把 `resources/icon.png` 复制到 `Contents/Resources/`
- **Settings「默认 provider」与「provider 登录」分不清**：拆成 2 个带编号的 Section（① 默认 LLM Provider / ② 各 Provider 凭据），把「下面 tab 不会切换默认」的提示放到 alert 里

### Features

- **agent prompt 内置微调编辑器**：Settings 新增 12 个 agent 列表，每个可点编辑 → 弹 modal，左侧只读默认 prompt（来自 novel-craft），右侧可编辑覆盖；保存到 `<userData>/agents-overrides/<role>.md`；列表显示「已覆盖」徽章，一键重置
- workflow 读 agent prompt 的优先级链：**UI 覆盖** > 自定义 agents 目录 > novel-craft 默认
- 「自定义 agents 目录」字段保留为高级用法（适合作 fork + git 管理），不再是普通用户的入口

## [v0.3.0] - 2026-06-16

### 多项目 / Workspace

- **支持同时打开多个项目**：顶栏改成项目标签栏，点击切换 active；× 关闭单项目，剩余项目继续保留
- **历史打开记录**：欢迎页底部新增「最近打开」面板，最多 10 个，按上次打开时间倒序；支持「从列表移除」
- 历史记录持久化到 settings.json（同步关键字段：路径、书名、上次打开时间戳）

### 主题

- **亮色 / 暗色 / 跟随系统**三档可切换，顶栏 ☀ / 🌙 / 🖥 图标循环
- 偏好持久化到 settings.json，跨会话保留
- Markdown 预览样式改用 `light-dark()` CSS function 自适应

### Agent 自定义

- Settings 新增「自定义 agents 路径」字段
- 填写后，workflow 引擎读 agent system prompt 时优先查找 `<customAgentsPath>/<role>.md`
- 留空或文件不存在则 fallback 到 `novel-craft/agents/<role>.md` 默认
- 让你 fork / 微调 prompt 时不用复制整个 novel-craft 仓库

### 私有反商业仓库重组

- 私有 ledger 仓库重命名为 `oss-defense-vault`，按公开仓库名分子目录
- release.yml 的 ledger 路径动态派生自 `GITHUB_REPOSITORY`，让新项目无缝接入
- 加根 README + 项目子 README 说明 vault 用途与各子目录约定

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
