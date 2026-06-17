# Orchid

> ## 使用许可（必读 / READ FIRST）
>
> 本项目采用 **[PolyForm Noncommercial 1.0.0](./LICENSE)** 协议，**不是 MIT**。
>
> - ✅ **允许**：个人学习、爱好使用、研究、修改、非商业传播、公益/学校/政府使用
> - ❌ **禁止**（除非另行获得作者书面授权）：销售本软件或其修改版、打包进任何收费产品 / 付费服务 / SaaS、商业贴牌或二次包装售卖、移除/篡改/绕过软件内嵌的版本指纹标识
> - 📩 **商业授权**：到本仓库开 Issue，标题 `[Commercial License Request]`，说明使用场景
>
> ---
>
> **License notice (English):** This project is released under the
> **PolyForm Noncommercial License 1.0.0**, NOT MIT.
> Personal / hobby / educational / research / charitable use is permitted.
> Any commercial use — including resale, paid SaaS hosting, bundling into a
> paid product, white-label rebranding, or stripping the embedded build
> fingerprint — is prohibited without a separate written commercial license.
> For commercial licensing, open an Issue titled `[Commercial License Request]`.

[novel-craft](https://github.com/chaserr/novel-craft) 的桌面 GUI 同款。在 Mac / Windows 上打开就能用，支持 **OpenAI / Claude / DeepSeek** 三家 LLM 自由切换。

```
┌─────────────────────────────────────────────────────────────┐
│                       顶栏：项目操作 + 设置                  │
├──────────────┬─────────────────────────┬────────────────────┤
│              │                         │                    │
│   资料面板    │     章节编辑器           │    LLM Chat        │
│   (左 280)   │     (中 弹性)            │    (右 420)        │
│              │                         │                    │
│  RTK         │  CodeMirror 6           │  Provider 切换     │
│  小说大纲    │  Markdown + 自动保存     │  消息流式输出       │
│  章节大纲    │  Cmd/Ctrl+S 立即保存     │  RTK 自动注入       │
│  前情梳理    │                         │                    │
│  伏笔清单    │                         │                    │
│  经典语录    │                         │                    │
│  人物档案    │                         │                    │
│  写作技巧    │                         │                    │
│  审稿报告    │                         │                    │
│  章节文件    │                         │                    │
│              │                         │                    │
└──────────────┴─────────────────────────┴────────────────────┘
```

## 特性

- **三栏 IDE 布局**：项目资料 / 章节编辑 / LLM chat 一屏看全
- **三家 LLM 任意切换**：DeepSeek（默认）/ Claude / OpenAI（统一 streaming 接口）。**DeepSeek 是中文小说写作最易上手的——扫码注册 + 充值 5 元就能用**，Claude / OpenAI 需要去对应 platform 申请 key
- **API Key 走系统 keychain**：Mac Keychain / Windows Credential Manager 加密存储
- **复用 novel-craft 模板**：新建项目时从 [novel-craft](https://github.com/chaserr/novel-craft) 仓库读 RTK / 大纲 / 章节大纲 / 伏笔 / 语录 / 人物档案 等模板
- **RTK 自动注入 system prompt**：每次 chat 时自动把项目 RTK.md 拼进上下文
- **CodeMirror 6 markdown 编辑器**：原生支持 markdown 高亮 + 防抖自动保存 + Cmd/Ctrl+S
- **跨平台**：Mac (Apple Silicon + Intel) + Windows (x64)

## 下载安装包

最新发布版：https://github.com/chaserr/novel-craft-studio/releases/latest

- **Mac (Apple Silicon)**：下载 `Orchid-<version>-arm64.dmg`
- **Mac (Intel)**：下载 `Orchid-<version>-x64.dmg`
- **Windows**：下载 `Orchid-Setup-<version>.exe`

首次启动需要绕过 Gatekeeper（Mac） / SmartScreen（Windows）—— 本 app 未做代码签名（开源项目，签名需付费证书）：

- **Mac**：装好 .app 到 `/Applications/` 后，如果双击报「"Orchid"已损坏，无法打开。你应该将它移到废纸篓。」——**不是真损坏**，是 macOS 看到没苹果开发者签名一律打这个标。终端执行一行即可：

  ```bash
  xattr -cr /Applications/Orchid.app
  ```

  之后双击正常打开。如果 .app 还在 Downloads 等位置，把路径换成对应位置即可。

- **Windows**：SmartScreen 拦截后点"更多信息" → "仍要运行"。

## 从源码运行（开发者）

### 前提

- Node.js ≥ 18
- 已经 clone 一份 [novel-craft](https://github.com/chaserr/novel-craft) 到本地

### 安装与运行（开发模式）

```bash
git clone https://github.com/chaserr/novel-craft-studio.git
cd novel-craft-studio
npm install
npm run dev
```

### 首次启动

1. 自动弹出 Settings：
   - **novel-craft 仓库路径**：填本地 clone 的 novel-craft 目录绝对路径
   - **三个 API Key**：至少填一个（推荐 Claude）
2. 点"新建项目"：填书名 / 题材 / 目标读者 / 核心气质 / 主线人物 → 选目标目录 → 完成
3. 在右侧 chat 里说"写第 1 章"——LLM 会按 RTK.md 行动

## 打包

### Mac

```bash
npm run build:mac
# 产物：dist/Orchid-0.1.0-arm64.dmg
#       dist/Orchid-0.1.0-x64.dmg
```

**未代码签名**，首次启动时 Mac 会拒绝打开。处理：
- 方法 A：右键 dmg → 打开
- 方法 B：系统偏好设置 → 安全性与隐私 → 仍要打开

### Windows

```bash
# 在 Windows 机器上执行（macOS 打 Windows 包需额外配置）
npm run build:win
# 产物：dist/Orchid-Setup-0.1.0.exe
```

未代码签名，SmartScreen 会拦截。处理：点"更多信息" → "仍要运行"。

## 聊天模式：Ask / Edit / Agent

右栏「自由询问」聊天框输入区上方有 **Ask / Edit / Agent** 三模式切换。底层映射到 codex CLI 的 sandbox 权限和 prompt 指令前缀。

### 一句话区分

- **Ask**：你问我答，AI 给建议，**你自己决定要不要改文件**
- **Edit**：AI 围绕**当前打开的那个文件**给出完整修订版，下方出现「应用到 xxx」按钮
- **Agent**：把活儿全交给 AI，它读你项目里所有相关文件，**自己改了直接保存**

### 三模式对比

| 维度 | Ask | Edit | Agent |
|---|---|---|---|
| 核心区别 | 只回答，**不动文件** | 围绕当前文件给修订版 | 自主多步**读写项目文件** |
| codex CLI 沙箱 | `--sandbox read-only` | `--sandbox read-only` + 编辑指令 | `--sandbox workspace-write` + `cwd=projectRoot` |
| 可读取 | ✅ 项目内文件 | ✅ 项目内文件 | ✅ 项目内任意文件 |
| 可写入 | ❌ | ❌（用 Apply 按钮你来写）| ✅ 自动写盘 |
| AI 自主多步 | 单轮 | 单轮 | 多步：读 A → 改 B → 检查 C → 汇报 |
| 谁能用 | 所有 provider | 所有 provider | **仅 OpenAI + codex CLI**，其它 provider 自动降级到 Ask 行为 |

### 典型用法

**Ask** — 打开第 3 章后问："这一章节奏太慢，怎么办？"
→ AI 在聊天框里给建议，**你自己决定改不改**。

**Edit** — 打开第 3 章，写："把第 2 段砍到一半，章末换成跨场景叠加"
→ AI 在聊天框输出**完整的修订版第 3 章**（在一个 markdown 代码块里）
→ 下方出现「应用到 第3章.md」按钮，点了直接覆盖写盘 + 编辑器刷新

**Agent** — 写："读 RTK 和章节大纲，写第 5 章正文，并更新前情梳理和伏笔清单"
→ AI 自己去：读相关文件 → 写出 `第5章-XXX.md` → 改 `前情梳理.md` 追加 → 改 `伏笔清单.md` 标记 → 在聊天框汇报做了什么
→ 你只需要去左栏看新文件，决定**接不接受**它的改动

### 安全角度

- **Ask** 完全只读 → 不可能改坏项目
- **Edit** AI 只输出建议文本，**你点 Apply 才真写盘**（可控 + 可回看）
- **Agent** AI 可写盘 → 适合比较信任 AI 时用；不放心可以让它先用 Ask 给出计划，确认后再切 Agent

### 推理强度（低 / 中 / 高）

模式选择器旁边还有「低 / 中 / 高」三档，对应 codex 的 `model_reasoning_effort`：

- **低**：快、token 少 — 改字、回弹问答
- **中**：默认平衡
- **高**：慢但思考深 — 大纲、结构性问题

## 技术栈

| 层 | 选型 |
|----|------|
| 桌面框架 | Electron 32 |
| 构建 | electron-vite + Vite 5 |
| UI | React 18 + TypeScript + Mantine v7 |
| 状态 | Zustand |
| 编辑器 | CodeMirror 6 (`@uiw/react-codemirror`) |
| Markdown 渲染 | react-markdown + remark-gfm |
| LLM SDK | `openai` (兼 DeepSeek baseURL) + `@anthropic-ai/sdk` |
| Keychain | `keytar` |
| 打包 | `electron-builder` |

## 架构

```
src/
├── main/                  Electron 主进程
│   ├── index.ts           入口
│   ├── ipc/               IPC handlers
│   │   ├── keychain.ts    keytar 存取 + settings.json 持久化
│   │   ├── llm.ts         streaming 协调
│   │   ├── project.ts     新建/打开/扫描项目
│   │   └── files.ts       文件读写
│   └── llm/               Provider 适配层
│       ├── types.ts       统一 streamChat 接口
│       ├── openai.ts
│       ├── anthropic.ts
│       ├── deepseek.ts    (OpenAI SDK + 改 baseURL)
│       └── registry.ts
├── preload/
│   └── index.ts           contextBridge 暴露 typed API
├── renderer/              React UI
│   ├── App.tsx            三栏 AppShell
│   ├── components/
│   ├── stores/            Zustand: settings / project / chat
│   └── lib/
│       └── prompt.ts      组装 system prompt（RTK + 上下文）
└── shared/
    └── types.ts           主/渲染进程共享类型
```

## MVP 范围 vs 未来

### v0.1 已包含

- ✅ 项目新建（从 novel-craft templates 渲染）
- ✅ 项目打开 / 扫描 / 文件分类
- ✅ 章节 markdown 编辑器 + 自动保存
- ✅ 3 个 LLM provider streaming chat
- ✅ RTK.md 自动注入 system prompt
- ✅ API Key 系统 keychain 存储
- ✅ Mac + Windows 打包配置

### 未来版本

- ⏳ novel-craft 5 个 skill 一键触发按钮
- ⏳ 12 agent 角色面板切换
- ⏳ reference 内嵌侧栏
- ⏳ 伏笔清单 / 经典语录 / 人物档案的结构化可视化编辑
- ⏳ 多项目并行
- ⏳ 自动更新
- ⏳ 代码签名

## License

[PolyForm Noncommercial 1.0.0](./LICENSE) © 2026 chaser

非商业使用免费；商业使用须另行书面授权。详见 [LICENSE](./LICENSE) 与本 README 顶部「使用许可」段落。

每个 release 构建都会嵌入唯一的版本指纹（`BUILD_FINGERPRINT`），用于识别二次分发来源。请勿移除或篡改 —— 这是判定违规分发的关键证据。

---

## ☕ 如果这个仓库帮到了你

请我喝杯咖啡吧 ❤️

<table>
  <tr>
    <td align="center" width="33%">
      <b>支付宝</b><br/>
      <img src="./docs/sponsor/alipay.jpg" alt="Alipay" width="220" />
    </td>
    <td align="center" width="33%">
      <b>微信支付</b><br/>
      <img src="./docs/sponsor/wechat.jpg" alt="WeChat Pay" width="220" />
    </td>
    <td align="center" width="33%">
      <b>AI 网文沟通群</b><br/>
      <img src="./docs/sponsor/wechat-group.png" alt="WeChat Group" width="220" />
      <br/><sub>二维码每 7 天刷新一次</sub>
    </td>
  </tr>
</table>
