import { Box, Center, Stack, Text, ScrollArea, Paper, Group, Badge } from '@mantine/core';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useWorkflow } from '../../stores/workflowStore';
import { agentLabel } from '../../lib/agents';

/**
 * v1 P4 缩水版：先把多 agent 流式输出按顺序展示。
 * P5 / P7 会把它细化为 ReviewReportView / PolishDiffView / SyncPreviewView。
 */
export default function WorkflowResultView(): JSX.Element {
  const running = useWorkflow((s) => s.running);
  const subtasks = useWorkflow((s) => s.subtasks);
  const result = useWorkflow((s) => s.result);

  if (!running && subtasks.length === 0 && !result) {
    return (
      <Center h="100%">
        <Stack align="center" gap={6}>
          <Text size="lg" c="dimmed">
            右侧选好操作 + 角色 + 范围，点"执行"
          </Text>
          <Text size="xs" c="dimmed">
            结果会显示在这里
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <ScrollArea h="100%" type="auto" p="md">
      <Stack gap="md">
        {subtasks.map((st) => (
          <Paper key={st.id} p="md" radius="md" withBorder>
            <Group justify="space-between" mb={6}>
              <Group gap="xs">
                <Text fw={600}>{agentLabel(st.role)}</Text>
                <Badge
                  size="xs"
                  variant="light"
                  color={
                    st.status === 'done'
                      ? 'green'
                      : st.status === 'error'
                        ? 'red'
                        : st.status === 'running'
                          ? 'blue'
                          : 'gray'
                  }
                >
                  {st.status === 'pending' && '待执行'}
                  {st.status === 'running' && '生成中…'}
                  {st.status === 'done' && '完成'}
                  {st.status === 'error' && '出错'}
                </Badge>
              </Group>
            </Group>
            {st.error && (
              <Text size="sm" c="red">
                {st.error}
              </Text>
            )}
            {st.output && (
              <Box className="markdown-body" style={{ fontSize: 14 }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{st.output}</ReactMarkdown>
              </Box>
            )}
          </Paper>
        ))}
      </Stack>
    </ScrollArea>
  );
}
