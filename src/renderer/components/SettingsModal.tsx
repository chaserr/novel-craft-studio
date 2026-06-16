import { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Stack,
  TextInput,
  PasswordInput,
  Button,
  Group,
  Text,
  Divider,
  Tabs,
  Badge,
  Box,
  Alert
} from '@mantine/core';
import { IconDownload, IconLogin2, IconAlertCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useSettings } from '../stores/settingsStore';
import type { ProviderId } from '../../shared/types';
import { api } from '../lib/ipc';

interface Props {
  opened: boolean;
  onClose: () => void;
}

const PROVIDER_LABELS: Record<ProviderId, string> = {
  deepseek: 'DeepSeek',
  anthropic: 'Claude',
  openai: 'OpenAI'
};

const PROVIDER_HELP_OAUTH: Record<ProviderId, string> = {
  deepseek: '',
  anthropic:
    '推荐用 Claude Pro/Max 订阅登录（点"用 Claude 登录"，弹出浏览器走 OAuth）。' +
    '已用 Claude Code CLI 登录过的会自动复用。',
  openai:
    '推荐用 ChatGPT Plus/Pro 订阅登录（点"用 ChatGPT 登录"）。' +
    '已用 Codex CLI 登录过的会自动复用。'
};

const PROVIDER_HELP_APIKEY: Record<ProviderId, string> = {
  deepseek:
    '⭐ 推荐首选。从 https://platform.deepseek.com/api_keys 创建 API key。中文写作能力强，价格便宜（充值 5 元 ≈ 几十万 token）。',
  anthropic:
    '如不想用 OAuth，可从 https://console.anthropic.com/settings/keys 创建独立 API key（与 Claude.ai 订阅是两套账户）。',
  openai:
    '如不想用 OAuth，可从 https://platform.openai.com/api-keys 创建独立 API key（与 ChatGPT 订阅是两套账户）。'
};

