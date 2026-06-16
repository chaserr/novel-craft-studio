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
  Alert,
  Textarea
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
  IconPencilPlus,
  IconSparkles
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useSettings } from '../stores/settingsStore';
import { useProject } from '../stores/projectStore';
import { useIsActionRunning, useWorkflow } from '../stores/workflowStore';
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
              👋 欢迎使用 Orchid
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
              <b>提示</b>：Orchid 是一个 GUI 操作台 ——
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

type StepStatus = 'done' | 'next' | 'pending';

interface ChecklistStepProps {
  n: number;
  status: StepStatus;
  label: string;
  desc: string;
  /** 主按钮（起草 / 开始写 etc）。done 状态下默认不显示，需手动塞。 */
  primary?: { label: string; icon: JSX.Element; onClick: () => void; disabled?: boolean };
  /** 副按钮（编辑 / 继续写）。文件存在时才显示。 */
  secondary?: { label: string; icon: JSX.Element; onClick: () => void };
}

function ChecklistStep({
  n,
  status,
  label,
  desc,
  primary,
  secondary
}: ChecklistStepProps): JSX.Element {
  const isDone = status === 'done';
  const isNext = status === 'next';
  // 当前步：indigo 边框 + 高亮；已完成：绿对勾；后续步：透明虚化
  return (
    <Card
      withBorder
      padding="sm"
      radius="md"
      style={{
        borderColor: isNext
          ? 'var(--mantine-color-indigo-5)'
          : 'var(--mantine-color-dark-4)',
        borderWidth: isNext ? 2 : 1,
        opacity: !isNext && !isDone ? 0.65 : 1
      }}
    >
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Group gap="sm" wrap="nowrap" style={{ flex: 1 }}>
          <ThemeIcon
            size="lg"
            radius="xl"
            variant={isDone ? 'filled' : isNext ? 'filled' : 'light'}
            color={isDone ? 'green' : isNext ? 'indigo' : 'gray'}
          >
            {isDone ? <IconCheck size={16} /> : <Text size="sm" fw={700}>{n}</Text>}
          </ThemeIcon>
          <div style={{ flex: 1 }}>
            <Group gap={6}>
              <Text size="sm" fw={600}>
                {label}
              </Text>
              {isDone && (
                <Badge size="xs" color="green" variant="light">
                  已完成
                </Badge>
              )}
              {isNext && (
                <Badge size="xs" color="indigo" variant="filled">
                  当前步骤
                </Badge>
              )}
            </Group>
            <Text size="xs" c="dimmed" mt={2}>
              {desc}
            </Text>
          </div>
        </Group>
        <Group gap={6} wrap="nowrap">
          {primary && (
            <Button
              size="xs"
              leftSection={primary.icon}
              onClick={primary.onClick}
              disabled={primary.disabled}
              variant={isDone ? 'subtle' : 'filled'}
            >
              {primary.label}
            </Button>
          )}
          {secondary && (
            <Button
              size="xs"
              variant="default"
              leftSection={secondary.icon}
              onClick={secondary.onClick}
            >
              {secondary.label}
            </Button>
          )}
        </Group>
      </Group>
    </Card>
  );
}

