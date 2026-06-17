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
  Alert
} from '@mantine/core';
import {
  IconPencil,
  IconRestore,
  IconCheck,
  IconAlertCircle,
  IconFolderOpen
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { AGENTS } from '../lib/agents';
import { useSettings } from '../stores/settingsStore';
import { api } from '../lib/ipc';
import type { AgentRole } from '../../shared/types';

interface AgentsEditorProps {
  /**
   * Live override for novel-craft path. SettingsModal passes its in-modal
   * input value so the editor reflects what the user just typed/picked,
   * before they click "保存" and the store updates.
   */
  novelCraftPathOverride?: string;
}

export default function AgentsEditor({
  novelCraftPathOverride
}: AgentsEditorProps = {}): JSX.Element {
  const storedPath = useSettings((s) => s.settings.novelCraftPath);
  const novelCraftPath = (novelCraftPathOverride ?? storedPath).trim();
  const [overrides, setOverrides] = useState<Record<AgentRole, boolean>>(
    {} as Record<AgentRole, boolean>
  );
  const [editing, setEditing] = useState<AgentRole | null>(null);
  const [overrideDir, setOverrideDir] = useState<string>('');

  const refresh = async (): Promise<void> => {
    const map = {} as Record<AgentRole, boolean>;
    await Promise.all(
      AGENTS.map(async (a) => {
        map[a.id] = await api.agents.hasOverride(a.id);
      })
    );
    setOverrides(map);
  };

  useEffect(() => {
    void refresh();
    void api.agents.overrideDir().then(setOverrideDir);
  }, []);

  const handleReset = async (role: AgentRole): Promise<void> => {
    await api.agents.deleteOverride(role);
    await refresh();
    notifications.show({ message: `已重置 ${role}，恢复默认 prompt`, color: 'gray' });
  };

  if (!novelCraftPath) {
    return (
      <Alert color="yellow" variant="light" icon={<IconAlertCircle size={14} />}>
        <Text size="xs">
          请先在上方填写 novel-craft 仓库路径，才能查看默认 agent prompt 并进行微调。
        </Text>
      </Alert>
    );
  }

  return (
    <Stack gap="xs">
      <Group justify="space-between" gap={6}>
        <Text size="xs" c="dimmed">
          微调单个 agent 的 system prompt。覆盖文件存在
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
          。优先级：此处覆盖 &gt; 自定义 agents 路径 &gt; novel-craft 默认。
        </Text>
      </Group>
      <Stack gap={4}>
        {AGENTS.map((a) => {
          const has = overrides[a.id];
          return (
            <Card key={a.id} withBorder padding="xs">
              <Group justify="space-between" wrap="nowrap" gap="sm">
                <Box style={{ minWidth: 0, flex: 1 }}>
                  <Group gap={6} wrap="nowrap">
                    <Text size="sm" fw={500} truncate="end">
                      {a.label}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {a.id}
                    </Text>
                    {has && (
                      <Badge size="xs" color="indigo" variant="filled">
                        已覆盖
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed" truncate="end">
                    {a.shortDescription}
                  </Text>
                </Box>
                <Group gap={4} wrap="nowrap">
                  <Tooltip label={has ? '编辑覆盖' : '基于默认创建覆盖'}>
                    <ActionIcon
                      variant="default"
                      size="md"
                      onClick={() => setEditing(a.id)}
                    >
                      <IconPencil size={14} />
                    </ActionIcon>
                  </Tooltip>
                  {has && (
                    <Tooltip label="删除覆盖，恢复默认">
                      <ActionIcon
                        variant="default"
                        size="md"
                        color="red"
                        onClick={() => void handleReset(a.id)}
                      >
                        <IconRestore size={14} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Group>
              </Group>
            </Card>
          );
        })}
      </Stack>

      {editing && (
        <AgentEditModal
          role={editing}
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

function AgentEditModal({
  role,
  novelCraftPath,
  onClose
}: {
  role: AgentRole;
  novelCraftPath: string;
  onClose: () => void;
}): JSX.Element {
  const meta = AGENTS.find((a) => a.id === role);
  const [defaultPrompt, setDefaultPrompt] = useState<string>('');
  const [overrideContent, setOverrideContent] = useState<string>('');
  const [initialOverride, setInitialOverride] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const [d, o] = await Promise.all([
        api.agents.readDefault(role, novelCraftPath),
        api.agents.readOverride(role)
      ]);
      setDefaultPrompt(d);
      setInitialOverride(o);
      setOverrideContent(o ?? d);
      setLoading(false);
    })();
  }, [role, novelCraftPath]);

  const dirty = overrideContent !== (initialOverride ?? '') && overrideContent !== '';

  const handleSave = async (): Promise<void> => {
    if (!overrideContent.trim()) {
      notifications.show({ message: '内容为空，不保存', color: 'yellow' });
      return;
    }
    await api.agents.saveOverride(role, overrideContent);
    notifications.show({ message: `${role} 覆盖已保存`, color: 'green' });
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
          <Text fw={600}>编辑 agent prompt</Text>
          <Badge variant="light" color="indigo">
            {meta?.label ?? role}
          </Badge>
          <Text size="xs" c="dimmed">
            {role}
          </Text>
        </Group>
      }
    >
      <Stack gap="sm">
        <Alert variant="light" color="blue" icon={<IconAlertCircle size={14} />}>
          <Text size="xs">
            左侧是 novel-craft 仓库里的<b>默认 prompt</b>（只读，供参考）。
            右侧是<b>你的覆盖</b>，保存后下次执行该角色就用这份。
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
                value={loading ? '加载中…' : defaultPrompt}
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
                placeholder="基于默认改一改，或者整个重写"
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
            onClick={() => setOverrideContent(defaultPrompt)}
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
