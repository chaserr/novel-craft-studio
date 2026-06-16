import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Group,
  Text,
  Badge,
  Stack,
  Center,
  ActionIcon,
  Tooltip,
  SegmentedControl,
  ScrollArea
} from '@mantine/core';
import {
  IconFolderSearch,
  IconMaximize,
  IconMinimize,
  IconChevronLeft,
  IconChevronRight
} from '@tabler/icons-react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useProject } from '../stores/projectStore';
import { api } from '../lib/ipc';

const AUTO_SAVE_DELAY = 800;

/* ============================================================ */
/*                  frontmatter / 分页 工具                       */
/* ============================================================ */

interface ParsedFrontmatter {
  title: string | null;
  chapterNumber: number | null;
  body: string;
}

/** 抽出 ---...--- 里的 title / chapter，返回剥掉头部之后的 body。 */
function parseFrontmatter(content: string): ParsedFrontmatter {
  const m = /^---\s*\n([\s\S]*?)\n---\s*\n*/.exec(content);
  if (!m) return { title: null, chapterNumber: null, body: content };
  const head = m[1];
  const body = content.slice(m[0].length);
  const titleMatch = /^title:\s*(.+)$/m.exec(head);
  const chapterMatch = /^chapter:\s*(\d+)/m.exec(head);
  return {
    title: titleMatch ? titleMatch[1].trim() : null,
    chapterNumber: chapterMatch ? parseInt(chapterMatch[1], 10) : null,
    body
  };
}

/**
 * 按段落把正文切成几页，每页大约 charsPerPage 个非空白字符。
 * 切分边界总是 \n\n（段落之间），不会把一个段落切散。
 */
function paginateByParagraph(body: string, charsPerPage = 450): string[] {
  const paragraphs = body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return [''];
  const pages: string[] = [];
  let cur = '';
  let curLen = 0;
  for (const p of paragraphs) {
    const pLen = p.replace(/\s+/g, '').length;
    if (curLen + pLen > charsPerPage && cur) {
      pages.push(cur);
      cur = p;
      curLen = pLen;
    } else {
      cur = cur ? cur + '\n\n' + p : p;
      curLen += pLen;
    }
  }
  if (cur) pages.push(cur);
  return pages;
}

type ViewMode = 'edit' | 'preview' | 'phone';

/* ============================================================ */
/*                       ChapterEditor                            */
/* ============================================================ */

