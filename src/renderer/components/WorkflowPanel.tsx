import { useMemo } from 'react';
import {
  Stack,
  Group,
  Button,
  Text,
  SegmentedControl,
  Checkbox,
  Radio,
  ScrollArea,
  Divider,
  Badge,
  Tooltip,
  Box,
  Alert
} from '@mantine/core';
import {
  IconPlayerPlay,
  IconAlertCircle,
  IconPencilPlus,
  IconArrowRight,
  IconRefresh,
  IconReportSearch,
  IconWand
} from '@tabler/icons-react';
import { useIsActionRunning, useWorkflow } from '../stores/workflowStore';
import { useProject } from '../stores/projectStore';
import { useSettings } from '../stores/settingsStore';
import { AGENTS, agentLabel } from '../lib/agents';
import ProviderSwitcher from './ProviderSwitcher';
import type { AgentRole, WorkflowAction, WorkflowRange } from '../../shared/types';

const ACTIONS: {
  id: WorkflowAction;
  label: string;
  icon: typeof IconPencilPlus;
  hint: string;
}[] = [
  { id: 'write-next', label: '写下一章', icon: IconPencilPlus, hint: '按章节大纲生成尚未存在的下一章' },
  { id: 'continue', label: '续写本章', icon: IconArrowRight, hint: '在当前打开的章节末尾追加' },
  { id: 'sync', label: '章末同步', icon: IconRefresh, hint: '把选中章节归档到 前情/伏笔/语录/人物档案' },
  { id: 'review', label: '多角色审稿', icon: IconReportSearch, hint: '并行召唤多个 agent，输出汇总报告' },
  { id: 'polish', label: '去 AI 味润色', icon: IconWand, hint: '对选中范围扫八大叙事病灶' }
];

export default function WorkflowPanel(): JSX.Element {
  const action = useWorkflow((s) => s.action);
  const roles = useWorkflow((s) => s.roles);
  const range = useWorkflow((s) => s.range);
  const setAction = useWorkflow((s) => s.setAction);
  const toggleRole = useWorkflow((s) => s.toggleRole);
  const setRange = useWorkflow((s) => s.setRange);
  const runWorkflow = useWorkflow((s) => s.run);
  // 同类型互斥：只关心当前选中的 action 是否已经在跑
  const sameActionRunning = useIsActionRunning(action);

  const meta = useProject((s) => s.meta);
  const files = useProject((s) => s.files);
  const activeFilePath = useProject((s) => s.activeFilePath);
  const selected = useProject((s) => s.selectedChapterPaths);
  const rtkSparse = useProject((s) => s.rtkSparse);
  const extraContext = useProject((s) => s.extraContext);
  const novelCraftPath = useSettings((s) => s.settings.novelCraftPath);

  // RTK 是否被锁住：项目稀疏 + 用户没填故事简述 → 任何 workflow 都没意义
  const lockedBySparse = rtkSparse && !extraContext.trim();

  // Sort chapter files for various range UIs
  const chapters = useMemo(
    () =>
      files
        .filter((f) => f.category === 'chapter' && !f.isDir && f.chapterNumber)
        .sort((a, b) => (a.chapterNumber ?? 0) - (b.chapterNumber ?? 0)),
    [files]
  );

  const allowsRoleChoice = action !== 'free-chat';

  // Chapter paths resolved from current range selection
  const resolvedPaths = useMemo((): string[] => {
    if (!meta) return [];
    switch (range.type) {
      case 'chapter':
        return activeFilePath ? [activeFilePath] : [];
      case 'multi':
        return selected.length > 0 ? selected : activeFilePath ? [activeFilePath] : [];
      case 'volume': {
        const vol = meta.volumes.find((v) => v.index === range.volumeIndex);
        if (!vol) return [];
        return chapters
          .filter(
            (c) =>
              c.chapterNumber! >= vol.startChapter &&
              c.chapterNumber! <= vol.endChapter
          )
          .map((c) => c.path);
      }
      case 'book':
        return chapters.map((c) => c.path);
    }
  }, [range, meta, activeFilePath, selected, chapters]);

  const canExecute =
    !!meta &&
    !!novelCraftPath &&
    resolvedPaths.length > 0 &&
    (action === 'free-chat' || roles.length > 0) &&
    !lockedBySparse &&
    !sameActionRunning;

  const handleRun = (): void => {
    if (!meta || !novelCraftPath) return;
    void runWorkflow(resolvedPaths, meta.rootPath, novelCraftPath);
  };

  if (!meta) {
    return (
      <Box p="md">
        <Text size="sm" c="dimmed">
          请先新建 / 打开一个小说项目。
        </Text>
      </Box>
    );
  }

  return (
    <ScrollArea h="100%" type="auto">
      <Stack gap="md" p="sm">
        {lockedBySparse && (
          <Alert color="yellow" icon={<IconAlertCircle size={16} />} variant="light">
            <Text size="xs" fw={500} mb={4}>
              项目信息为空，所有 workflow 都被锁住
            </Text>
            <Text size="xs">
              RTK.md 里书名 / 核心气质 / 主线人物 至少 2 项是空。请到中栏「引导」页
              填写「故事简述」（2-5 句即可），再回来执行。
            </Text>
          </Alert>
        )}

        {sameActionRunning && !lockedBySparse && (
          <Alert color="blue" icon={<IconAlertCircle size={16} />} variant="light">
            <Text size="xs">
              当前 action「{action}」已经在执行中。可以切到中栏 Workflow Tab
              查看进度，或选别的 action 同时跑。
            </Text>
          </Alert>
        )}

        {/* ------------- Provider 切换 ------------- */}
        <div>
          <Text size="xs" fw={500} mb={4} c="dimmed">
            模型
          </Text>
          <ProviderSwitcher />
        </div>

        {/* ------------- 操作按钮组 ------------- */}
        <div>
          <Text size="xs" fw={500} mb={4} c="dimmed">
            操作
          </Text>
          <Stack gap={4}>
            {ACTIONS.map((a) => {
              const Icon = a.icon;
              const active = action === a.id;
              return (
                <Tooltip key={a.id} label={a.hint} position="left">
                  <Button
                    size="sm"
                    variant={active ? 'filled' : 'default'}
                    leftSection={<Icon size={14} />}
                    onClick={() => setAction(a.id)}
                    justify="flex-start"
                    fullWidth
                  >
                    {a.label}
                  </Button>
                </Tooltip>
              );
            })}
          </Stack>
        </div>

        <Divider />

        {/* ------------- 角色选择 ------------- */}
        {allowsRoleChoice && (
          <div>
            <Group justify="space-between" mb={4}>
              <Text size="xs" fw={500} c="dimmed">
                召唤的角色（可多选）
              </Text>
              <Badge size="xs" variant="light">
                {roles.length} 选中
              </Badge>
            </Group>
            <Stack gap={6}>
              {AGENTS.map((agent) => {
                const checked = roles.includes(agent.id);
                return (
                  <Checkbox
                    key={agent.id}
                    size="sm"
                    checked={checked}
                    onChange={() => toggleRole(agent.id)}
                    label={
                      <Box style={{ minWidth: 0 }}>
                        <Text size="sm" fw={500}>
                          {agent.label}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {agent.shortDescription}
                        </Text>
                      </Box>
                    }
                    styles={{ labelWrapper: { flex: 1 } }}
                  />
                );
              })}
            </Stack>
          </div>
        )}

        <Divider />

        {/* ------------- 范围 ------------- */}
        <div>
          <Text size="xs" fw={500} mb={4} c="dimmed">
            范围
          </Text>
          <RangePicker
            range={range}
            onChange={setRange}
            currentChapterCount={activeFilePath ? 1 : 0}
            selectedCount={selected.length}
            volumes={meta.volumes}
            totalChapters={chapters.length}
          />
          {resolvedPaths.length > 0 && (
            <Text size="xs" c="dimmed" mt={4}>
              将处理 {resolvedPaths.length} 章
            </Text>
          )}
        </div>

        <Divider />

        {/* ------------- 执行 ------------- */}
        <Button
          leftSection={<IconPlayerPlay size={14} />}
          onClick={handleRun}
          disabled={!canExecute}
          fullWidth
        >
          执行
        </Button>

        {!canExecute && !sameActionRunning && resolvedPaths.length === 0 && (
          <Text size="xs" c="orange">
            ⚠️ 当前范围没解析到章节文件
          </Text>
        )}
      </Stack>
    </ScrollArea>
  );
}

