import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Stack,
  Textarea,
  ActionIcon,
  Group,
  ScrollArea,
  Paper,
  Text,
  Tooltip,
  Alert,
  Title,
  Menu,
  Button,
  Badge,
  UnstyledButton,
  Center,
  SegmentedControl
} from '@mantine/core';
import {
  IconSend,
  IconPlayerStop,
  IconAlertCircle,
  IconMessage,
  IconPlus,
  IconChevronDown,
  IconRobot,
  IconCheck,
  IconFileText
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChat } from '../stores/chatStore';
import { useSettings } from '../stores/settingsStore';
import { useProject } from '../stores/projectStore';
import { buildSystemPrompt } from '../lib/prompt';
import { api } from '../lib/ipc';
import type {
  ChatMessage,
  ChatMode,
  ChatSessionSummary,
  ProviderId,
  ReasoningEffort
} from '../../shared/types';

const PROVIDER_LABELS: Record<ProviderId, string> = {
  deepseek: 'DeepSeek',
  anthropic: 'Claude',
  openai: 'ChatGPT'
};

const MODE_OPTIONS: { value: ChatMode; label: string; hint: string }[] = [
  { value: 'ask', label: 'Ask', hint: '只问答，不动文件' },
  { value: 'edit', label: 'Edit', hint: '围绕当前文件给出完整修订版本（带应用按钮）' },
  {
    value: 'agent',
    label: 'Agent',
    hint: '自主多步：Codex CLI 可读写项目文件（仅 ChatGPT + Codex CLI 可用）'
  }
];

/**
 * 推理强度档位 — 对应 codex CLI 的 model_reasoning_effort。
 * 低 ≈ 快、token 少；高 ≈ 慢、思考深。
 */
const EFFORT_OPTIONS: { value: ReasoningEffort; label: string; hint: string }[] = [
  { value: 'low', label: '低', hint: '快，token 少（适合改字、回弹问答）' },
  { value: 'medium', label: '中', hint: '默认平衡' },
  { value: 'high', label: '高', hint: '慢但思考深（适合大纲、结构问题）' }
];

