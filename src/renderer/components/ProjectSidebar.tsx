import { useMemo } from 'react';
import { ScrollArea, NavLink, Text, Stack, Box } from '@mantine/core';
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
  IconFile
} from '@tabler/icons-react';
import { useProject } from '../stores/projectStore';
import type { ProjectFileEntry } from '../../shared/types';

const CATEGORIES: {
  key: ProjectFileEntry['category'];
  label: string;
  icon: typeof IconBook2;
}[] = [
  { key: 'rtk', label: 'RTK', icon: IconBook2 },
  { key: 'outline', label: '小说大纲', icon: IconList },
  { key: 'chapter-outline', label: '章节大纲', icon: IconClipboardText },
  { key: 'recap', label: '前情梳理', icon: IconHistory },
  { key: 'foreshadow', label: '伏笔清单', icon: IconBookmark },
  { key: 'quotes', label: '经典语录', icon: IconQuote },
  { key: 'character', label: '人物档案', icon: IconUsers },
  { key: 'craft', label: '写作技巧', icon: IconPencil },
  { key: 'review', label: '审稿报告', icon: IconReport },
  { key: 'chapter', label: '章节', icon: IconFile }
];

export default function ProjectSidebar(): JSX.Element {
  const meta = useProject((s) => s.meta);
  const files = useProject((s) => s.files);
  const activePath = useProject((s) => s.activeFilePath);
  const openFile = useProject((s) => s.openFile);

  const grouped = useMemo(() => {
    const m: Record<string, ProjectFileEntry[]> = {};
    for (const f of files) {
      if (f.isDir) continue; // 目录不展示在文件树
      (m[f.category] ??= []).push(f);
    }
    // chapter 按章节号排序
    if (m.chapter) {
      m.chapter.sort((a, b) => {
        const an = /-第(\d+)章-/.exec(a.name)?.[1] ?? '0';
        const bn = /-第(\d+)章-/.exec(b.name)?.[1] ?? '0';
        return parseInt(an, 10) - parseInt(bn, 10);
      });
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

  return (
    <ScrollArea h="100%" type="auto">
      <Stack gap="xs">
        {CATEGORIES.map((cat) => {
          const items = grouped[cat.key];
          if (!items || items.length === 0) return null;
          const Icon = cat.icon;
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
              defaultOpened
              childrenOffset={28}
            >
              {items.map((f) => (
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
              ))}
            </NavLink>
          );
        })}
      </Stack>
    </ScrollArea>
  );
}
