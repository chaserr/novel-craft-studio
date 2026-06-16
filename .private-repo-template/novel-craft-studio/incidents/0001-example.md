---
incident_id: 0001
status: example         # open | investigating | takedown_sent | resolved | dismissed
opened_at: 2026-06-16
suspect_name: "示例 AI 写作 SaaS"
suspect_url: "https://example.com/xxx"
suspect_pricing: "¥99/月"
extracted_fingerprint: "v0.3.1-67ab1234-9c4f8e21"
matched_release_tag: "v0.3.1"
contact_attempted: false
---

# Incident 0001 — example

> 这是一个模板。真实事件按编号递增（0002, 0003...）。请勿删除本示例文件，保留作为格式参考。

## 时间线

- **2026-06-16**：在某社群看到一款 "AI 校园小说写作助手 SaaS"，UI 与本项目高度相似。
- **2026-06-16**：注册试用，截图保存到 `evidence/0001/screenshots/`。
- **2026-06-16**：DevTools 拉取 system prompt，发现末尾含 `PROMPT_SIGNATURE_PHRASE` + 5 个零宽字符。
- **2026-06-16**：从 desktop 版安装包反查 fingerprint = `v0.3.1-67ab1234-9c4f8e21`，命中 `releases/token-ledger.md` 第 N 行 → 该 token 是 2026-05-20 v0.3.1 release 注入的。

## 证据清单（见 `evidence/0001/`）

- [ ] 落地页 + 定价页截图
- [ ] 注册流程截图
- [ ] 安装包 SHA256 与原始 release 对比
- [ ] system prompt 完整内容（含指纹字节）
- [ ] 主进程启动 banner 日志
- [ ] 收款渠道截图（支付宝/微信/Stripe）
- [ ] WHOIS / ICP 备案信息

## 接触尝试

> 商业授权 Issue 通道：未收到对应 `[Commercial License Request]`。

## 下一步

- [ ] 发邮件给运营方，要求 14 天内停止商用或购买授权
- [ ] 若无回应：参考 `legal/dmca-template.md` 向托管平台发 DMCA
- [ ] 中国境内主体：另走 12377 / 网信办举报