export default function ChapterEditor(): JSX.Element {
  const path = useProject((s) => s.activeFilePath);
  const content = useProject((s) => s.activeFileContent);
  const dirty = useProject((s) => s.activeFileDirty);
  const updateContent = useProject((s) => s.setActiveContent);
  const save = useProject((s) => s.saveActiveFile);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mode, setMode] = useState<ViewMode>('edit');
  const [fullscreen, setFullscreen] = useState(false);

  // 防抖自动保存
  useEffect(() => {
    if (!dirty) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void save();
    }, AUTO_SAVE_DELAY);
    return (): void => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [content, dirty, save]);

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        void save();
      }
      if (e.key === 'Escape' && fullscreen) setFullscreen(false);
    };
    window.addEventListener('keydown', handler);
    return (): void => window.removeEventListener('keydown', handler);
  }, [save, fullscreen]);

  const parsed = useMemo(() => parseFrontmatter(content), [content]);
  const pages = useMemo(
    () => paginateByParagraph(parsed.body),
    [parsed.body]
  );

  // 文件切换时翻到第 1 页
  const [pageIdx, setPageIdx] = useState(0);
  useEffect(() => {
    setPageIdx(0);
  }, [path]);

  if (!path) {
    return (
      <Center h="100%">
        <Stack align="center" gap={4}>
          <Text size="lg" c="dimmed">
            从左侧选一个文件开始编辑
          </Text>
          <Text size="sm" c="dimmed">
            或者在右侧 chat 里跟 LLM 一起开始写
          </Text>
        </Stack>
      </Center>
    );
  }

  const name = path.split('/').pop();
  const displayTitle =
    parsed.title ??
    (name?.replace(/^.+?-第\d+章-/, '').replace(/\.md$/, '') ?? '');

  const editor = (
    <Box display="flex" style={{ flexDirection: 'column', height: '100%' }}>
      {/* 顶栏 */}
      <Group justify="space-between" px="md" py={6} bd="1px solid var(--mantine-color-dark-4)">
        <Group gap={6}>
          <Text size="sm" fw={500}>
            {name}
          </Text>
          <Tooltip label="在 Finder/资源管理器里显示">
            <ActionIcon size="sm" variant="subtle" onClick={() => void api.files.showInFolder(path)}>
              <IconFolderSearch size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
        <Group gap="xs">
          <SegmentedControl
            size="xs"
            value={mode}
            onChange={(v) => setMode(v as ViewMode)}
            data={[
              { value: 'edit', label: '编辑' },
              { value: 'preview', label: '预览' },
              { value: 'phone', label: '手机预览' }
            ]}
          />
          {mode === 'phone' && (
            <Badge size="xs" variant="light" color="teal">
              {pageIdx + 1} / {pages.length} 页
            </Badge>
          )}
          <Badge color={dirty ? 'yellow' : 'green'} variant="light">
            {dirty ? '未保存' : '已保存'}
          </Badge>
          <Tooltip label={fullscreen ? '退出全屏 (Esc)' : '全屏写作模式'}>
            <ActionIcon size="sm" variant="subtle" onClick={() => setFullscreen((f) => !f)}>
              {fullscreen ? <IconMinimize size={14} /> : <IconMaximize size={14} />}
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* 主体 */}
      <Box style={{ flex: 1, overflow: 'hidden' }}>
        {mode === 'edit' && (
          <CodeMirror
            value={content}
            onChange={updateContent}
            theme={oneDark}
            extensions={[markdown()]}
            height="100%"
            style={{ height: '100%', fontSize: 14 }}
            basicSetup={{
              lineNumbers: false,
              foldGutter: false,
              highlightActiveLine: false
            }}
          />
        )}
        {mode === 'preview' && (
          <DesktopPreview
            title={displayTitle}
            chapterNumber={parsed.chapterNumber}
            body={parsed.body}
          />
        )}
        {mode === 'phone' && (
          <PhonePreview
            title={displayTitle}
            chapterNumber={parsed.chapterNumber}
            pages={pages}
            pageIdx={pageIdx}
            onPageChange={setPageIdx}
          />
        )}
      </Box>
    </Box>
  );

  if (fullscreen) {
    return (
      <Box
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'var(--mantine-color-dark-7)'
        }}
      >
        {editor}
      </Box>
    );
  }

  return editor;
}

/* ============================================================ */
/*                      Desktop preview                           */
/* ============================================================ */

