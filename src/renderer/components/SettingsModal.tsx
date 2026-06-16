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
  Alert,
  SegmentedControl
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
  const customAgentsPath = useSettings((s) => s.settings.customAgentsPath ?? '');
  const activeProvider = useSettings((s) => s.settings.activeProvider);
  const hasApiKey = useSettings((s) => s.hasApiKey);
  const setPath = useSettings((s) => s.setNovelCraftPath);
  const setCustomAgentsPath = useSettings((s) => s.setCustomAgentsPath);
  const setActiveProvider = useSettings((s) => s.setActiveProvider);
  const setKey = useSettings((s) => s.setApiKey);
  const [agentsPath, setAgentsPathLocal] = useState<string>(customAgentsPath);

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
    await setCustomAgentsPath(agentsPath.trim());
    for (const p of Object.keys(keys) as ProviderId[]) {
      if (keys[p]) await setKey(p, keys[p]);
    }
    notifications.show({ message: '设置已保存', color: 'green' });
    onClose();
  };

  const pickAgentsDir = async (): Promise<void> => {
    const dir = await api.project.pickDirectory();
    if (dir) setAgentsPathLocal(dir);
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

        {/* 自定义 agents 路径（覆盖默认 novel-craft/agents/） */}
        <div>
          <Text size="sm" fw={500} mb={4}>
            自定义 agents 路径（可选）
          </Text>
          <Text size="xs" c="dimmed" mb={6}>
            想替换或微调单个 novel-* agent 的 system prompt？把改过的{' '}
            <code>novel-writer.md</code> / <code>novel-polisher.md</code> 等放进
            一个文件夹，填这里即可。优先级：此处文件 &gt; novel-craft 默认。
            留空则全部用 novel-craft 默认。
          </Text>
          <Group gap="xs">
            <TextInput
              value={agentsPath}
              onChange={(e) => setAgentsPathLocal(e.currentTarget.value)}
              placeholder="留空 = 用 novel-craft/agents/ 默认；填则用你的自定义"
              style={{ flex: 1 }}
            />
            <Button variant="default" onClick={() => void pickAgentsDir()}>
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

        {/* 默认 provider —— 聊天框/工作流默认走它 */}
        <Box>
          <Text size="xs" fw={500} mb={4}>
            默认使用
          </Text>
          <Text size="xs" c="dimmed" mb={6}>
            聊天框和工作流默认调用这个 provider。下面的 tab 只是分别配置每个 provider 的登录态，并不会切换默认。
          </Text>
          <SegmentedControl
            size="xs"
            fullWidth
            value={activeProvider}
            onChange={(v) => void setActiveProvider(v as ProviderId)}
            data={(Object.keys(PROVIDER_LABELS) as ProviderId[]).map((p) => ({
              value: p,
              label: PROVIDER_LABELS[p]
            }))}
          />
        </Box>

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

                {p !== 'deepseek' && authStatus[p].strategy === 'cli' && (
                  <Alert
                    variant="light"
                    color="green"
                    icon={<IconAlertCircle size={14} />}
                  >
                    <Text size="xs">
                      <b>已自动复用本机 {p === 'openai' ? 'Codex' : 'Claude Code'} CLI 登录态。</b>
                      不需要再走 OAuth。如果 token 失效，CLI 会自动续期；或在终端跑一次{' '}
                      <code>{p === 'openai' ? 'codex login' : 'claude /login'}</code>。
                    </Text>
                  </Alert>
                )}
                {p !== 'deepseek' && authStatus[p].strategy !== 'cli' && (
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
