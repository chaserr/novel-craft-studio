import {
  Box,
  Center,
  Stack,
  Text,
  ScrollArea,
  Paper,
  Group,
  Badge,
  ActionIcon,
  Tooltip,
  Tabs
} from '@mantine/core';
import { IconPlayerStop, IconX } from '@tabler/icons-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  useRunsByRecent,
  useWorkflow,
  type RunState
} from '../../stores/workflowStore';
import { agentLabel } from '../../lib/agents';

const ACTION_LABEL: Record<RunState['action'], string> = {
  'write-next': '写下一章',
  continue: '续写本章',
  sync: '章末同步',
  review: '多角色审稿',
  polish: '润色',
  'draft-rtk': '起草 RTK',
  'draft-outline': '起草大纲',
  'draft-chapter-outline': '起草章节大纲',
  'free-chat': '自由对话'
};

export default function WorkflowResultView(): JSX.Element {
  const runs = useRunsByRecent();
  const selectedRunId = useWorkflow((s) => s.selectedRunId);
  const selectRun = useWorkflow((s) => s.selectRun);
  const cancel = useWorkflow((s) => s.cancel);
  const clearRun = useWorkflow((s) => s.clearRun);

  if (runs.length === 0) {
    return (
      <Center h="100%">
        <Stack align="center" gap={6}>
          <Text size="lg" c="dimmed">
            右侧选好操作 + 角色 + 范围，点"执行"
          </Text>
          <Text size="xs" c="dimmed">
            结果会显示在这里。多个 workflow 可以同时跑（同类型互斥）。
          </Text>
        </Stack>
      </Center>
    );
  }

  const current = runs.find((r) => r.id === selectedRunId) ?? runs[0];

  return (
    <Box display="flex" style={{ flexDirection: 'column', height: '100%' }}>
      {/* 顶部 run 切换条 */}
      <Tabs
        value={current.id}
        onChange={(v) => v && selectRun(v)}
        variant="outline"
        styles={{ list: { borderBottom: '1px solid var(--mantine-color-dark-4)' } }}
      >
        <Tabs.List style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
          {runs.map((r) => (
            <Tabs.Tab key={r.id} value={r.id} style={{ whiteSpace: 'nowrap' }}>
              <Group gap={6} wrap="nowrap">
                <StatusDot status={r.status} />
                <Text size="xs">{ACTION_LABEL[r.action]}</Text>
                {r.status === 'running' && (
                  <Tooltip label="取消这个 run">
                    <ActionIcon
                      size="xs"
                      color="red"
                      variant="subtle"
                      onClick={(e) => {
                        e.stopPropagation();
                        void cancel(r.id);
                      }}
                    >
                      <IconPlayerStop size={10} />
                    </ActionIcon>
                  </Tooltip>
                )}
                {r.status !== 'running' && (
                  <Tooltip label="清掉这个 run">
                    <ActionIcon
                      size="xs"
                      color="gray"
                      variant="subtle"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearRun(r.id);
                      }}
                    >
                      <IconX size={10} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      {/* 当前选中 run 的 subtasks 流 */}
      <ScrollArea style={{ flex: 1 }} type="auto" p="md">
        <Stack gap="md">
          {current.error && (
            <Paper p="sm" radius="md" withBorder bg="var(--mantine-color-red-9)">
              <Text size="sm" c="red.0">
                {current.error}
              </Text>
            </Paper>
          )}
          {current.subtasks.map((st) => (
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
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {st.output}
                  </ReactMarkdown>
                </Box>
              )}
            </Paper>
          ))}
        </Stack>
      </ScrollArea>
    </Box>
  );
}

function StatusDot({ status }: { status: RunState['status'] }): JSX.Element {
  const color =
    status === 'running' ? 'blue' : status === 'done' ? 'green' : 'red';
  return (
    <Box
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: `var(--mantine-color-${color}-5)`,
        boxShadow:
          status === 'running' ? `0 0 6px var(--mantine-color-${color}-5)` : undefined
      }}
    />
  );
}