export default function ChatPanel(): JSX.Element {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // chat store
  const sessions = useChat((s) => s.sessions);
  const current = useChat((s) => s.current);
  const mode = useChat((s) => s.mode);
  const reasoningEffort = useChat((s) => s.reasoningEffort);
  const streaming = useChat((s) => s.streaming);
  const error = useChat((s) => s.error);
  const loadList = useChat((s) => s.loadList);
  const newSession = useChat((s) => s.newSession);
  const selectSession = useChat((s) => s.selectSession);
  const setMode = useChat((s) => s.setMode);
  const setReasoningEffort = useChat((s) => s.setReasoningEffort);
  const send = useChat((s) => s.send);
  const cancel = useChat((s) => s.cancel);
  const clearError = useChat((s) => s.clearError);

  const activeProvider = useSettings((s) => s.settings.activeProvider);
  // badge 颜色看真实 auth 状态（含 CLI 登录），不仅仅 API key
  const authConfigured = useSettings(
    (s) => s.authStrategy[activeProvider] !== 'none'
  );
  const projectMeta = useProject((s) => s.meta);
  const files = useProject((s) => s.files);
  const activeFilePath = useProject((s) => s.activeFilePath);
  const activeFileContent = useProject((s) => s.activeFileContent);
  const reloadActiveFile = useProject((s) => s.reloadActiveFile);

  useEffect(() => {
    void loadList(projectMeta?.rootPath);
  }, [loadList, projectMeta?.rootPath]);

  // Auto-scroll on new messages
  useEffect(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    });
  }, [current?.messages]);

  // Agent 模式只在 openai 下有意义（依赖 codex CLI 的 workspace-write 沙箱）。
  // 切到 deepseek/anthropic 时自动降级到 ask。
  useEffect(() => {
    if (mode === 'agent' && activeProvider !== 'openai') {
      setMode('ask');
    }
  }, [mode, activeProvider, setMode]);

  const activeFileName = activeFilePath?.split('/').pop() ?? null;

  const handleSend = async (): Promise<void> => {
    const text = input.trim();
    if (!text || streaming) return;
    if (mode === 'edit' && !activeFilePath) {
      notifications.show({
        title: 'Edit 模式需要先打开一个文件',
        message: '左侧选中一个章节/RTK 文件再发送',
        color: 'yellow'
      });
      return;
    }
    const systemPrompt = await buildSystemPrompt({
      rootPath: projectMeta?.rootPath ?? null,
      files,
      activeFilePath,
      activeFileContent
    });
    setInput('');
    await send(text, systemPrompt, projectMeta?.rootPath);
  };

  const handleNewSession = (): void => {
    newSession();
  };

  return (
    <Box display="flex" style={{ flexDirection: 'column', height: '100%' }} bg="var(--mantine-color-body)">
      {/* ----------- 顶栏：会话切换 + 新建 + provider 状态 ----------- */}
      <Group gap="xs" px="xs" py={6} justify="space-between" bd="1px solid var(--mantine-color-default-border)">
        <SessionPicker
          sessions={sessions}
          current={current?.id ?? null}
          onSelect={(id) => void selectSession(id)}
        />
        <Group gap={4}>
          <Tooltip label="新建对话">
            <ActionIcon variant="default" onClick={handleNewSession}>
              <IconPlus size={14} />
            </ActionIcon>
          </Tooltip>
          <Badge size="sm" variant="light" color={authConfigured ? 'green' : 'gray'}>
            {PROVIDER_LABELS[activeProvider]}
          </Badge>
        </Group>
      </Group>

      {/* ----------- 中间：消息流 ----------- */}
      {!current || current.messages.length === 0 ? (
        <EmptyState
          bookTitle={projectMeta?.bookTitle}
          onSeed={(text) => setInput(text)}
        />
      ) : (
        <ScrollArea viewportRef={scrollRef} style={{ flex: 1 }} p="sm">
          <Stack gap="sm">
            {current.messages.map((m, i) => (
              <MessageBubble
                key={i}
                message={m}
                provider={activeProvider}
                isEdit={mode === 'edit'}
                isLastAssistant={
                  i === current.messages.length - 1 && m.role === 'assistant'
                }
                activeFilePath={activeFilePath}
                activeFileName={activeFileName}
                onApplied={() => void reloadActiveFile()}
              />
            ))}
            {error && (
              <Alert
                color="red"
                variant="light"
                icon={<IconAlertCircle size={16} />}
                withCloseButton
                onClose={clearError}
              >
                {error}
              </Alert>
            )}
          </Stack>
        </ScrollArea>
      )}

      {/* ----------- 底部：输入框 + 工具栏（Codex 风格） ----------- */}
      <Box p="sm" bd="1px solid var(--mantine-color-default-border)">
        <Paper
          radius="lg"
          p="xs"
          bg="var(--mantine-color-default)"
          style={{ border: '1px solid var(--mantine-color-default-border)' }}
        >
          {/* mode 切换条 + 速度档 */}
          <Group justify="space-between" gap="xs" px={4} pb={4} wrap="nowrap">
            <SegmentedControl
              size="xs"
              value={mode}
              onChange={(v) => setMode(v as ChatMode)}
              data={MODE_OPTIONS.map((m) => ({
                value: m.value,
                label: m.label,
                disabled: m.value === 'agent' && activeProvider !== 'openai'
              }))}
            />
            <Tooltip
              label={`推理强度：${
                EFFORT_OPTIONS.find((e) => e.value === reasoningEffort)?.hint ?? ''
              }`}
              position="top"
            >
              <SegmentedControl
                size="xs"
                value={reasoningEffort}
                onChange={(v) => setReasoningEffort(v as ReasoningEffort)}
                data={EFFORT_OPTIONS.map((e) => ({ value: e.value, label: e.label }))}
              />
            </Tooltip>
          </Group>

          <Textarea
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            placeholder={
              mode === 'edit'
                ? activeFileName
                  ? `针对 ${activeFileName} 提改写需求…（Enter 发送 / Shift+Enter 换行）`
                  : '请先在左侧打开一个文件…'
                : current
                  ? '随心输入… (Enter 发送 / Shift+Enter 换行)'
                  : '开始新对话…'
            }
            autosize
            minRows={2}
            maxRows={10}
            variant="unstyled"
            styles={{ input: { padding: '4px 8px' } }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            disabled={streaming}
          />
          <Group justify="space-between" mt={4} px={4} wrap="nowrap">
            <Group gap={4} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
              <Badge size="xs" variant="light" color="indigo" leftSection={<IconRobot size={10} />}>
                {PROVIDER_LABELS[activeProvider]}
              </Badge>
              {projectMeta && (
                <Badge
                  size="xs"
                  variant="light"
                  color="grape"
                  maw={140}
                  styles={{
                    root: { overflow: 'hidden' },
                    label: {
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }
                  }}
                  title={projectMeta.bookTitle}
                >
                  {projectMeta.bookTitle}
                </Badge>
              )}
              {mode === 'edit' && activeFileName && (
                <Badge
                  size="xs"
                  variant="light"
                  color="teal"
                  leftSection={<IconFileText size={10} />}
                  maw={160}
                  styles={{
                    root: { overflow: 'hidden' },
                    label: {
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }
                  }}
                  title={activeFileName}
                >
                  {activeFileName}
                </Badge>
              )}
            </Group>
            {streaming ? (
              <ActionIcon
                color="red"
                radius="xl"
                variant="filled"
                onClick={() => void cancel()}
              >
                <IconPlayerStop size={14} />
              </ActionIcon>
            ) : (
              <ActionIcon
                radius="xl"
                variant="filled"
                color="indigo"
                onClick={() => void handleSend()}
                disabled={!input.trim()}
              >
                <IconSend size={14} />
              </ActionIcon>
            )}
          </Group>
        </Paper>
      </Box>
    </Box>
  );
}

/* ============================================================ */
/*                       Sub-components                          */
/* ============================================================ */

