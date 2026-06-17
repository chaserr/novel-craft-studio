import { useEffect, useState } from 'react';
import {
  Stack,
  Group,
  Text,
  Card,
  Badge,
  Button,
  Modal,
  Textarea,
  Box,
  ScrollArea,
  Tooltip,
  ActionIcon,
  Alert,
  Collapse,
  UnstyledButton
} from '@mantine/core';
import {
  IconPencil,
  IconRestore,
  IconCheck,
  IconAlertCircle,
  IconFolderOpen,
  IconChevronRight,
  IconChevronDown,
  IconFile
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useSettings } from '../stores/settingsStore';
import { api } from '../lib/ipc';

interface SkillsEditorProps {
  /** Live override mirroring AgentsEditor — pass SettingsModal's in-modal input. */
  novelCraftPathOverride?: string;
}

interface SkillMeta {
  slug: string;
  files: string[];
}

export default function SkillsEditor({
  novelCraftPathOverride
}: SkillsEditorProps = {}): JSX.Element {
  const storedPath = useSettings((s) => s.settings.novelCraftPath);
  const novelCraftPath = (novelCraftPathOverride ?? storedPath).trim();

  const [skills, setSkills] = useState<SkillMeta[]>([]);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<{ slug: string; relPath: string } | null>(null);
  const [overrideDir, setOverrideDir] = useState<string>('');

  const refresh = async (): Promise<void> => {
    // 防御：HMR 过渡瞬间 preload 可能还没刷上来，导致 api.skills 暂时 undefined。
    // 此时不抛错，渲染保持空列表即可（下一次 effect 会重试）。
    if (!api.skills) return;
    if (!novelCraftPath) {
      setSkills([]);
      setOverrides({});
      return;
    }
    try {
      const list = await api.skills.list(novelCraftPath);
      setSkills(list);
      const flags: Record<string, boolean> = {};
      await Promise.all(
        list.flatMap((s) =>
          s.files.map(async (f) => {
            flags[`${s.slug}/${f}`] = await api.skills.hasOverride(s.slug, f);
          })
        )
      );
      setOverrides(flags);
    } catch (err) {
      console.error('[SkillsEditor] refresh failed:', err);
    }
  };

  useEffect(() => {
    void refresh();
    if (api.skills) {
      void api.skills.overrideDir().then(setOverrideDir).catch(() => {
        /* IPC handler not ready; ignore */
      });
    }
  }, [novelCraftPath]);

  const handleReset = async (slug: string, relPath: string): Promise<void> => {
    await api.skills.deleteOverride(slug, relPath);
    await refresh();
    notifications.show({
      message: `已重置 ${slug}/${relPath}，恢复默认`,
      color: 'gray'
    });
  };

  if (!novelCraftPath) {
    return (
      <Alert color="yellow" variant="light" icon={<IconAlertCircle size={14} />}>
        <Text size="xs">
          请先在上方填写 novel-craft 仓库路径，才能查看 skill 文件并进行微调。
        </Text>
      </Alert>
    );
  }

  if (skills.length === 0) {
    return (
      <Alert color="gray" variant="light" icon={<IconAlertCircle size={14} />}>
        <Text size="xs">
          novel-craft/skills/ 下没找到 skill。检查仓库路径是否正确。
        </Text>
      </Alert>
    );
  }

  return (
    <Stack gap="xs">
      <Group justify="space-between" gap={6}>
        <Text size="xs" c="dimmed">
          每个文件独立覆盖。覆盖文件存在
          <Tooltip label="点这里在 Finder 打开">
            <ActionIcon
              size="xs"
              variant="subtle"
              onClick={() => overrideDir && void api.files.showInFolder(overrideDir)}
              disabled={!overrideDir}
            >
              <IconFolderOpen size={11} />
            </ActionIcon>
          </Tooltip>
          。优先级：此处覆盖 &gt; novel-craft 仓库默认。
        </Text>
      </Group>
      <Stack gap={4}>
        {skills.map((s) => {
          const open = expanded[s.slug] ?? false;
          const overriddenCount = s.files.filter(
            (f) => overrides[`${s.slug}/${f}`]
          ).length;
          return (
            <Card key={s.slug} withBorder padding="xs">
              <UnstyledButton
                onClick={() =>
                  setExpanded((m) => ({ ...m, [s.slug]: !open }))
                }
                style={{ width: '100%' }}
              >
                <Group gap={6} wrap="nowrap">
                  {open ? (
                    <IconChevronDown size={12} />
                  ) : (
                    <IconChevronRight size={12} />
                  )}
                  <Text size="sm" fw={500}>
                    {s.slug}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {s.files.length} 文件
                  </Text>
                  {overriddenCount > 0 && (
                    <Badge size="xs" color="indigo" variant="filled">
                      已覆盖 {overriddenCount}
                    </Badge>
                  )}
                </Group>
              </UnstyledButton>
              <Collapse in={open}>
                <Stack gap={2} mt={6} pl={18}>
                  {s.files.map((f) => {
                    const has = overrides[`${s.slug}/${f}`];
                    return (
                      <Group
                        key={f}
                        justify="space-between"
                        wrap="nowrap"
                        gap="sm"
                      >
                        <Group gap={6} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                          <IconFile size={12} color="var(--mantine-color-dimmed)" />
                          <Text size="xs" truncate="end" style={{ flex: 1 }}>
                            {f}
                          </Text>
                          {has && (
                            <Badge size="xs" color="indigo" variant="light">
                              已覆盖
                            </Badge>
                          )}
                        </Group>
                        <Group gap={2} wrap="nowrap">
                          <Tooltip label={has ? '编辑覆盖' : '基于默认创建覆盖'}>
                            <ActionIcon
                              variant="default"
                              size="sm"
                              onClick={() =>
                                setEditing({ slug: s.slug, relPath: f })
                              }
                            >
                              <IconPencil size={12} />
                            </ActionIcon>
                          </Tooltip>
                          {has && (
                            <Tooltip label="删除覆盖，恢复默认">
                              <ActionIcon
                                variant="default"
                                size="sm"
                                color="red"
                                onClick={() => void handleReset(s.slug, f)}
                              >
                                <IconRestore size={12} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </Group>
                      </Group>
                    );
                  })}
                </Stack>
              </Collapse>
            </Card>
          );
        })}
      </Stack>

      {editing && (
        <SkillEditModal
          slug={editing.slug}
          relPath={editing.relPath}
          novelCraftPath={novelCraftPath}
          onClose={() => {
            setEditing(null);
            void refresh();
          }}
        />
      )}
    </Stack>
  );
}

function SkillEditModal({
  slug,
  relPath,
  novelCraftPath,
  onClose
}: {
  slug: string;
  relPath: string;
  novelCraftPath: string;
  onClose: () => void;
}): JSX.Element {
  const [defaultContent, setDefaultContent] = useState<string>('');
  const [overrideContent, setOverrideContent] = useState<string>('');
  const [initialOverride, setInitialOverride] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const [d, o] = await Promise.all([
        api.skills.readDefault(slug, relPath, novelCraftPath),
        api.skills.readOverride(slug, relPath)
      ]);
      setDefaultContent(d);
      setInitialOverride(o);
      setOverrideContent(o ?? d);
      setLoading(false);
    })();
  }, [slug, relPath, novelCraftPath]);

  const dirty =
    overrideContent !== (initialOverride ?? '') && overrideContent !== '';

  const handleSave = async (): Promise<void> => {
    if (!overrideContent.trim()) {
      notifications.show({ message: '内容为空，不保存', color: 'yellow' });
      return;
    }
    await api.skills.saveOverride(slug, relPath, overrideContent);
    notifications.show({
      message: `${slug}/${relPath} 覆盖已保存`,
      color: 'green'
    });
    onClose();
  };

  return (
    <Modal
      opened
      onClose={onClose}
      size="xl"
      centered
      title={
        <Group gap={6}>
          <Text fw={600}>编辑 skill 文件</Text>
          <Badge variant="light" color="indigo">
            {slug}
          </Badge>
          <Text size="xs" c="dimmed">
            {relPath}
          </Text>
        </Group>
      }
    >
      <Stack gap="sm">
        <Alert variant="light" color="blue" icon={<IconAlertCircle size={14} />}>
          <Text size="xs">
            左侧是 novel-craft 仓库里的<b>默认内容</b>（只读，供参考）。
            右侧是<b>你的覆盖</b>，保存后下次该 skill 加载用这份。
            想完全恢复默认？关闭后点列表里的「↻ 重置」即可。
          </Text>
        </Alert>

        <Group grow align="stretch" style={{ minHeight: 420 }}>
          <Box>
            <Text size="xs" fw={600} mb={4} c="dimmed">
              默认 (read-only)
            </Text>
            <ScrollArea h={420} type="auto">
              <Textarea
                value={loading ? '加载中…' : defaultContent}
                readOnly
                autosize
                minRows={20}
                styles={{
                  input: {
                    fontFamily: 'var(--mantine-font-family-monospace)',
                    fontSize: 12,
                    cursor: 'default'
                  }
                }}
              />
            </ScrollArea>
          </Box>
          <Box>
            <Group justify="space-between" mb={4}>
              <Text size="xs" fw={600} c="dimmed">
                你的覆盖
              </Text>
              {initialOverride && (
                <Badge size="xs" color="indigo" variant="light">
                  已存在覆盖
                </Badge>
              )}
            </Group>
            <ScrollArea h={420} type="auto">
              <Textarea
                value={loading ? '' : overrideContent}
                onChange={(e) => setOverrideContent(e.currentTarget.value)}
                autosize
                minRows={20}
                placeholder="基于默认改一改，或者整段重写"
                styles={{
                  input: {
                    fontFamily: 'var(--mantine-font-family-monospace)',
                    fontSize: 12
                  }
                }}
              />
            </ScrollArea>
          </Box>
        </Group>

        <Group justify="space-between">
          <Button
            size="xs"
            variant="subtle"
            color="gray"
            onClick={() => setOverrideContent(defaultContent)}
          >
            重置为默认（不删覆盖）
          </Button>
          <Group gap="xs">
            <Button size="xs" variant="default" onClick={onClose}>
              取消
            </Button>
            <Button
              size="xs"
              variant="filled"
              leftSection={<IconCheck size={14} />}
              onClick={() => void handleSave()}
              disabled={!dirty}
            >
              保存覆盖
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
