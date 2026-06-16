# Cease & Desist Letter Template (中英对照)

> 比 DMCA 更轻，适合先礼后兵。给运营方邮箱发一份，14 天内无回应再升级。
> 保留副本到 `evidence/<incident-id>/cease-and-desist-sent.md`。

---

主题 / Subject: **【法律通知】关于 {{suspect_name}} 涉嫌违规商用 Orchid**

{{recipient_name}} 您好，

我是开源项目 **Orchid** 的版权人（项目地址：
https://github.com/chaserr/novel-craft-studio ）。该项目以
**PolyForm Noncommercial License 1.0.0** 协议发布，明确禁止任何形式的
商业使用 / 商业贴牌 / 付费 SaaS 托管，除非另行获得书面授权。

经核实，您运营的 **{{suspect_name}}**（{{suspect_url}}）使用了本项目的
代码与资源，并以付费方式向终端用户提供服务（{{suspect_pricing}}）。
关键证据：您产品分发的程序中嵌有本项目的版本指纹
`{{extracted_fingerprint}}`，与我于 {{build_timestamp}} 发布的 release
（tag `{{matched_release_tag}}`）唯一对应。该指纹由 CI 在 release 构建时
注入，外部无法伪造。

因此请您于 **{{deadline_date}}** 前选择以下一种方案：

1. **停止使用**：下架 {{suspect_name}} 产品中所有由本项目衍生的部分，
   并以邮件 / 公告形式书面确认；
2. **取得授权**：联系我商谈商业授权（费率与服务条款见
   `commercial-license.md`），双方签署书面协议后方可继续运营。

逾期未回应或继续运营，我将：
- 向 {{hosting_platform}} 提交 DMCA 下架请求；
- 向 {{app_store / payment_provider}} 提交侵权举报；
- 视情况向有管辖权的法院提起诉讼，主张停止侵权、赔偿损失及合理维权费用。

期望以协商方式解决，请尽快回复。

此致

{{your_name}}（Orchid 版权人）
邮箱：{{your_email}}
日期：{{date}}

---

## English version (for international recipients)

To whom it may concern at {{suspect_name}},

I am the copyright owner of the open-source project **Orchid**
(https://github.com/chaserr/novel-craft-studio), released under the
**PolyForm Noncommercial License 1.0.0**. The license prohibits any
commercial use, paid SaaS hosting, or white-label rebranding without a
separately executed commercial license.

Your product **{{suspect_name}}** ({{suspect_url}}) distributes binaries
that contain the embedded fingerprint `{{extracted_fingerprint}}`, which
uniquely corresponds to my release tag `{{matched_release_tag}}` built on
{{build_timestamp}}. The fingerprint is injected by the release CI and
cannot be fabricated externally. This constitutes a license violation.

By **{{deadline_date}}**, please either:

1. **Cease and remove** all derivative components and confirm in writing; or
2. **Acquire a commercial license** by contacting me at {{your_email}}.

If neither occurs, I will pursue DMCA takedowns with your hosting and
payment providers, and reserve all further legal remedies.

Regards,
{{your_name}}
{{date}}
