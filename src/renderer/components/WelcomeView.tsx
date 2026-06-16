import { useEffect, useState } from 'react';
import {
  Box,
  Stack,
  Title,
  Text,
  Card,
  Group,
  Button,
  ScrollArea,
  Badge,
  ThemeIcon,
  Divider,
  List,
  Alert
} from '@mantine/core';
import {
  IconCheck,
  IconAlertCircle,
  IconFilePlus,
  IconFolderOpen,
  IconSettings,
  IconRocket,
  IconArrowRight,
  IconBook,
  IconUserHeart,
  IconPencil,
  IconSparkles
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useSettings } from '../stores/settingsStore';
import { useProject } from '../stores/projectStore';
import { useWorkflow } from '../stores/workflowStore';
import { api } from '../lib/ipc';
import type { ProviderId, WorkflowAction } from '../../shared/types';

interface Props {
  openSettings: () => void;
  openNewProject: () => void;
  openExistingProject: () => void;
}

interface ReadinessCheck {
  label: string;
  ok: boolean;
  detail: string;
}

export default function WelcomeView({
  openSettings,
  openNewProject,
  openExistingProject
}: Props): JSX.Element {
  const meta = useProject((s) => s.meta);
  const novelCraftPath = useSettings((s) => s.settings.novelCraftPath);
  const [authStatus, setAuthStatus] = useState<
    Record<ProviderId, { strategy: string; label: string }>
  >({
    openai: { strategy: 'none', label: '未配置' },
    anthropic: { strategy: 'none', label: '未配置' },
    deepseek: { strategy: 'none', label: '未配置' }
  });

  useEffect(() => {
    void (async () => {
      const [o, a, d] = await Promise.all([
        api.llm.probeAuth('openai'),
        api.llm.probeAuth('anthropic'),
        api.llm.probeAuth('deepseek')
      ]);
      setAuthStatus({ openai: o, anthropic: a, deepseek: d });
    })();
  }, []);

  // Build readiness checks
  const novelCraftOk = !!novelCraftPath;
  const anyLlmOk =
    authStatus.openai.strategy !== 'none' ||
    authStatus.anthropic.strategy !== 'none' ||
    authStatus.deepseek.strategy !== 'none';

  const checks: ReadinessCheck[] = [
    {
      label: 'novel-craft 模板',
      ok: novelCraftOk,
      detail: novelCraftOk ? novelCraftPath : '需要先下载，新建项目会用到'
    },
    {
      label: 'Claude (Claude Code)',
      ok: authStatus.anthropic.strategy !== 'none',
      detail: authStatus.anthropic.label
    },
    {
      label: 'ChatGPT (Codex CLI)',
      ok: authStatus.openai.strategy !== 'none',
      detail: authStatus.openai.label
    },
    {
      label: 'DeepSeek (API key)',
      ok: authStatus.deepseek.strategy !== 'none',
      detail: authStatus.deepseek.label
    }
  ];

  const readyToStart = novelCraftOk && anyLlmOk;

  // -------------------- 已打开项目 + 还没选文件 → "项目就绪"页 --------------------
  if (meta) {
    return <ProjectReadyView />;
  }

  // -------------------- 没打开项目 → 欢迎页 --------------------
  return (
    <ScrollArea h="100%" type="auto">
      <Box p="xl" maw={760} mx="auto">
        <Stack gap="xl">
          {/* 大标题 */}
          <div>
            <Title order={1} mb={4}>
              👋 欢迎使用 novel-craft-studio
            </Title>
            <Text size="md" c="dimmed">
              长篇小说写作的工程化协作平台 —— 把写一本书拆成可重复的工序
            </Text>
          </div>

          {/* 准备就绪检查 */}
          <Card withBorder padding="lg">
            <Group justify="space-between" mb="md">
              <Text fw={600} size="md">
                准备就绪检查
              </Text>
              {readyToStart ? (
                <Badge color="green" variant="filled">
                  全部就绪
                </Badge>
              ) : (
                <Badge color="yellow" variant="filled">
                  需要配置
                </Badge>
              )}
            </Group>
            <Stack gap="xs">
              {checks.map((c) => (
                <Group key={c.label} gap="sm" wrap="nowrap">
                  {c.ok ? (
                    <ThemeIcon color="green" size="sm" radius="xl">
                      <IconCheck size={12} />
                    </ThemeIcon>
                  ) : (
                    <ThemeIcon color="yellow" size="sm" radius="xl">
                      <IconAlertCircle size={12} />
                    </ThemeIcon>
                  )}
                  <Text size="sm" fw={500} style={{ minWidth: 180 }}>
                    {c.label}
                  </Text>
                  <Text size="xs" c="dimmed" truncate="end" style={{ flex: 1 }}>
                    {c.detail}
                  </Text>
                </Group>
              ))}
            </Stack>
            {!readyToStart && (
              <Button
                mt="md"
                leftSection={<IconSettings size={14} />}
                variant="default"
                onClick={openSettings}
              >
                打开设置完成配置
              </Button>
            )}
          </Card>

          {/* 主操作 */}
          {readyToStart && (
            <div>
              <Text fw={600} size="md" mb="sm">
                开始你的小说
              </Text>
              <Group grow>
                <Card
                  withBorder
                  padding="lg"
                  style={{ cursor: 'pointer' }}
                  onClick={openNewProject}
                >
                  <ThemeIcon size="lg" color="indigo" variant="light" mb="xs">
                    <IconFilePlus size={20} />
                  </ThemeIcon>
                  <Text fw={600}>🆕 新建项目</Text>
                  <Text size="xs" c="dimmed">
                    填书名 / 题材 / 主线人物 / 核心气质，5 个问题搭好骨架
                  </Text>
                </Card>
                <Card
                  withBorder
                  padding="lg"
                  style={{ cursor: 'pointer' }}
                  onClick={openExistingProject}
                >
                  <ThemeIcon size="lg" color="teal" variant="light" mb="xs">
                    <IconFolderOpen size={20} />
                  </ThemeIcon>
                  <Text fw={600}>📂 打开已有项目</Text>
                  <Text size="xs" c="dimmed">
                    选磁盘上 novel-craft 格式的小说目录
                  </Text>
                </Card>
              </Group>
            </div>
          )}

          <Divider variant="dashed" />

          {/* 完整流程 */}
          <div>
            <Group gap="xs" mb="sm">
              <ThemeIcon size="md" color="grape" variant="light">
                <IconRocket size={16} />
              </ThemeIcon>
              <Text fw={600} size="md">
                典型 6 步流程
              </Text>
            </Group>
            <List spacing="sm" size="sm" listStyleType="decimal">
              <List.Item
                icon={<StepIcon icon={<IconBook size={12} />} color="indigo" />}
              >
                <Text fw={500}>新建项目</Text>
                <Text size="xs" c="dimmed">
                  填书名/题材/读者画像/核心气质（≤5 个）/主线人物 → 选目标目录 →
                  novel-craft 自动生成 RTK / 大纲 / 章节大纲 / 人物档案模板
                </Text>
              </List.Item>
              <List.Item
                icon={<StepIcon icon={<IconPencil size={12} />} color="blue" />}
              >
                <Text fw={500}>补全小说大纲</Text>
                <Text size="xs" c="dimmed">
                  左栏点"小说大纲.md"在中间编辑器写四幕结构 / 主线节点 /
                  情绪曲线
                </Text>
              </List.Item>
              <List.Item
                icon={<StepIcon icon={<IconPencil size={12} />} color="cyan" />}
              >
                <Text fw={500}>补全章节大纲（前 3-5 章即可）</Text>
                <Text size="xs" c="dimmed">
                  写每章节点、场景、关系变化点、章末结构。后续可边写边补
                </Text>
              </List.Item>
              <List.Item
                icon={<StepIcon icon={<IconUserHeart size={12} />} color="grape" />}
              >
                <Text fw={500}>"写下一章"按钮</Text>
                <Text size="xs" c="dimmed">
                  右栏工作流 → 选 Provider（推荐先 Claude 或 DeepSeek）→
                  操作选"写下一章" → 角色选"写作者" → 范围"本章" → 执行 →
                  中栏 Workflow Tab 看流式输出，完成后新 .md 自动出现在左栏
                </Text>
              </List.Item>
              <List.Item
                icon={<StepIcon icon={<IconArrowRight size={12} />} color="green" />}
              >
                <Text fw={500}>"章末同步"归档</Text>
                <Text size="xs" c="dimmed">
                  让 LLM 把新章节里的事件 / 关系变化 / 伏笔 / 经典语录
                  自动归档到对应 .md 文件
                </Text>
              </List.Item>
              <List.Item
                icon={<StepIcon icon={<IconUserHeart size={12} />} color="orange" />}
              >
                <Text fw={500}>每写 3-5 章 → 多角色审稿</Text>
                <Text size="xs" c="dimmed">
                  操作选"多角色审稿" → 角色多选（架构师 + 节奏师 + 剧情/伏笔 +
                  审计 + 读者评审）→ 并行执行 → 自动生成审稿报告
                </Text>
              </List.Item>
            </List>
          </div>

          <Alert color="indigo" variant="light" icon={<IconAlertCircle size={14} />}>
            <Text size="xs">
              <b>提示</b>：novel-craft-studio 是一个 GUI 操作台 ——
              所有工作都落地到磁盘的 markdown 文件。
              你随时可以用其他编辑器（VSCode / Typora）打开同一个项目目录继续写。
            </Text>
          </Alert>
        </Stack>
      </Box>
    </ScrollArea>
  );
}

