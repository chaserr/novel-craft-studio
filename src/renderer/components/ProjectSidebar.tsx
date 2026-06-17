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
  UnstyledButton,
  Divider,
  useMantineColorScheme
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
  IconFolder,
  IconRefresh,
  IconFolderSearch,
  IconClipboard,
  IconTrash
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useProject } from '../stores/projectStore';
import { useWorkflow } from '../stores/workflowStore';
import { api } from '../lib/ipc';
import type { ProjectFileEntry } from '../../shared/types';

/**
 * 根目录文件的固定分组（用类别决定，文件名匹到具体 category）。
 * 子目录（人物档案/写作技巧/审稿报告 + 用户自建的任意目录）走动态分组，
 * 直接用目录名作为标题，下面通过 SUBDIR_ICONS 给已知目录配图标，
 * 其余自建目录用通用 IconFolder。
 */
const ROOT_CATEGORIES: {
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
  { key: 'quotes', label: '经典语录', icon: IconQuote }
];

const SUBDIR_ICONS: Record<string, typeof IconBook2> = {
  人物档案: IconUsers,
  写作技巧: IconPencil,
  审稿报告: IconReport
};

/* ----------- recursive tree types ------------ */

interface DirNode {
  kind: 'dir';
  dir: ProjectFileEntry;
  children: (DirNode | FileNode)[];
}
interface FileNode {
  kind: 'file';
  file: ProjectFileEntry;
}

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
  const range = useWorkflow((s) => s.range);
  const multiSelectMode = range.type === 'multi';

  const [refreshing, setRefreshing] = useState(false);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);

  /**
   * 渲染分两层：
   *  1) 根目录文件 → 按 ROOT_CATEGORIES 固定分类（章节 / RTK / 大纲 / ...）
   *  2) 根目录子目录 → 递归树：每个 dir 一个可折叠 NavLink，里面再嵌它的
   *     子文件 / 子子目录，深度不限。
   *  3) 根目录散文件 → 「其它」分组
   */
  const { rootCategoryFiles, rootDirNodes, rootOtherFiles } = useMemo(() => {
    const rootByCat: Record<string, ProjectFileEntry[]> = {};
    const otherRoot: ProjectFileEntry[] = [];

    // 把所有 entry 按 relPath 索引一下，方便建树时按父路径找父节点
    const entriesByParent: Record<string, ProjectFileEntry[]> = {};
    for (const f of files) {
      const sepIdx = f.relPath.lastIndexOf('/');
      const parentRel = sepIdx >= 0 ? f.relPath.slice(0, sepIdx) : '';
      (entriesByParent[parentRel] ??= []).push(f);
    }

    const buildNode = (entry: ProjectFileEntry): DirNode | FileNode => {
      if (!entry.isDir) {
        return { kind: 'file', file: entry };
      }
      const children = (entriesByParent[entry.relPath] ?? [])
        .slice()
        .sort((a, b) => {
          // 目录优先 → 名字排序
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
          return a.name.localeCompare(b.name, 'zh');
        })
        .map(buildNode);
      return { kind: 'dir', dir: entry, children };
    };

    const rootDirs: DirNode[] = [];
    for (const f of files) {
      const isRootLevel = !f.relPath.includes('/');
      if (!isRootLevel) continue;
      if (f.isDir) {
        rootDirs.push(buildNode(f) as DirNode);
        continue;
      }
      if (f.category === 'other') {
        otherRoot.push(f);
      } else {
        (rootByCat[f.category] ??= []).push(f);
      }
    }
    if (rootByCat.chapter) {
      rootByCat.chapter.sort(
        (a, b) => (a.chapterNumber ?? 0) - (b.chapterNumber ?? 0)
      );
    }
    otherRoot.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
    rootDirs.sort((a, b) => a.dir.name.localeCompare(b.dir.name, 'zh'));
    return {
      rootCategoryFiles: rootByCat,
      rootDirNodes: rootDirs,
      rootOtherFiles: otherRoot
    };
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
            size="lg"
            variant="subtle"
            loading={refreshing}
            onClick={() => void doRefresh()}
          >
            <IconRefresh size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <ScrollArea h="calc(100% - 48px)" type="auto">
        <Stack gap="xs">
          {totalSelected > 0 && (
            <Badge color="indigo" variant="filled" mx="xs">
              已选 {totalSelected} 章
            </Badge>
          )}

          {/* 1) 根目录的固定分类（章节/RTK/大纲...） */}
          {ROOT_CATEGORIES.map((cat) => {
            const items = rootCategoryFiles[cat.key];
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
                      showCheckbox={multiSelectMode}
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

          {/* 2) 任何根目录子目录 → 递归树，文件夹嵌套到底 */}
          {rootDirNodes.map((node) => (
            <DirTreeNode
              key={node.dir.path}
              node={node}
              activePath={activePath}
              onOpen={openFile}
              onContextMenu={openContextMenu}
            />
          ))}

          {/* 3) 项目根下没匹到任何固定分类的散文件 */}
          {rootOtherFiles.length > 0 && (
            <NavLink
              label={
                <Text fw={500}>
                  其它{' '}
                  <Text component="span" c="dimmed" size="xs">
                    ({rootOtherFiles.length})
                  </Text>
                </Text>
              }
              leftSection={<IconFileText size={16} />}
              childrenOffset={20}
            >
              {rootOtherFiles.map((f) => (
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
              ))}
            </NavLink>
          )}
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
        withBorder
        style={{
          position: 'fixed',
          left: clampMenuPos(x, 220),
          top: clampMenuPos(y, 160, true),
          zIndex: 1001,
          minWidth: 200
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
          <Divider my={2} />
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
  const { colorScheme } = useMantineColorScheme();
  const hoverBg =
    colorScheme === 'dark'
      ? 'var(--mantine-color-dark-5)'
      : 'var(--mantine-color-gray-1)';
  return (
    <UnstyledButton
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderRadius: 4,
        color: danger ? 'var(--mantine-color-red-6)' : undefined,
        fontSize: 13,
        width: '100%'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = hoverBg;
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
  showCheckbox: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function ChapterRow({
  file,
  active,
  checked,
  showCheckbox,
  onOpen,
  onToggle,
  onContextMenu
}: ChapterRowProps): JSX.Element {
  const Icon = file.hasContent ? IconFileCheck : IconFileText;
  const displayName = file.name.replace(/^.+?-第\d+章-/, '').replace(/\.md$/, '');
  return (
    <NavLink
      active={active}
      onClick={(e) => {
        // cmd/ctrl click → toggle 多选；普通点击 → 打开
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          onToggle();
        } else {
          onOpen();
        }
      }}
      onContextMenu={onContextMenu}
      leftSection={
        <Group gap={6} wrap="nowrap">
          {showCheckbox && (
            <Checkbox
              size="sm"
              checked={checked}
              onChange={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <Icon
            size={14}
            color={
              file.hasContent
                ? 'var(--mantine-color-green-5)'
                : 'var(--mantine-color-dimmed)'
            }
          />
        </Group>
      }
      label={
        <Text size="sm" truncate="end">
          {displayName}
        </Text>
      }
      rightSection={
        <Text size="xs" c="dimmed">
          {file.chapterNumber}
        </Text>
      }
    />
  );
}

/* ============================================================ */
/*                  Recursive directory tree                     */
/* ============================================================ */

function DirTreeNode({
  node,
  activePath,
  onOpen,
  onContextMenu
}: {
  node: DirNode;
  activePath: string | null;
  onOpen: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, file: ProjectFileEntry) => void;
}): JSX.Element {
  const Icon = SUBDIR_ICONS[node.dir.name] ?? IconFolder;
  // 文件数（这层 + 嵌套）
  const totalFiles = countFiles(node);
  return (
    <NavLink
      label={
        <Text fw={500}>
          {node.dir.name}{' '}
          <Text component="span" c="dimmed" size="xs">
            ({totalFiles})
          </Text>
        </Text>
      }
      leftSection={<Icon size={16} />}
      childrenOffset={20}
      onContextMenu={(e) => onContextMenu(e, node.dir)}
    >
      {node.children.map((child) =>
        child.kind === 'dir' ? (
          <DirTreeNode
            key={child.dir.path}
            node={child}
            activePath={activePath}
            onOpen={onOpen}
            onContextMenu={onContextMenu}
          />
        ) : (
          <NavLink
            key={child.file.path}
            label={
              <Text size="sm" truncate="end">
                {child.file.name}
              </Text>
            }
            leftSection={<IconFileText size={14} color="var(--mantine-color-dimmed)" />}
            active={child.file.path === activePath}
            onClick={() => onOpen(child.file.path)}
            onContextMenu={(e) => onContextMenu(e, child.file)}
          />
        )
      )}
    </NavLink>
  );
}

function countFiles(node: DirNode | FileNode): number {
  if (node.kind === 'file') return 1;
  return node.children.reduce((sum, c) => sum + countFiles(c), 0);
}
