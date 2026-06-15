import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Stack,
  Textarea,
  Button,
  Group,
  ScrollArea,
  Paper,
  Text,
  ActionIcon,
  Tooltip,
  Alert
} from '@mantine/core';
import { IconSend, IconPlayerStop, IconTrash, IconAlertCircle } from '@tabler/icons-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChat } from '../stores/chatStore';
import { useSettings } from '../stores/settingsStore';
import { useProject } from '../stores/projectStore';
import ProviderSwitcher from './ProviderSwitcher';
import { buildSystemPrompt } from '../lib/prompt';

export default function ChatPanel(): JSX.Element {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const messages = useChat((s) => s.messages);
  const streaming = useChat((s) => s.streaming);
  const error = useChat((s) => s.error);
  const send = useChat((s) => s.send);
  const cancel = useChat((s) => s.cancel);
  const clear = useChat((s) => s.clear);
  const activeProvider = useSettings((s) => s.settings.activeProvider);
  const model = useSettings((s) => s.settings.models[activeProvider]);
  const hasKey = useSettings((s) => s.hasApiKey[activeProvider]);
  const projectMeta = useProject((s) => s.meta);
  const files = useProject((s) => s.files);
  const activeFilePath = useProject((s) => s.activeFilePath);
  const activeFileContent = useProject((s) => s.activeFileContent);

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    });
  }, [messages]);

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
    await send(text, systemPrompt, activeProvider, model);
  };

  return (
    <Box display="flex" style={{ flexDirection: 'column', height: '100%' }} bg="var(--mantine-color-dark-7)">
      <Group justify="space-between" px="sm" py={6} bd="1px solid var(--mantine-color-dark-4)">
        <ProviderSwitcher />
        <Tooltip label="清空对话">
          <ActionIcon variant="subtle" onClick={clear} disabled={streaming}>
            <IconTrash size={14} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {!hasKey && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="yellow"
          variant="light"
          m="xs"
          radius="md"
        >
          当前 provider 未配置 API key。点右上 Settings 设置。
        </Alert>
      )}

      <ScrollArea viewportRef={scrollRef} style={{ flex: 1 }} p="sm">
        <Stack gap="sm">
          {messages.length === 0 && (
            <Text size="sm" c="dimmed" ta="center" mt="lg">
              开始对话吧。系统会自动把项目 RTK.md 作为上下文注入。
            </Text>
          )}
          {messages.map((m, i) => (
            <Paper
              key={i}
              p="sm"
              radius="md"
              bg={m.role === 'user' ? 'var(--mantine-color-indigo-9)' : 'var(--mantine-color-dark-6)'}
            >
              <Text size="xs" c="dimmed" mb={4}>
                {m.role === 'user' ? '你' : 'LLM'}
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
            <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
              {error}
            </Alert>
          )}
        </Stack>
      </ScrollArea>

      <Box p="sm" bd="1px solid var(--mantine-color-dark-4)">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.currentTarget.value)}
          placeholder="说点什么…  (Enter 发送 / Shift+Enter 换行)"
          autosize
          minRows={2}
          maxRows={8}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          disabled={streaming}
        />
        <Group justify="flex-end" mt={6}>
          {streaming ? (
            <Button
              size="xs"
              color="red"
              variant="light"
              leftSection={<IconPlayerStop size={14} />}
              onClick={() => void cancel()}
            >
              停止
            </Button>
          ) : (
            <Button
              size="xs"
              leftSection={<IconSend size={14} />}
              onClick={() => void handleSend()}
              disabled={!input.trim() || !hasKey}
            >
              发送
            </Button>
          )}
        </Group>
      </Box>
    </Box>
  );
}
