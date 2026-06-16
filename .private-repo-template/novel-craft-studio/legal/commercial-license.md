# Commercial License — Standard Terms

> 给真正想合规商用的人看的版本。开 Issue 收到 `[Commercial License
> Request]` 后回这份模板，并附上具体的 fee schedule。

## Default offer (negotiable)

| 使用规模                                   | 年度授权费 (USD)    | 备注                          |
|--------------------------------------------|--------------------|-------------------------------|
| 个人付费应用 (≤ 1k MAU)                    | $300               | 单一品牌                       |
| SaaS / 团队工具 (≤ 50k MAU)                | $3,000             | 单一品牌，需注明 powered-by    |
| 企业 / 多品牌 / OEM                        | 议价               | 起步 $20,000/yr                |

价格仅供参考，最终以双方签署的 SaaS 商业授权协议为准。

## 授权内容（包含）

- 在被授权方运营的商业产品中使用、修改、分发 Orchid
- 在被授权方产品中复用本项目的 prompt 模板与 UI 实现
- 由作者提供的非紧急 bug 修复支持（响应时间承诺另议）

## 授权不包含 / 禁止行为

- 转授权 / 二次出售授权
- 将本项目代码或衍生作品贡献回上游公开仓库（你的修改是你的，不要污染上游）
- 移除或篡改 BUILD_FINGERPRINT、ZERO_WIDTH_MARK、PROMPT_SIGNATURE_PHRASE
  指纹标识（这些标识只是为了上游的反盗版能力，对你产品本身无任何影响）

## 流程

1. 在公开仓库开 Issue，标题 `[Commercial License Request]`
2. 简述：公司主体 / 国家 / 产品形态 / 预估 MAU / 预计上线时间
3. 收到回复后双方过电话或视频确认
4. 签署 SaaS 商业授权协议（中文 + 英文双语，作者起草）
5. 付款 → 拿到 fingerprint-stripped build credentials（如果有）

如果你已经在商用但还没买授权 —— 先把现有商用停掉，再走以上流程。已经
发生的违规使用可以在协议里以补缴 + 不追溯的形式一次性了结。