function StepIcon({
  icon,
  color
}: {
  icon: JSX.Element;
  color: string;
}): JSX.Element {
  return (
    <ThemeIcon size="md" color={color} variant="light" radius="xl">
      {icon}
    </ThemeIcon>
  );
}

interface DraftStepRowProps {
  n: number;
  label: string;
  desc: string;
  onDraft: () => void;
  onEdit: () => void;
  running: boolean;
}

function DraftStepRow({
  n,
  label,
  desc,
  onDraft,
  onEdit,
  running
}: DraftStepRowProps): JSX.Element {
  return (
    <Card withBorder padding="sm" radius="md">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Group gap="sm" wrap="nowrap" style={{ flex: 1 }}>
          <Badge size="lg" variant="filled" color="indigo">
            {n}
          </Badge>
          <div style={{ flex: 1 }}>
            <Text size="sm" fw={600}>
              {label}
            </Text>
            <Text size="xs" c="dimmed">
              {desc}
            </Text>
          </div>
        </Group>
        <Group gap={6} wrap="nowrap">
          <Button
            size="xs"
            leftSection={<IconSparkles size={12} />}
            onClick={onDraft}
            disabled={running}
            variant="filled"
          >
            让 AI 起草
          </Button>
          <Button
            size="xs"
            variant="default"
            leftSection={<IconPencil size={12} />}
            onClick={onEdit}
          >
            手动编辑
          </Button>
        </Group>
      </Group>
    </Card>
  );
}