export default function SettingsModal({ opened, onClose }: Props): JSX.Element {
  const novelCraftPath = useSettings((s) => s.settings.novelCraftPath);
  const hasApiKey = useSettings((s) => s.hasApiKey);
  const setPath = useSettings((s) => s.setNovelCraftPath);
  const setKey = useSettings((s) => s.setApiKey);

  const [path, setLocalPath] = useState(novelCraftPath);
  const [downloading, setDownloading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<ProviderId | null>(null);
  const [authStatus, setAuthStatus] = useState<Record<ProviderId, { strategy: string; label: string }>>({
    openai: { strategy: 'none', label: '未配置' },
    anthropic: { strategy: 'none', label: '未配置' },
    deepseek: { strategy: 'none', label: '未配置' }
  });
  const [keys, setKeys] = useState<Record<ProviderId, string>>({
    openai: '',
    anthropic: '',
    deepseek: ''
  });

  const refreshStatus = useCallback(async (): Promise<void> => {
    const [o, a, d] = await Promise.all([
      api.llm.probeAuth('openai'),
      api.llm.probeAuth('anthropic'),
      api.llm.probeAuth('deepseek')
    ]);
    setAuthStatus({ openai: o, anthropic: a, deepseek: d });
  }, []);

  useEffect(() => {
    if (opened) {
      setLocalPath(novelCraftPath);
      setKeys({ openai: '', anthropic: '', deepseek: '' });
      void refreshStatus();
    }
  }, [opened, novelCraftPath, refreshStatus]);

  const pickPath = async (): Promise<void> => {
    const dir = await api.project.pickDirectory();
    if (dir) setLocalPath(dir);
  };

  const downloadNovelCraft = async (): Promise<void> => {
    setDownloading(true);
    try {
      const dir = await api.settings.downloadNovelCraft();
      setLocalPath(dir);
      await useSettings.getState().load();
      notifications.show({
        title: '下载完成',
        message: `novel-craft 已下载到 ${dir}`,
        color: 'green'
      });
    } catch (err) {
      notifications.show({
        title: '下载失败',
        message: err instanceof Error ? err.message : String(err),
        color: 'red',
        autoClose: false
      });
    } finally {
      setDownloading(false);
    }
  };

  const startOauth = async (p: ProviderId): Promise<void> => {
    setOauthLoading(p);
    try {
      await api.llm.oauthLogin(p);
      await refreshStatus();
      await useSettings.getState().load();
      notifications.show({
        title: '登录成功',
        message: `${PROVIDER_LABELS[p]} OAuth 完成`,
        color: 'green'
      });
    } catch (err) {
      notifications.show({
        title: '登录失败',
        message: err instanceof Error ? err.message : String(err),
        color: 'red',
        autoClose: false
      });
    } finally {
      setOauthLoading(null);
    }
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
    <Modal opened={opened} onClose={onClose} title="设置" size="xl" centered>
      <Stack gap="md">
        {/* novel-craft 路径 */}
        <div>
          <Text size="sm" fw={500} mb={4}>
            novel-craft 仓库路径
          </Text>
          <Text size="xs" c="dimmed" mb={6}>
            新建项目时从这里的 templates 读取小说模板。建议点"自动下载"。
          </Text>
          <Group gap="xs">
            <TextInput
              value={path}
              onChange={(e) => setLocalPath(e.currentTarget.value)}
              placeholder="点右边自动下载，或选择本地 clone 的 novel-craft 仓库"
              style={{ flex: 1 }}
            />
            <Button
              variant="filled"
              leftSection={<IconDownload size={14} />}
              onClick={() => void downloadNovelCraft()}
              loading={downloading}
            >
              自动下载
            </Button>
            <Button variant="default" onClick={() => void pickPath()}>
              选择…
            </Button>
          </Group>
        </div>

        <Divider />

        <Text size="sm" fw={500}>
          LLM 登录
        </Text>
        <Alert variant="light" color="blue" icon={<IconAlertCircle size={14} />}>
          <Text size="xs">
            <b>三层兜底</b>：本机 CLI token (最稳) → 自实现 OAuth (灰色地带) → 手填 API key (永远兜底)。
            DeepSeek 没有 OAuth，只走 API key。
          </Text>
        </Alert>

        <Tabs defaultValue="anthropic">
          <Tabs.List>
            {(Object.keys(PROVIDER_LABELS) as ProviderId[]).map((p) => {
              const st = authStatus[p];
              return (
                <Tabs.Tab key={p} value={p}>
                  {PROVIDER_LABELS[p]}{' '}
                  <StatusBadge strategy={st.strategy} />
                </Tabs.Tab>
              );
            })}
          </Tabs.List>
          {(Object.keys(PROVIDER_LABELS) as ProviderId[]).map((p) => (
            <Tabs.Panel key={p} value={p} pt="md">
              <Stack gap="sm">
                <Box>
                  <Text size="xs" c="dimmed">
                    当前状态：<b>{authStatus[p].label}</b>
                  </Text>
                </Box>

                {p !== 'deepseek' && (
                  <>
                    <Text size="xs">{PROVIDER_HELP_OAUTH[p]}</Text>
                    <Button
                      leftSection={<IconLogin2 size={14} />}
                      variant="filled"
                      onClick={() => void startOauth(p)}
                      loading={oauthLoading === p}
                    >
                      用 {PROVIDER_LABELS[p]} 登录（OAuth）
                    </Button>
                    <Divider variant="dashed" label="或" labelPosition="center" />
                  </>
                )}

                <Text size="xs" c="dimmed">
                  {PROVIDER_HELP_APIKEY[p]}
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
                      await refreshStatus();
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

function StatusBadge({ strategy }: { strategy: string }): JSX.Element {
  if (strategy === 'cli') return <Badge size="xs" color="green">CLI</Badge>;
  if (strategy === 'apikey') return <Badge size="xs" color="blue">key</Badge>;
  return <Badge size="xs" color="gray">未配置</Badge>;
}
