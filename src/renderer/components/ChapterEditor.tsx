import { useEffect, useRef } from 'react';
import { Box, Group, Text, Badge, Stack, Center } from '@mantine/core';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { useProject } from '../stores/projectStore';

const AUTO_SAVE_DELAY = 800;

export default function ChapterEditor(): JSX.Element {
  const path = useProject((s) => s.activeFilePath);
  const content = useProject((s) => s.activeFileContent);
  const dirty = useProject((s) => s.activeFileDirty);
  const updateContent = useProject((s) => s.setActiveContent);
  const save = useProject((s) => s.saveActiveFile);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 防抖自动保存
  useEffect(() => {
    if (!dirty) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void save();
    }, AUTO_SAVE_DELAY);
    return (): void => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [content, dirty, save]);

  // Cmd/Ctrl+S 立即保存
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', handler);
    return (): void => window.removeEventListener('keydown', handler);
  }, [save]);

  if (!path) {
    return (
      <Center h="100%">
        <Stack align="center" gap={4}>
          <Text size="lg" c="dimmed">
            从左侧选一个文件开始编辑
          </Text>
          <Text size="sm" c="dimmed">
            或者在右侧 chat 里跟 LLM 一起开始写
          </Text>
        </Stack>
      </Center>
    );
  }

  const name = path.split('/').pop();

  return (
    <Box display="flex" style={{ flexDirection: 'column', height: '100%' }}>
      <Group justify="space-between" px="md" py={6} bd="1px solid var(--mantine-color-dark-4)">
        <Text size="sm" fw={500}>
          {name}
        </Text>
        <Badge color={dirty ? 'yellow' : 'green'} variant="light">
          {dirty ? '未保存' : '已保存'}
        </Badge>
      </Group>
      <Box style={{ flex: 1, overflow: 'auto' }}>
        <CodeMirror
          value={content}
          onChange={updateContent}
          theme={oneDark}
          extensions={[markdown()]}
          height="100%"
          style={{ height: '100%', fontSize: 14 }}
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: false
          }}
        />
      </Box>
    </Box>
  );
}
