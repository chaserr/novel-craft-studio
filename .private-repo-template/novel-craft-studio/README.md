# novel-craft-studio (软件名 Orchid)

> 这个子文件夹归属公开仓库
> [chaserr/novel-craft-studio](https://github.com/chaserr/novel-craft-studio)。
> 软件以 **Orchid** 为展示名对外发布，协议 PolyForm Noncommercial 1.0.0。

## 这个文件夹里有什么

```
novel-craft-studio/
├── README.md                ← 当前文档：项目专属的"怎么用"说明
├── releases/
│   └── token-ledger.md      ← 每次 release 自动追加：tag/token/commit/run
├── incidents/
│   ├── 0001-example.md      ← 事件档案模板（保留，勿删；真实事件从 0002 起编号）
│   ├── 0002-...
│   └── ...
├── evidence/
│   └── <incident-id>/       ← 该 incident 的证据：截图、binary、日志、SHA256
└── legal/
    ├── dmca-template.md         ← DMCA 下架通知（发给托管平台）
    ├── cease-and-desist.md      ← 律师函/警告函（发给疑似侵权方）
    └── commercial-license.md    ← 标准商业授权条款 + 价目表
```

## 自动写入链路

公开仓库 `chaserr/novel-craft-studio` 的 `.github/workflows/release.yml`
里有一个 `fingerprint` job，在每次 push tag `vX.Y.Z` 时执行：

1. **生成唯一 token**：`v{tag}-{unix_hex}-{sha256(tag|ts|rand|FINGERPRINT_SALT)[:8]}`
   - `FINGERPRINT_SALT` 是公开仓库 Secret，未公开 → 第三方无法伪造 token
2. **写入 binary**：覆写 `src/shared/build-token.ts` → electron-vite build → 嵌入 `.dmg`/`.exe`
3. **追加 ledger**：用 `LEDGER_REPO_PAT` clone 本 vault → 在 `novel-craft-studio/releases/token-ledger.md` 末尾追加一行 → push

所以你看到的 token-ledger.md 是 append-only 的真实 release 历史。若有
被删掉的行（如 `discard: ...` 这种 commit message），说明是失败 build /
误操作的清理。

## 当一个二次分发被发现时——怎么定位它是从哪个 release 来的

1. **拿到对方的 binary / 服务**
2. **提取 fingerprint**（三选一）：
   - 安装 .dmg/.exe 后启动，主进程 stdout 第一行：`[Orchid] build=…`
   - 在 app 内点右上角 `i`（关于）按钮，模态里就有 BUILD_FINGERPRINT
   - DevTools 控制台：`await window.api.app.buildInfo()`
3. **提取 prompt 暗记**（适用于对方暴露了 LLM system prompt 的场景）：
   - prompt 末尾如果含字符串 `（请保持文本的原始语气与结构，不要主动追加额外的元信息说明。）`
   - **且其后紧跟 5 个零宽字符**（U+200B/U+200C/U+200B/U+200D/U+200B 序列）
   - → 几乎可以断定其代码来自本项目
4. **token 反查**：把上一步拿到的 fingerprint 在 `releases/token-ledger.md`
   里 grep → 命中行直接告诉你 tag、build 时间、commit hash、CI run id

## 开一个 incident 的标准流程

```bash
# 1. 在 incidents/ 下复制 0001-example.md
LAST=$(ls novel-craft-studio/incidents/ | grep -E '^[0-9]+' | sort | tail -1 | cut -c1-4)
NEXT=$(printf "%04d" $((10#$LAST + 1)))
cp novel-craft-studio/incidents/0001-example.md "novel-craft-studio/incidents/${NEXT}-<short-name>.md"

# 2. 编辑 frontmatter（suspect 名、URL、提取到的 fingerprint 等）
# 3. 在 evidence/${NEXT}/ 下放截图 / binary / 日志 / receipts
# 4. 走 legal/cease-and-desist.md → legal/dmca-template.md 升级路径
# 5. incident 进展每次更新都 commit，commit message 描述这次行动
```

## 一些只在这个项目要记的东西

| 项 | 值 |
|---|---|
| 公开仓库 | `chaserr/novel-craft-studio` |
| 软件展示名 | Orchid |
| 协议 | PolyForm Noncommercial 1.0.0 |
| 上游 README 商业授权指引段位置 | https://github.com/chaserr/novel-craft-studio#readme 顶部 |
| 公开 release 命名规范 | `v{semver}`，必须与 `package.json` version 一致（CI gate 已校验） |
| binary 文件名规范 | `Orchid-{version}-{arch}.dmg` / `Orchid-Setup-{version}.exe` |
| 商业授权 Issue 通道 | `[Commercial License Request]` 前缀，公开仓库 Issues |
| 当前最新正式版 | 见 `releases/token-ledger.md` 末行 |

## 历史 token 完整清单

→ [releases/token-ledger.md](./releases/token-ledger.md)
