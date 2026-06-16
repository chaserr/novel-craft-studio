import { useMemo } from 'react';
import { ScrollArea, NavLink, Text, Stack, Box, Group, Badge, Checkbox } from '@mantine/core';
import {
  IconBook2,
  IconList,
  IconClipboardText,
  IconHistory,
  IconBookmark,
  IconQuote,
  IconUsers,
  IconPencil,
  IconReport,
  IconFile,
  IconFileCheck,
  IconFileText
} from '@tabler/icons-react';
import { useProject } from '../stores/projectStore';
import type { ProjectFileEntry } from '../../shared/types';

const CATEGORIES: {
  key: ProjectFileEntry['category'];
  label: string;
  icon: typeof IconBook2;
}[] = [
  { key: 'chapter', label: '章节', icon: IconFile },
  { key: 'rtk', label: 'RTK', icon: IconBook2 },
  { key: 'outline', label: '小说大纲', icon: IconList },
  { key: 'chapter-outline', label: '章节大纲', icon: IconClipboardText },
  { key: 'recap', label: '前情梳理', icon: IconHistory },
  { key: 'foreshadow', label: '伏笔清单', icon: IconBookmark },
  { key: 'quotes', label: '经典语录', icon: IconQuote },
  { key: 'character', label: '人物档案', icon: IconUsers },
  { key: 'craft', label: '写作技巧', icon: IconPencil },
  { key: 'review', label: '审稿报告', icon: IconReport }
];

export default function ProjectSidebar(): JSX.Element {
  const meta = useProject((s) => s.meta);
  const files = useProject((s) => s.files);
  const activePath = useProject((s) => s.activeFilePath);
  const selected = useProject((s) => s.selectedChapterPaths);
  const openFile = useProject((s) => s.openFile);
  const toggleSelected = useProject((s) => s.toggleChapterSelected);

  const grouped = useMemo(() => {
    const m: Record<string, ProjectFileEntry[]> = {};
    for (const f of files) {
      if (f.isDir) continue;
      (m[f.category] ??= []).push(f);
    }
    if (m.chapter) {
      m.chapter.sort(
        (a, b) => (a.chapterNumber ?? 0) - (b.chapterNumber ?? 0)
      );
    }
    return m;
  }, [files]);

  if (!meta) {
    return (
      <Box p="md">
        <Text size="sm" c="dimmed">
          还没打开项目。点击右上"新建项目"或"打开项目"。
        </Text>
      </Box>
    );
  }

  const totalSelected = selected.length;

  return (
    <ScrollArea h="100%" type="auto">
      <Stack gap="xs">
        {totalSelected > 0 && (
          <Badge color="indigo" variant="filled" mx="xs">
            已选 {totalSelected} 章
          </Badge>
        )}

        {CATEGORIES.map((cat) => {
          const items = grouped[cat.key];
          if (!items || items.length === 0) return null;
          const Icon = cat.icon;
          const isChapterGroup = cat.key === 'chapter';
          return (
            <NavLink
              key={cat.key}
              label={
                <Text fw={500}>
                  {cat.label}{' '}
                  <Text component="span" c="dimmed" size="xs">
                    ({items.length})
                  </Text>
                </Text>
              }
              leftSection={<Icon size={16} />}
              defaultOpened={isChapterGroup}
              childrenOffset={20}
            >
              {items.map((f) =>
                isChapterGroup ? (
                  <ChapterRow
                    key={f.path}
                    file={f}
                    active={f.path === activePath}
                    checked={selected.includes(f.path)}
                    onOpen={() => openFile(f.path)}
                    onToggle={() => toggleSelected(f.path)}
                  />
                ) : (
                  <NavLink
                    key={f.path}
                    label={
                      <Text size="sm" truncate="end">
                        {f.name}
                      </Text>
                    }
                    active={f.path === activePath}
                    onClick={() => openFile(f.path)}
                  />
                )
              )}
            </NavLink>
          );
        })}
      </Stack>
    </ScrollArea>
  );
}

interface ChapterRowProps {
  file: ProjectFileEntry;
  active: boolean;
  checked: boolean;
  onOpen: () => void;
  onToggle: () => void;
}

function ChapterRow({
  file,
  active,
  checked,
  onOpen,
  onToggle
}: ChapterRowProps): JSX.Element {
  const Icon = file.hasContent ? IconFileCheck : IconFileText;
  return (
    <Group
      gap={4}
      px="xs"
      py={2}
      wrap="nowrap"
      style={{
        cursor: 'pointer',
        background: active ? 'var(--mantine-color-indigo-9)' : undefined,
        borderRadius: 4
      }}
      onClick={(e) => {
        // cmd/ctrl click → toggle 多选
        if (e.metaKey || e.ctrlKey) {
          onToggle();
        } else {
          onOpen();
        }
      }}
    >
      <Checkbox
        size="xs"
        checked={checked}
        onChange={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        onClick={(e) => e.stopPropagation()}
      />
      <Icon size={14} color={file.hasContent ? 'var(--mantine-color-green-5)' : 'var(--mantine-color-dark-2)'} />
      <Text size="sm" truncate="end" style={{ flex: 1 }}>
        {file.name.replace(/^.+?-第\d+章-/, '').replace(/\.md$/, '')}
      </Text>
      <Text size="xs" c="dimmed">
        {file.chapterNumber}
      </Text>
    </Group>
  );
}
