import { useMemo, useState } from 'react';
import {
  ScrollArea,
  NavLink,
  Text,
  Stack,
  Box,
  Group,
  Badge,
  Checkbox,
  ActionIcon,
  Tooltip,
  Paper,
  UnstyledButton
} from '@mantine/core';
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
  IconFileText,
  IconRefresh,
  IconFolderSearch,
  IconClipboard,
  IconTrash
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useProject } from '../stores/projectStore';
import { api } from '../lib/ipc';
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

interface ContextMenuState {
  x: number;
  y: number;
  file: ProjectFileEntry;
}

export default function ProjectSidebar(): JSX.Element {
  const meta = useProject((s) => s.meta);
  const files = useProject((s) => s.files);
  const activePath = useProject((s) => s.activeFilePath);
  const selected = useProject((s) => s.selectedChapterPaths);
  const openFile = useProject((s) => s.openFile);
  const toggleSelected = useProject((s) => s.toggleChapterSelected);
  const refreshFiles = useProject((s) => s.refreshFiles);
  const clearActiveFile = useProject((s) => s.clearActiveFile);

  const [refreshing, setRefreshing] = useState(false);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);

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

  const doRefresh = async (): Promise<void> => {
    setRefreshing(true);
    try {
      await refreshFiles();
    } finally {
      setRefreshing(false);
    }
  };

  const openContextMenu = (e: React.MouseEvent, file: ProjectFileEntry): void => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, file });
  };

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
    <>
      {/* 顶栏：项目名 + 刷新 */}
      <Group justify="space-between" px="xs" pb={6}>
        <Text size="xs" c="dimmed" fw={500} truncate="end">
          {meta.bookTitle}
        </Text>
        <Tooltip label="刷新文件列表">
          <ActionIcon
            size="sm"
            variant="subtle"
            loading={refreshing}
            onClick={() => void doRefresh()}
          >
            <IconRefresh size={14} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <ScrollArea h="calc(100% - 32px)" type="auto">
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
                      onContextMenu={(e) => openContextMenu(e, f)}
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
                      onContextMenu={(e) => openContextMenu(e, f)}
                    />
                  )
                )}
              </NavLink>
            );
          })}
        </Stack>
      </ScrollArea>

      {menu && (
        <FileContextMenu
          state={menu}
          activePath={activePath}
          onClose={() => setMenu(null)}
          onAfterTrash={(wasActive) => {
            if (wasActive) clearActiveFile();
            void refreshFiles();
          }}
        />
      )}
    </>
  );
}

/* ============================================================ */
/*                    File context menu                          */
/* ============================================================ */

interface FileContextMenuProps {
  state: ContextMenuState;
  activePath: string | null;
  onClose: () => void;
  onAfterTrash: (wasActive: boolean) => void;
}

function FileContextMenu({
  state,
  activePath,
  onClose,
  onAfterTrash
}: FileContextMenuProps): JSX.Element {
  const { x, y, file } = state;

  const handleShowInFolder = async (): Promise<void> => {
    await api.files.showInFolder(file.path);
    onClose();
  };

  const handleCopyPath = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(file.path);
      notifications.show({
        message: '已复制路径',
        color: 'green',
        autoClose: 1500
      });
    } catch (err) {
      notifications.show({
        title: '复制失败',
        message: err instanceof Error ? err.message : String(err),
        color: 'red'
      });
    }
    onClose();
  };

  const handleTrash = async (): Promise<void> => {
    const ok = window.confirm(`确定移到废纸篓？\n\n${file.name}\n\n（可在系统废纸篓里恢复）`);
    if (!ok) {
      onClose();
      return;
    }
    try {
      await api.files.trash(file.path);
      onAfterTrash(file.path === activePath);
      notifications.show({
        message: `已移到废纸篓：${file.name}`,
        color: 'green',
        autoClose: 2000
      });
    } catch (err) {
      notifications.show({
        title: '删除失败',
        message: err instanceof Error ? err.message : String(err),
        color: 'red'
      });
    }
    onClose();
  };

  return (
    <>
      {/* 全屏 backdrop：点击外面关闭菜单 */}
      <Box
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000
        }}
      />
      <Paper
        shadow="md"
        radius="sm"
        p={4}
        style={{
          position: 'fixed',
          left: clampMenuPos(x, 220),
          top: clampMenuPos(y, 160, true),
          zIndex: 1001,
          minWidth: 200,
          border: '1px solid var(--mantine-color-dark-4)',
          background: 'var(--mantine-color-dark-7)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Stack gap={2}>
          <MenuItem
            icon={<IconFolderSearch size={14} />}
            label="在 Finder 中显示"
            onClick={() => void handleShowInFolder()}
          />
          <MenuItem
            icon={<IconClipboard size={14} />}
            label="复制路径"
            onClick={() => void handleCopyPath()}
          />
          <Box style={{ height: 1, background: 'var(--mantine-color-dark-4)', margin: '2px 0' }} />
          <MenuItem
            icon={<IconTrash size={14} />}
            label="移到废纸篓"
            danger
            onClick={() => void handleTrash()}
          />
        </Stack>
      </Paper>
    </>
  );
}

/** 防止菜单跑出屏幕。size 是菜单的近似宽 / 高，isVertical 决定按高夹。 */
function clampMenuPos(coord: number, size: number, isVertical = false): number {
  const max = isVertical ? window.innerHeight : window.innerWidth;
  return Math.min(coord, max - size - 8);
}

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}

function MenuItem({ icon, label, danger, onClick }: MenuItemProps): JSX.Element {
  return (
    <UnstyledButton
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderRadius: 4,
        color: danger ? 'var(--mantine-color-red-4)' : undefined,
        fontSize: 13,
        width: '100%'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--mantine-color-dark-5)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      {icon}
      <span>{label}</span>
    </UnstyledButton>
  );
}

/* ============================================================ */
/*                      Chapter row                              */
/* ============================================================ */

interface ChapterRowProps {
  file: ProjectFileEntry;
  active: boolean;
  checked: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function ChapterRow({
  file,
  active,
  checked,
  onOpen,
  onToggle,
  onContextMenu
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
      onContextMenu={onContextMenu}
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