/** 已打开项目但没选文件时显示。 */
function ProjectReadyView(): JSX.Element {
  const meta = useProject((s) => s.meta);
  const files = useProject((s) => s.files);
  const openFile = useProject((s) => s.openFile);
  const novelCraftPath = useSettings((s) => s.settings.novelCraftPath);
  const setAction = useWorkflow((s) => s.setAction);
  const setRange = useWorkflow((s) => s.setRange);
  const runWorkflow = useWorkflow((s) => s.run);
  const running = useWorkflow((s) => s.running);
  if (!meta) return <Box />;

  const chapters = files.filter((f) => f.category === 'chapter' && !f.isDir);
  const writtenCount = chapters.filter((c) => c.hasContent).length;
  const totalChapters = chapters.length;
  const rtk = files.find((f) => f.category === 'rtk');
  const outline = files.find((f) => f.category === 'outline');
  const chapterOutline = files.find((f) => f.category === 'chapter-outline');

  const draftAction = (
    action: WorkflowAction,
    label: string
  ): (() => void) => {
    return () => {
      if (running) {
        notifications.show({
          message: '当前已有 workflow 在跑，请先停止',
          color: 'yellow'
        });
        return;
      }
      setAction(action);
      setRange({ type: 'book' }); // draft actions 不依赖具体章节范围
      void runWorkflow([], meta.rootPath, novelCraftPath);
      notifications.show({
        message: `已启动「${label}」。中栏会自动切到 Workflow Tab 看流式输出，完成后文件被覆盖更新。`,
        color: 'indigo'
      });
    };
  };

  // Determine recommended next step
  let recommendation: JSX.Element;
  if (writtenCount === 0 && totalChapters === 0) {
    // 全新项目 — 引导用 AI 起草，并附手动编辑兜底
    recommendation = (
      <Stack gap="md">
        <div>
          <Text fw={600} mb={4}>
            📌 推荐第一步：让 AI 起草骨架，你来定稿
          </Text>
          <Text size="sm" c="dimmed">
            这是个全新项目。LLM 会基于你新建时填的字段（书名/题材/读者/气质/主线人物）
            补全 3 份核心资料。每一步生成后你都能在中栏编辑改写。
          </Text>
        </div>

        <Stack gap={8}>
          <DraftStepRow
            n={1}
            label="RTK.md"
            desc="项目级写作规则：题材气质、文风约束、套话黑名单。所有 agent 开工前都会读这里。"
            onDraft={draftAction('draft-rtk', '起草 RTK.md')}
            onEdit={() => rtk && void openFile(rtk.path)}
            running={running}
          />
          <DraftStepRow
            n={2}
            label="小说大纲.md"
            desc="四幕结构、主线节点、情绪曲线、大伏笔。LLM 会基于 RTK 输出完整草案。"
            onDraft={draftAction('draft-outline', '起草小说大纲')}
            onEdit={() => outline && void openFile(outline.path)}
            running={running}
          />
          <DraftStepRow
            n={3}
            label="章节大纲.md（前 10 章）"
            desc="逐章节点、场景、关系变化、章末结构。LLM 会基于小说大纲输出前 10 章草案。"
            onDraft={draftAction('draft-chapter-outline', '起草章节大纲')}
            onEdit={() => chapterOutline && void openFile(chapterOutline.path)}
            running={running}
          />
        </Stack>

        <Alert color="indigo" variant="light" icon={<IconAlertCircle size={14} />}>
          <Text size="xs">
            <b>建议节奏</b>：每起草一份就在中栏编辑改一改（LLM 不可能比你更懂你的故事）。
            三份资料都定稿后，再到右栏 → "写下一章" → 执行。
            如果对 LLM 起草不满意，可以多按几次"让 AI 起草"重新生成。
          </Text>
        </Alert>
      </Stack>
    );
  } else if (writtenCount === 0 && totalChapters > 0) {
    // 有大纲但没正文
    recommendation = (
      <Stack gap="xs">
        <Text fw={600}>📌 推荐：写第 1 章</Text>
        <Text size="sm" c="dimmed">
          大纲已就位（共 {totalChapters} 个章节节点）。点右栏 →
          工作流 → "写下一章" → 选角色"写作者" → 执行。
        </Text>
      </Stack>
    );
  } else {
    // 已经在写
    recommendation = (
      <Stack gap="xs">
        <Text fw={600}>
          📌 进度：已写 {writtenCount} / {totalChapters || writtenCount} 章
        </Text>
        <Text size="sm" c="dimmed">
          左栏选章节继续编辑，或右栏点"写下一章"继续推进。
          每写完 3-5 章建议跑一次"多角色审稿"。
        </Text>
      </Stack>
    );
  }

  return (
    <ScrollArea h="100%" type="auto">
      <Box p="xl" maw={680} mx="auto">
        <Stack gap="lg">
          <div>
            <Title order={2} mb={4}>
              📖 《{meta.bookTitle}》已就绪
            </Title>
            <Text size="sm" c="dimmed">
              共 {files.length} 个文件 · {totalChapters} 章节
            </Text>
          </div>

          <Card withBorder padding="lg">{recommendation}</Card>

          <Alert color="gray" variant="light" icon={<IconAlertCircle size={14} />}>
            <Text size="xs">
              这一面板会在你<b>没打开任何文件</b>时显示。从左栏点任意 .md
              即可进入编辑模式；或从右栏选 workflow 操作。
            </Text>
          </Alert>
        </Stack>
      </Box>
    </ScrollArea>
  );
}
