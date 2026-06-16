import { useEffect, useRef, useState } from 'react';
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
  Center
} from '@mantine/core';
import {
  IconSend,
  IconPlayerStop,
  IconAlertCircle,
  IconMessage,
  IconPlus,
  IconChevronDown,
  IconRobot
} from '@tabler/icons-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChat } from '../stores/chatStore';
import { useSettings } from '../stores/settingsStore';
import { useProject } from '../stores/projectStore';
import { buildSystemPrompt } from '../lib/prompt';
import type { ChatSessionSummary, ProviderId } from '../../shared/types';

const PROVIDER_LABELS: Record<ProviderId, string> = {
  deepseek: 'DeepSeek',
  anthropic: 'Claude',
  openai: 'ChatGPT'
};

export default function ChatPanel(): JSX.Element {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // chat store
  const sessions = useChat((s) => s.sessions);
  const current = useChat((s) => s.current);
  const streaming = useChat((s) => s.streaming);
  const error = useChat((s) => s.error);
  const loadList = useChat((s) => s.loadList);
  const newSession = useChat((s) => s.newSession);
  const selectSession = useChat((s) => s.selectSession);
  const send = useChat((s) => s.send);
  const cancel = useChat((s) => s.cancel);
  const clearError = useChat((s) => s.clearError);

  const activeProvider = useSettings((s) => s.settings.activeProvider);
  const hasKey = useSettings((s) => s.hasApiKey[activeProvider]);
  const projectMeta = useProject((s) => s.meta);
  const files = useProject((s) => s.files);
  const activeFilePath = useProject((s) => s.activeFilePath);
  const activeFileContent = useProject((s) => s.activeFileContent);

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

  const handleSend = async (): Promise<void> => {
    const text = input.trim();
    if (!text || streaming) return;
    const systemPrompt = await buildSystemPrompt({
      rootPath: projectMeta?.rootPath ?? null,
      files,
      activeFilePath,
      activeFileContent
    });
    setInput('');
    await send(text, systemPrompt);
  };

  const handleNewSession = (): void => {
    newSession();
  };

  return (
    <Box display="flex" style={{ flexDirection: 'column', height: '100%' }} bg="var(--mantine-color-dark-7)">
      {/* ----------- 顶栏：会话切换 + 新建 + provider 状态 ----------- */}
      <Group gap="xs" px="xs" py={6} justify="space-between" bd="1px solid var(--mantine-color-dark-4)">
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
          <Badge size="sm" variant="light" color={hasKey ? 'green' : 'gray'}>
            {current?.provider
              ? PROVIDER_LABELS[current.provider]
              : PROVIDER_LABELS[activeProvider]}
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
              <Paper
                key={i}
                p="sm"
                radius="md"
                bg={
                  m.role === 'user'
                    ? 'var(--mantine-color-indigo-9)'
                    : 'var(--mantine-color-dark-6)'
                }
              >
                <Text size="xs" c="dimmed" mb={4}>
                  {m.role === 'user' ? '你' : PROVIDER_LABELS[current.provider]}
                </Text>
                {m.role === 'assistant' ? (
                  <Box className="markdown-body" style={{ fontSize: 14 }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {m.content}
                    </ReactMarkdown>
                  </Box>
                ) : (
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                    {m.content}
                  </Text>
                )}
              </Paper>
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
      <Box p="sm" bd="1px solid var(--mantine-color-dark-4)">
        <Paper
          radius="lg"
          p="xs"
          bg="var(--mantine-color-dark-6)"
          style={{ border: '1px solid var(--mantine-color-dark-4)' }}
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            placeholder={
              current
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
          <Group justify="space-between" mt={4} px={4}>
            <Group gap={4}>
              <Badge size="xs" variant="light" color="indigo" leftSection={<IconRobot size={10} />}>
                {current?.provider
                  ? PROVIDER_LABELS[current.provider]
                  : PROVIDER_LABELS[activeProvider]}
              </Badge>
              {projectMeta && (
                <Badge size="xs" variant="light" color="grape">
                  {projectMeta.bookTitle}
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
      <Stack align="center" gap="lg" maw={420}>
        <Title order={3} ta="center" c="gray.4">
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
