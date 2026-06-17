import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Stack,
  Group,
  Text,
  ScrollArea,
  Button,
  UnstyledButton,
  Box,
  Badge,
  Alert,
  Tooltip,
  ActionIcon
} from '@mantine/core';
import { IconHistory, IconRestore, IconTrash, IconAlertCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { diffLines } from 'diff';
import { api } from '../lib/ipc';

interface SnapshotMeta {
  timestamp: number;
  path: string;
  size: number;
  hash: string;
}

interface HistoryPanelProps {
  opened: boolean;
  onClose: () => void;
  projectRoot: string;
  filePath: string;
  /** 当前编辑器里的内容（用于 diff 比对 + 恢复时覆盖）。 */
  currentContent: string;
  /** 用户点「恢复到此版本」时调用，由父组件把内容写回文件并刷新。 */
  onRestore: (content: string) => Promise<void>;
}

export default function HistoryPanel({
  opened,
  onClose,
  projectRoot,
  filePath,
  currentContent,
  onRestore
}: HistoryPanelProps): JSX.Element {
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [selectedTs, setSelectedTs] = useState<number | null>(null);
  const [snapshotContent, setSnapshotContent] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const refresh = async (): Promise<void> => {
    if (!opened) return;
    setLoading(true);
    try {
      const list = await api.history.list(projectRoot, filePath);
      setSnapshots(list);
      if (list.length > 0) {
        const first = list[0];
        setSelectedTs(first.timestamp);
        const body = await api.history.read(first.path);
        setSnapshotContent(body);
      } else {
        setSelectedTs(null);
        setSnapshotContent('');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, filePath, projectRoot]);

  const selected = snapshots.find((s) => s.timestamp === selectedTs) ?? null;

  const handleSelect = async (s: SnapshotMeta): Promise<void> => {
    setSelectedTs(s.timestamp);
    const body = await api.history.read(s.path);
    setSnapshotContent(body);
  };

  const handleRestore = async (): Promise<void> => {
    if (!selected) return;
    if (!window.confirm('恢复到此版本会覆盖当前正文（当前内容也会作为新快照保留），继续？')) return;
    await onRestore(snapshotContent);
    notifications.show({ message: `已恢复到 ${formatTs(selected.timestamp)}`, color: 'green' });
    onClose();
  };

  const handleDeleteSelected = async (): Promise<void> => {
    if (!selected) return;
    if (!window.confirm('删除这个快照？不可恢复。')) return;
    await api.history.delete(selected.path);
    notifications.show({ message: '快照已删除', color: 'gray' });
    await refresh();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="90%"
      centered
      title={
        <Group gap={6}>
          <IconHistory size={16} />
          <Text fw={600}>历史版本</Text>
          <Text size="xs" c="dimmed" truncate="end" maw={400}>
            {filePath.split('/').slice(-2).join('/')}
          </Text>
        </Group>
      }
    >
      {snapshots.length === 0 && !loading ? (
        <Alert color="gray" variant="light" icon={<IconAlertCircle size={14} />}>
          <Text size="sm">
            这个文件还没有历史快照。保存一次会自动留底（同一份 60 秒内合并为一份）。
          </Text>
        </Alert>
      ) : (
        <Group align="stretch" gap="md" wrap="nowrap" style={{ height: '70vh' }}>
          {/* 左：版本列表 */}
          <Box style={{ width: 240, flexShrink: 0 }}>
            <ScrollArea h="100%" type="auto">
              <Stack gap={4}>
                {snapshots.map((s) => (
                  <SnapshotItem
                    key={s.timestamp}
                    snapshot={s}
                    isSelected={s.timestamp === selectedTs}
                    isLatest={s === snapshots[0]}
                    onSelect={() => void handleSelect(s)}
                  />
                ))}
              </Stack>
            </ScrollArea>
          </Box>

          {/* 右：diff */}
          <Box style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {selected && (
              <Group justify="space-between" mb="xs">
                <Group gap={6}>
                  <Badge variant="light" color="indigo">
                    {formatTs(selected.timestamp)}
                  </Badge>
                  <Text size="xs" c="dimmed">
                    {(selected.size / 1024).toFixed(1)} KB
                  </Text>
                </Group>
                <Group gap="xs">
                  <Tooltip label="删除这个快照">
                    <ActionIcon
                      variant="default"
                      size="md"
                      color="red"
                      onClick={() => void handleDeleteSelected()}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Tooltip>
                  <Button
                    size="xs"
                    color="indigo"
                    leftSection={<IconRestore size={14} />}
                    onClick={() => void handleRestore()}
                  >
                    恢复到此版本
                  </Button>
                </Group>
              </Group>
            )}
            <Box style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              <DiffView
                oldContent={snapshotContent}
                newContent={currentContent}
              />
            </Box>
          </Box>
        </Group>
      )}
    </Modal>
  );
}

function SnapshotItem({
  snapshot,
  isSelected,
  isLatest,
  onSelect
}: {
  snapshot: SnapshotMeta;
  isSelected: boolean;
  isLatest: boolean;
  onSelect: () => void;
}): JSX.Element {
  return (
    <UnstyledButton
      onClick={onSelect}
      style={{
        padding: '6px 10px',
        borderRadius: 6,
        border: '1px solid var(--mantine-color-default-border)',
        background: isSelected ? 'var(--mantine-color-indigo-light)' : undefined,
        width: '100%'
      }}
    >
      <Group justify="space-between" gap={4} wrap="nowrap">
        <Box style={{ minWidth: 0 }}>
          <Text size="sm" fw={500} truncate="end">
            {formatTs(snapshot.timestamp)}
          </Text>
          <Text size="xs" c="dimmed">
            {relativeTime(snapshot.timestamp)} · {(snapshot.size / 1024).toFixed(1)} KB
          </Text>
        </Box>
        {isLatest && (
          <Badge size="xs" color="teal" variant="light">
            最新
          </Badge>
        )}
      </Group>
    </UnstyledButton>
  );
}

/**
 * 行级 diff 渲染：绿色 = 当前比快照多的（add）；红色 = 快照里有当前没的（remove）；
 * 灰色 = 两边都有。左侧是"快照版"（旧），右侧概念上是"当前内容"（新）。
 */
function DiffView({
  oldContent,
  newContent
}: {
  oldContent: string;
  newContent: string;
}): JSX.Element {
  const parts = useMemo(() => diffLines(oldContent, newContent), [oldContent, newContent]);
  return (
    <Box
      style={{
        fontFamily: 'var(--mantine-font-family-monospace)',
        fontSize: 12,
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        background: 'var(--mantine-color-default)',
        border: '1px solid var(--mantine-color-default-border)',
        borderRadius: 4,
        padding: 12,
        minHeight: '100%'
      }}
    >
      {parts.map((p, i) => {
        const bg = p.added
          ? 'var(--mantine-color-green-light)'
          : p.removed
            ? 'var(--mantine-color-red-light)'
            : 'transparent';
        const prefix = p.added ? '+ ' : p.removed ? '- ' : '  ';
        return (
          <Box
            key={i}
            component="span"
            style={{ background: bg, display: 'block' }}
          >
            {p.value
              .split('\n')
              .filter((_, idx, arr) => idx < arr.length - 1 || _ !== '')
              .map((line) => prefix + line)
              .join('\n')}
          </Box>
        );
      })}
      {parts.length === 0 && (
        <Text size="xs" c="dimmed">
          没有差异。
        </Text>
      )}
    </Box>
  );
}

function formatTs(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function relativeTime(ts: number): string {
  const dt = Date.now() - ts;
  if (dt < 60_000) return '刚刚';
  if (dt < 3_600_000) return `${Math.floor(dt / 60_000)} 分钟前`;
  if (dt < 86_400_000) return `${Math.floor(dt / 3_600_000)} 小时前`;
  return `${Math.floor(dt / 86_400_000)} 天前`;
}
