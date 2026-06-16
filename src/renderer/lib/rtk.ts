/**
 * RTK.md 稀疏度检测：用户新建项目时一字段都没填 / 项目从模板裸抠出来时为 true。
 *
 * 只看 §1 / §2 的项目定制字段：书名 / 核心气质 bullets / 主线人物 bullets。
 * 模板里 §3-§10 都是通用规则文字（几千字符），所以不能简单按"非空字符数"判断。
 */

function countBulletsBetween(
  content: string,
  fromHeading: string,
  ...toHeadings: string[]
): number {
  const start = content.indexOf(fromHeading);
  if (start < 0) return 0;
  let end = content.length;
  for (const to of toHeadings) {
    const idx = content.indexOf(to, start + fromHeading.length);
    if (idx > 0 && idx < end) end = idx;
  }
  const slice = content.slice(start, end);
  return (slice.match(/^-\s+\S/gm) ?? []).length;
}

export function detectRtkSparse(content: string): boolean {
  const titleMatch = /《([^》\n]*)》/.exec(content);
  const hasTitle = !!(
    titleMatch &&
    titleMatch[1].trim() &&
    titleMatch[1] !== '{{书名}}'
  );
  const toneLines = countBulletsBetween(content, '核心气质', '目标读者画像', '## ');
  const charLines = countBulletsBetween(content, '固定世界观', '## 3', '## ');

  // 三个信号至少 2 个空 → 稀疏
  const emptyCount =
    (hasTitle ? 0 : 1) + (toneLines === 0 ? 1 : 0) + (charLines === 0 ? 1 : 0);
  return emptyCount >= 2;
}

/**
 * 通用稀疏检测：剥掉 # 标题、引用块、模板占位提示，剩余有效字符 < threshold 视为空。
 * 给「小说大纲.md / 章节大纲.md」这种没有结构化字段的文件用。
 */
export function detectGenericSparse(content: string, threshold = 300): boolean {
  const meaningful = content
    .split('\n')
    .map((l) => l.trim())
    .filter(
      (l) =>
        l &&
        !l.startsWith('#') &&
        !l.startsWith('>') &&
        !l.startsWith('---') &&
        !/^\{\{.*\}\}$/.test(l) &&
        !/^\[.*待.*\]$/.test(l) // [待填写] / [待补] 等占位
    )
    .join('')
    .replace(/\s+/g, '');
  return meaningful.length < threshold;
}
