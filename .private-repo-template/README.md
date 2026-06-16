# oss-defense-vault

> ⚠️ **PRIVATE.** 永不公开化、永不允许除作者外的协作者写入。

这是 **chaserr 名下所有公开开源项目的「反非法商业使用」中枢仓库**。它不
存任何项目源码，只存与维权、追溯、商业授权谈判相关的**私有元数据**：

- 每个 release 嵌入的唯一构建指纹（用于反查二次分发来源）
- 涉嫌违规商用的事件档案 + 证据物料
- DMCA / cease-and-desist / 商业授权合同等法律文档与往来记录

## 目录约定

```
oss-defense-vault/
├── README.md                          ← 你正在看的这份
├── .gitignore
└── <project-name>/                    ← 每个公开项目一个文件夹
    ├── README.md                      ← 该项目的"怎么用"说明（必读）
    ├── releases/
    │   └── token-ledger.md            ← CI 自动追加：tag → fingerprint 映射
    ├── incidents/
    │   ├── 0001-<short-name>.md       ← 每个疑似违规事件一份
    │   └── 0002-…
    ├── evidence/
    │   └── <incident-id>/             ← 该事件的证据（截图、binary、日志）
    └── legal/
        ├── dmca-template.md
        ├── cease-and-desist.md
        └── commercial-license.md
```

**文件夹名 = 公开仓库的名字**（不是软件展示名）。例如 Orchid 这款 app 的
公开仓库是 `chaserr/novel-craft-studio`，所以它的子文件夹就叫
`novel-craft-studio/`。

## 当前收纳的项目

| 项目文件夹 | 公开仓库 | 软件展示名 | 协议 |
|-----------|---------|-----------|------|
| [novel-craft-studio/](./novel-craft-studio/) | [chaserr/novel-craft-studio](https://github.com/chaserr/novel-craft-studio) | **Orchid** | PolyForm Noncommercial 1.0.0 |

未来新增项目时，复制 `novel-craft-studio/` 整个目录作为新项目的模板，改名
+ 改 README 即可。

## CI 自动写入

每个项目的公开仓库的 release workflow，在 build release 时会通过 `gh`
+ `LEDGER_REPO` secret 自动 clone 这个 vault → 在 `<project>/releases/
token-ledger.md` 追加一行 → push 回来。具体见各项目子 README 的「自动写
入链路」段。

## 安全约束

- ❌ 不要把任何 user 的反馈 / API key / 个人身份信息写进来
- ❌ 不要给协作者 read 权限（即便他们想帮忙处理 incident）
- ❌ 不要在 commit message / 文件名里暴露上游 repo 的私密 secret
- ❌ 不要把 `LEDGER_REPO_PAT` 的值写进任何 markdown 文件
- ✅ binary 哈希、URL、公开截图、法律文书草稿、token 值可以写
- ✅ 商业授权金额、对方公司名、邮件往来可以写（仍属于私有元数据）

## 备份

至少季度性 `git bundle create` 一份打包到离线存储（U 盘 / 加密压缩包
传 iCloud 等）。GitHub 跑路是小概率但代价极大。