function DesktopPreview({
  title,
  chapterNumber,
  body
}: {
  title: string;
  chapterNumber: number | null;
  body: string;
}): JSX.Element {
  return (
    <ScrollArea h="100%" type="auto">
      <Box p="xl" mx="auto" style={{ maxWidth: 760 }}>
        <Stack gap={4} mb="lg" align="center">
          {chapterNumber != null && (
            <Text size="sm" c="dimmed">
              第 {chapterNumber} 章
            </Text>
          )}
          <Text size="xl" fw={700} ta="center">
            {title}
          </Text>
        </Stack>
        <Box
          className="markdown-body"
          style={{ fontSize: 16, lineHeight: 1.8 }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
        </Box>
      </Box>
    </ScrollArea>
  );
}

/* ============================================================ */
/*                       Phone preview                            */
/* ============================================================ */

const PHONE_W = 393;
const PHONE_H = 852;
const STATUS_BAR_H = 28;
const TITLE_BAR_H = 40;

function PhonePreview({
  title,
  chapterNumber,
  pages,
  pageIdx,
  onPageChange
}: {
  title: string;
  chapterNumber: number | null;
  pages: string[];
  pageIdx: number;
  onPageChange: (n: number) => void;
}): JSX.Element {
  const safeIdx = Math.min(Math.max(pageIdx, 0), pages.length - 1);
  const canPrev = safeIdx > 0;
  const canNext = safeIdx < pages.length - 1;

  // 左右键翻页
  useEffect(() => {
    const h = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLElement && /input|textarea/i.test(e.target.tagName)) return;
      if (e.key === 'ArrowLeft' && canPrev) onPageChange(safeIdx - 1);
      if (e.key === 'ArrowRight' && canNext) onPageChange(safeIdx + 1);
    };
    window.addEventListener('keydown', h);
    return (): void => window.removeEventListener('keydown', h);
  }, [safeIdx, canPrev, canNext, onPageChange]);

  return (
    <Box
      h="100%"
      bg="var(--mantine-color-dark-8)"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }}
    >
      <Stack align="center" gap="md" py="md">
        <Text size="xs" c="dimmed">
          iPhone 14 Pro · {PHONE_W}×{PHONE_H}
        </Text>

        <Group gap="md" align="center" wrap="nowrap">
          {/* 左翻 */}
          <ActionIcon
            size="lg"
            variant="default"
            disabled={!canPrev}
            onClick={() => onPageChange(safeIdx - 1)}
          >
            <IconChevronLeft size={20} />
          </ActionIcon>

          {/* 手机外壳 */}
          <Box
            style={{
              width: PHONE_W,
              height: PHONE_H,
              background: 'var(--mantine-color-dark-6)',
              borderRadius: 40,
              border: '8px solid var(--mantine-color-dark-3)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
              overflow: 'hidden',
              position: 'relative',
              flexShrink: 0
            }}
          >
            {/* 状态栏 */}
            <Box
              style={{
                height: STATUS_BAR_H,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 24px',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--mantine-color-gray-3)'
              }}
            >
              <span>9:41</span>
              <span>● ● ●</span>
            </Box>
            {/* 章节标题栏 */}
            <Box
              style={{
                height: TITLE_BAR_H,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 16px',
                borderBottom: '1px solid var(--mantine-color-dark-4)',
                color: 'var(--mantine-color-gray-2)'
              }}
            >
              <Text size="sm" fw={600} truncate="end">
                {chapterNumber != null ? `第 ${chapterNumber} 章 · ` : ''}
                {title}
              </Text>
            </Box>
            {/* 内容区（剩余高度），点左半屏前翻、右半屏后翻 */}
            <Box
              style={{
                height: PHONE_H - STATUS_BAR_H - TITLE_BAR_H,
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <ScrollArea h="100%" type="never">
                <Box
                  className="markdown-body markdown-body-phone"
                  style={{
                    padding: '16px 22px 36px',
                    fontSize: 15,
                    lineHeight: 1.75,
                    color: 'var(--mantine-color-gray-1)'
                  }}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{pages[safeIdx]}</ReactMarkdown>
                </Box>
              </ScrollArea>
              {/* 屏幕上左右半边的点击翻页区 */}
              <Box
                onClick={() => canPrev && onPageChange(safeIdx - 1)}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: '35%',
                  cursor: canPrev ? 'w-resize' : 'default'
                }}
              />
              <Box
                onClick={() => canNext && onPageChange(safeIdx + 1)}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: '35%',
                  cursor: canNext ? 'e-resize' : 'default'
                }}
              />
              {/* 底部页码 */}
              <Box
                style={{
                  position: 'absolute',
                  bottom: 6,
                  left: 0,
                  right: 0,
                  textAlign: 'center',
                  fontSize: 11,
                  color: 'var(--mantine-color-gray-5)',
                  pointerEvents: 'none'
                }}
              >
                {safeIdx + 1} / {pages.length}
              </Box>
            </Box>
          </Box>

          {/* 右翻 */}
          <ActionIcon
            size="lg"
            variant="default"
            disabled={!canNext}
            onClick={() => onPageChange(safeIdx + 1)}
          >
            <IconChevronRight size={20} />
          </ActionIcon>
        </Group>

        <Text size="xs" c="dimmed">
          点屏幕左右边 / ← → 键 / 两侧按钮 翻页
        </Text>
      </Stack>
    </Box>
  );
}