interface RangePickerProps {
  range: WorkflowRange;
  onChange: (r: WorkflowRange) => void;
  currentChapterCount: number;
  selectedCount: number;
  volumes: { index: number; title: string }[];
  totalChapters: number;
}

function RangePicker({
  range,
  onChange,
  currentChapterCount,
  selectedCount,
  volumes,
  totalChapters
}: RangePickerProps): JSX.Element {
  return (
    <Stack gap={6}>
      <Radio
        size="sm"
        checked={range.type === 'chapter'}
        onChange={() => onChange({ type: 'chapter' })}
        label={`本章（${currentChapterCount > 0 ? '当前打开的章' : '无打开'}）`}
      />
      <Radio
        size="sm"
        checked={range.type === 'multi'}
        onChange={() => onChange({ type: 'multi', chapterNumbers: [] })}
        label={`选中章（${selectedCount} 选中）`}
      />
      {range.type === 'multi' && selectedCount === 0 && (
        <Text size="xs" c="orange" ml="lg">
          在左侧文件树「章节」分类下，点章节前的小方框、或 ⌘/Ctrl + 点击章节名来勾选。
        </Text>
      )}
      <Radio
        size="sm"
        checked={range.type === 'volume'}
        onChange={() =>
          onChange({ type: 'volume', volumeIndex: volumes[0]?.index ?? 1 })
        }
        label="当前卷"
      />
      {range.type === 'volume' && volumes.length > 0 && (
        <SegmentedControl
          size="xs"
          ml="md"
          data={volumes.map((v) => ({
            label: `${v.index}`,
            value: String(v.index)
          }))}
          value={String(range.volumeIndex)}
          onChange={(v) =>
            onChange({ type: 'volume', volumeIndex: parseInt(v, 10) })
          }
        />
      )}
      <Radio
        size="sm"
        checked={range.type === 'book'}
        onChange={() => onChange({ type: 'book' })}
        label={`全书（${totalChapters} 章）`}
      />
    </Stack>
  );
}