/** 已打开项目但没选文件时显示：5 步引导清单。 */
function ProjectReadyView(): JSX.Element {
  const meta = useProject((s) => s.meta);
  const files = useProject((s) => s.files);
  const openFile = useProject((s) => s.openFile);
  // 全局共享：所有 sparse 检测 + extraContext 都从 project store 取
  const rtkSparse = useProject((s) => s.rtkSparse);
  const outlineSparse = useProject((s) => s.outlineSparse);
  const chapterOutlineSparse = useProject((s) => s.chapterOutlineSparse);
  const extraContext = useProject((s) => s.extraContext);
  const setExtraContext = useProject((s) => s.setExtraContext);
  const novelCraftPath = useSettings((s) => s.settings.novelCraftPath);
  const setAction = useWorkflow((s) => s.setAction);
  const setRange = useWorkflow((s) => s.setRange);
  const runWorkflow = useWorkflow((s) => s.run);
  // 同类型互斥：每个 action 独立判断是否在跑，按钮只在自己那个 action
  // 在执行时才 disabled —— 这样三个 draft 可以同时启动。
  const rtkRunning = useIsActionRunning('draft-rtk');
  const outlineRunning = useIsActionRunning('draft-outline');
  const chapterOutlineRunning = useIsActionRunning('draft-chapter-outline');
  const writeNextRunning = useIsActionRunning('write-next');

  const rtk = files.find((f) => f.category === 'rtk');
  const outline = files.find((f) => f.category === 'outline');
  const chapterOutline = files.find((f) => f.category === 'chapter-outline');

  if (!meta) return <Box />;

  const chapters = files.filter((f) => f.category === 'chapter' && !f.isDir);
  const writtenCount = chapters.filter((c) => c.hasContent).length;
  const totalChapters = chapters.length;
  const firstUnwrittenChapter = chapters.find((c) => !c.hasContent);

  // 5 步状态 — 项目创建到能写正文这条主线
  const stepDone = {
    create: true, // 能看到这页就意味着项目已创建
    rtk: !rtkSparse,
    outline: !outlineSparse,
    chapterOutline: !chapterOutlineSparse,
    firstChapter: writtenCount >= 1
  };
  // 第一个未完成的步是"当前步骤"，高亮它
  const nextStep: keyof typeof stepDone | null = (() => {
    if (!stepDone.rtk) return 'rtk';
    if (!stepDone.outline) return 'outline';
    if (!stepDone.chapterOutline) return 'chapterOutline';
    if (!stepDone.firstChapter) return 'firstChapter';
    return null;
  })();
  const stepStatus = (key: keyof typeof stepDone): StepStatus =>
    stepDone[key] ? 'done' : nextStep === key ? 'next' : 'pending';

  const runDraft = (action: WorkflowAction, label: string): void => {
    // sparse + 简述空 / 同类型互斥 都在 workflowStore.run 里二次校验，
    // 这里就不重复了 —— 直接发起，store 拒绝时会自己弹通知。
    setAction(action);
    setRange({ type: 'book' });
    void runWorkflow([], meta.rootPath, novelCraftPath);
    notifications.show({
      message: `已启动「${label}」。中栏会自动切到 Workflow 看流式输出。`,
      color: 'indigo'
    });
  };

  const runWriteNext = (): void => {
    setAction('write-next');
    setRange({ type: 'chapter' });
    void runWorkflow([], meta.rootPath, novelCraftPath);
    notifications.show({
      message: '已启动「写下一章」。完成后新章节会自动出现在左栏。',
      color: 'indigo'
    });
  };

  const allDone = nextStep === null;

  return (
    <ScrollArea h="100%" type="auto">
      <Box p="xl" maw={760} mx="auto">
        <Stack gap="lg">
          <div>
            <Title order={2} mb={4}>
              📖 《{meta.bookTitle}》
            </Title>
            <Text size="sm" c="dimmed">
              {allDone
                ? `进行中 · 已写 ${writtenCount} / ${totalChapters || writtenCount} 章`
                : '完成 5 步从空白到写正文 — 每步完成后会自动打勾'}
            </Text>
          </div>

          {/* 故事简述 —— RTK 稀疏时必填，否则可选 */}
          {(rtkSparse || !!extraContext) && (
            <Textarea
              label={
                <Group gap={6}>
                  <Text size="sm" fw={500}>
                    故事简述
                  </Text>
                  {rtkSparse ? (
                    <Badge size="xs" color="red" variant="filled">
                      必填
                    </Badge>
                  ) : (
                    <Badge size="xs" color="gray" variant="light">
                      可选
                    </Badge>
                  )}
                </Group>
              }
              description={
                rtkSparse
                  ? '检测到 RTK.md 内容很少。先用 2-5 句话描述：题材 / 主线 / 主角 / 想要的气质。'
                  : '想往哪个方向引导 LLM？这段会被注入到每次 workflow 的高优先级 prompt。'
              }
              placeholder="例：高三复读生与上大学的初恋通过广播节目重新联系，慢节奏校园青春，群像写实。"
              value={extraContext}
              onChange={(e) => setExtraContext(e.currentTarget.value)}
              autosize
              minRows={3}
              maxRows={8}
            />
          )}

          {/* 5 步引导清单 */}
          <Stack gap={8}>
            <ChecklistStep
              n={1}
              status={stepStatus('create')}
              label="项目创建"
              desc="生成 RTK / 大纲 / 章节大纲 / 人物档案等基础文件骨架。"
            />
            <ChecklistStep
              n={2}
              status={stepStatus('rtk')}
              label="RTK.md（写作规则）"
              desc="题材气质、文风约束、套话黑名单。所有 agent 开工前都会读它。"
              primary={{
                label: rtkRunning
                  ? '执行中…'
                  : stepDone.rtk
                    ? '重新起草'
                    : '让 AI 起草',
                icon: <IconSparkles size={12} />,
                onClick: () => runDraft('draft-rtk', '起草 RTK.md'),
                disabled: rtkRunning
              }}
              secondary={
                rtk
                  ? {
                      label: stepDone.rtk ? '继续编辑' : '手动编辑',
                      icon: <IconPencil size={12} />,
                      onClick: () => void openFile(rtk.path)
                    }
                  : undefined
              }
            />
            <ChecklistStep
              n={3}
              status={stepStatus('outline')}
              label="小说大纲.md"
              desc="四幕结构、主线节点、情绪曲线、大伏笔。LLM 基于 RTK 输出完整草案。"
              primary={{
                label: outlineRunning
                  ? '执行中…'
                  : stepDone.outline
                    ? '重新起草'
                    : '让 AI 起草',
                icon: <IconSparkles size={12} />,
                onClick: () => runDraft('draft-outline', '起草小说大纲'),
                disabled: outlineRunning
              }}
              secondary={
                outline
                  ? {
                      label: stepDone.outline ? '继续编辑' : '手动编辑',
                      icon: <IconPencil size={12} />,
                      onClick: () => void openFile(outline.path)
                    }
                  : undefined
              }
            />
            <ChecklistStep
              n={4}
              status={stepStatus('chapterOutline')}
              label="章节大纲.md（前 10 章）"
              desc="逐章节点、场景、关系变化、章末结构。LLM 基于小说大纲输出。"
              primary={{
                label: chapterOutlineRunning
                  ? '执行中…'
                  : stepDone.chapterOutline
                    ? '重新起草'
                    : '让 AI 起草',
                icon: <IconSparkles size={12} />,
                onClick: () => runDraft('draft-chapter-outline', '起草章节大纲'),
                disabled: chapterOutlineRunning
              }}
              secondary={
                chapterOutline
                  ? {
                      label: stepDone.chapterOutline ? '继续编辑' : '手动编辑',
                      icon: <IconPencil size={12} />,
                      onClick: () => void openFile(chapterOutline.path)
                    }
                  : undefined
              }
            />
            <ChecklistStep
              n={5}
              status={stepStatus('firstChapter')}
              label={stepDone.firstChapter ? '继续写后续章节' : '写第 1 章'}
              desc={
                stepDone.firstChapter
                  ? `已写 ${writtenCount} / ${totalChapters || writtenCount} 章。继续推进或左侧选章节编辑。`
                  : '让 AI 按章节大纲写出第 1 章的完整正文，写完后自动出现在左栏。'
              }
              primary={{
                label: writeNextRunning
                  ? '执行中…'
                  : stepDone.firstChapter
                    ? '写下一章'
                    : '开始写第 1 章',
                icon: <IconPencilPlus size={12} />,
                onClick: runWriteNext,
                disabled: writeNextRunning || !stepDone.chapterOutline
              }}
              secondary={
                firstUnwrittenChapter || writtenCount > 0
                  ? {
                      label: '打开章节列表',
                      icon: <IconPencil size={12} />,
                      onClick: () => {
                        // 没正文 → 打开第一个未写章节文件让用户看占位；
                        // 有正文 → 打开已写的最后一章
                        const target = stepDone.firstChapter
                          ? chapters.filter((c) => c.hasContent).at(-1)
                          : firstUnwrittenChapter;
                        if (target) void openFile(target.path);
                      }
                    }
                  : undefined
              }
            />
          </Stack>

          {allDone && (
            <Alert color="green" variant="light" icon={<IconCheck size={14} />}>
              <Text size="xs">
                🎉 引导阶段完成。后续在右栏「工作流」继续推进：写下一章 / 章末同步 /
                每 3-5 章跑一次多角色审稿。
              </Text>
            </Alert>
          )}

          {!allDone && (
            <Alert color="gray" variant="light" icon={<IconAlertCircle size={14} />}>
              <Text size="xs">
                每完成一步会自动打勾，<b>已完成的步骤随时可以点「继续编辑」</b>修改。
                所有文件都是磁盘上的 markdown，VSCode / Typora 也能直接打开。
              </Text>
            </Alert>
          )}
        </Stack>
      </Box>
    </ScrollArea>
  );
}
