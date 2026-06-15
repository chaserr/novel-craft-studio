# novel-craft-studio

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
- **三家 LLM 任意切换**：OpenAI / Claude / DeepSeek（统一 streaming 接口）
- **API Key 走系统 keychain**：Mac Keychain / Windows Credential Manager 加密存储
- **复用 novel-craft 模板**：新建项目时从 [novel-craft](https://github.com/chaserr/novel-craft) 仓库读 RTK / 大纲 / 章节大纲 / 伏笔 / 语录 / 人物档案 等模板
- **RTK 自动注入 system prompt**：每次 chat 时自动把项目 RTK.md 拼进上下文
- **CodeMirror 6 markdown 编辑器**：原生支持 markdown 高亮 + 防抖自动保存 + Cmd/Ctrl+S
- **跨平台**：Mac (Apple Silicon + Intel) + Windows (x64)

## 快速开始

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
# 产物：dist/novel-craft-studio-0.1.0-arm64.dmg
#       dist/novel-craft-studio-0.1.0-x64.dmg
```

**未代码签名**，首次启动时 Mac 会拒绝打开。处理：
- 方法 A：右键 dmg → 打开
- 方法 B：系统偏好设置 → 安全性与隐私 → 仍要打开

### Windows

```bash
# 在 Windows 机器上执行（macOS 打 Windows 包需额外配置）
npm run build:win
# 产物：dist/novel-craft-studio-Setup-0.1.0.exe
```

未代码签名，SmartScreen 会拦截。处理：点"更多信息" → "仍要运行"。

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

[MIT](./LICENSE) © chaser
