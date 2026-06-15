import { useState, useEffect } from 'react';
import {
  Modal,
  Stack,
  TextInput,
  PasswordInput,
  Button,
  Group,
  Text,
  Divider,
  Tabs
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useSettings } from '../stores/settingsStore';
import type { ProviderId } from '../../shared/types';
import { api } from '../lib/ipc';

interface Props {
  opened: boolean;
  onClose: () => void;
}

const PROVIDER_LABELS: Record<ProviderId, string> = {
  openai: 'OpenAI',
  anthropic: 'Claude (Anthropic)',
  deepseek: 'DeepSeek'
};

const PROVIDER_HELP: Record<ProviderId, string> = {
  openai: '从 https://platform.openai.com/api-keys 创建 API key',
  anthropic: '从 https://console.anthropic.com/settings/keys 创建 API key',
  deepseek: '从 https://platform.deepseek.com/api_keys 创建 API key'
};

export default function SettingsModal({ opened, onClose }: Props): JSX.Element {
  const novelCraftPath = useSettings((s) => s.settings.novelCraftPath);
  const hasApiKey = useSettings((s) => s.hasApiKey);
  const setPath = useSettings((s) => s.setNovelCraftPath);
  const setKey = useSettings((s) => s.setApiKey);

  const [path, setLocalPath] = useState(novelCraftPath);
  const [keys, setKeys] = useState<Record<ProviderId, string>>({
    openai: '',
    anthropic: '',
    deepseek: ''
  });

  useEffect(() => {
    if (opened) {
      setLocalPath(novelCraftPath);
      setKeys({ openai: '', anthropic: '', deepseek: '' });
    }
  }, [opened, novelCraftPath]);

  const pickPath = async (): Promise<void> => {
    const dir = await api.project.pickDirectory();
    if (dir) setLocalPath(dir);
  };

  const handleSave = async (): Promise<void> => {
    await setPath(path.trim());
    for (const p of Object.keys(keys) as ProviderId[]) {
      if (keys[p]) await setKey(p, keys[p]);
    }
    notifications.show({ message: '设置已保存', color: 'green' });
    onClose();
  };

  return (
    <Modal opened={opened} onClose={onClose} title="设置" size="lg" centered>
      <Stack gap="md">
        <div>
          <Text size="sm" fw={500} mb={4}>
            novel-craft 仓库路径
          </Text>
          <Text size="xs" c="dimmed" mb={6}>
            新建项目时会从该仓库的 templates 目录读取模板。建议{' '}
            <code>git clone https://github.com/chaserr/novel-craft.git</code>{' '}
            后填入本地路径。
          </Text>
          <Group gap="xs">
            <TextInput
              value={path}
              onChange={(e) => setLocalPath(e.currentTarget.value)}
              placeholder="/path/to/novel-craft"
              style={{ flex: 1 }}
            />
            <Button variant="default" onClick={() => void pickPath()}>
              选择…
            </Button>
          </Group>
        </div>

        <Divider />

        <Text size="sm" fw={500}>
          API Keys
        </Text>
        <Text size="xs" c="dimmed">
          API key 通过系统 keychain 加密存储。留空表示不修改已有的 key。
        </Text>

        <Tabs defaultValue="anthropic">
          <Tabs.List>
            {(Object.keys(PROVIDER_LABELS) as ProviderId[]).map((p) => (
              <Tabs.Tab key={p} value={p}>
                {PROVIDER_LABELS[p]} {hasApiKey[p] ? '✓' : ''}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {(Object.keys(PROVIDER_LABELS) as ProviderId[]).map((p) => (
            <Tabs.Panel key={p} value={p} pt="md">
              <Stack gap="xs">
                <Text size="xs" c="dimmed">
                  {PROVIDER_HELP[p]}
                </Text>
                <PasswordInput
                  value={keys[p]}
                  onChange={(e) =>
                    setKeys({ ...keys, [p]: e.currentTarget.value })
                  }
                  placeholder={
                    hasApiKey[p] ? '已设置（输入新值可替换）' : '粘贴 API key'
                  }
                />
                {hasApiKey[p] && (
                  <Button
                    size="xs"
                    variant="subtle"
                    color="red"
                    onClick={async () => {
                      await api.settings.deleteApiKey(p);
                      await useSettings.getState().load();
                      notifications.show({
                        message: `已删除 ${PROVIDER_LABELS[p]} 的 API key`
                      });
                    }}
                  >
                    删除已存储的 key
                  </Button>
                )}
              </Stack>
            </Tabs.Panel>
          ))}
        </Tabs>

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            取消
          </Button>
          <Button onClick={() => void handleSave()}>保存</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