interface MessageBubbleProps {
  message: ChatMessage;
  provider: ProviderId;
  isEdit: boolean;
  isLastAssistant: boolean;
  activeFilePath: string | null;
  activeFileName: string | null;
  onApplied: () => void;
}

function MessageBubble({
  message,
  provider,
  isEdit,
  isLastAssistant,
  activeFilePath,
  activeFileName,
  onApplied
}: MessageBubbleProps): JSX.Element {
  const proposed = useMemo(
    () =>
      message.role === 'assistant'
        ? extractFencedBlock(message.content)
        : null,
    [message.content, message.role]
  );

  const showApply =
    isEdit && isLastAssistant && proposed != null && activeFilePath != null;

  const onApply = async (): Promise<void> => {
    if (!activeFilePath || !proposed) return;
    try {
      await api.files.write(activeFilePath, proposed);
      onApplied();
      notifications.show({
        message: `已应用到 ${activeFileName ?? activeFilePath}`,
        color: 'green'
      });
    } catch (err) {
      notifications.show({
        title: '应用失败',
        message: err instanceof Error ? err.message : String(err),
        color: 'red'
      });
    }
  };

  return (
    <Paper
      p="sm"
      radius="md"
      bg={
        message.role === 'user'
          ? 'var(--mantine-color-indigo-light)'
          : 'var(--mantine-color-default)'
      }
      withBorder
    >
      <Text size="xs" c="dimmed" mb={4}>
        {message.role === 'user' ? '你' : PROVIDER_LABELS[provider]}
      </Text>
      {message.role === 'assistant' ? (
        <Box className="markdown-body" style={{ fontSize: 14 }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
          {showApply && (
            <Group mt="xs" gap="xs">
              <Button
                size="xs"
                color="teal"
                leftSection={<IconCheck size={12} />}
                onClick={() => void onApply()}
              >
                应用到 {activeFileName ?? '当前文件'}
              </Button>
              <Text size="xs" c="dimmed">
                （会覆盖当前文件全部内容）
              </Text>
            </Group>
          )}
        </Box>
      ) : (
        <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
          {message.content}
        </Text>
      )}
    </Paper>
  );
}

/**
 * Edit 模式下找出回答里 **最后一个** 围栏代码块的内容。
 * 支持 ```markdown / ```md / ``` 三种围栏。
 */
function extractFencedBlock(text: string): string | null {
  const re = /```(?:markdown|md)?\n([\s\S]*?)\n```/g;
  let last: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    last = m[1];
  }
  return last;
}

interface SessionPickerProps {
  sessions: ChatSessionSummary[];
  current: string | null;
  onSelect: (id: string) => void;
}

function SessionPicker({
  sessions,
  current,
  onSelect
}: SessionPickerProps): JSX.Element {
  const currentSess = sessions.find((s) => s.id === current);
  return (
    <Menu shadow="md" width={300} position="bottom-start" withinPortal>
      <Menu.Target>
        <UnstyledButton style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <IconMessage size={14} />
          <Text size="sm" fw={500} truncate="end" maw={180}>
            {currentSess?.title ?? '历史对话'}
          </Text>
          <IconChevronDown size={12} />
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        {sessions.length === 0 ? (
          <Menu.Item disabled>还没有对话历史</Menu.Item>
        ) : (
          sessions.slice(0, 50).map((s) => (
            <Menu.Item key={s.id} onClick={() => onSelect(s.id)}>
              <Text size="sm" truncate="end">
                {s.title}
              </Text>
              <Text size="xs" c="dimmed">
                {s.messageCount} 条 · {new Date(s.updatedAt).toLocaleString('zh-CN')}
              </Text>
            </Menu.Item>
          ))
        )}
      </Menu.Dropdown>
    </Menu>
  );
}

interface EmptyStateProps {
  bookTitle?: string;
  onSeed: (text: string) => void;
}

function EmptyState({ bookTitle, onSeed }: EmptyStateProps): JSX.Element {
  const suggestions = bookTitle
    ? [
        `我们应该在《${bookTitle}》里写什么？`,
        '这一章的标题取什么好',
        '给我 3 个备选人物名字',
        '这个伏笔该怎么收'
      ]
    : [
        '帮我起草一个题材方向',
        '怎么避免章节结尾的"感悟收束"模板',
        '这个人物动机够吗',
        '帮我想 3 个备选标题'
      ];
  return (
    <Center style={{ flex: 1 }} p="xl">
      <Stack align="center" gap="lg" maw={420} style={{ width: '100%', minWidth: 0 }}>
        <Title
          order={3}
          ta="center"
          c="dimmed"
          style={{
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
            maxWidth: '100%'
          }}
        >
          {bookTitle
            ? `我们应该在《${bookTitle}》里写什么？`
            : '随心问，处理小说边角问题'}
        </Title>
        <Stack gap={6} w="100%">
          {suggestions.map((s) => (
            <Button
              key={s}
              variant="default"
              size="sm"
              justify="flex-start"
              onClick={() => onSeed(s)}
              styles={{ inner: { justifyContent: 'flex-start' } }}
            >
              {s}
            </Button>
          ))}
        </Stack>
      </Stack>
    </Center>
  );
}
