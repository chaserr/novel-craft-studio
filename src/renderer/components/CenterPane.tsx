import { useEffect, useRef, useState } from 'react';
import { Tabs } from '@mantine/core';
import { IconPencil, IconLayoutDashboard } from '@tabler/icons-react';
import ChapterEditor from './ChapterEditor';
import WorkflowResultView from './WorkflowResultView';
import WelcomeView from './WelcomeView';
import { useAnyRunning, useWorkflow } from '../stores/workflowStore';
import { useProject } from '../stores/projectStore';

interface Props {
  openSettings: () => void;
  openNewProject: () => void;
  openExistingProject: () => void;
}

/**
 * 中栏：三模式。
 *  - welcome: 没项目 / 项目就绪未选文件 → 引导
 *  - editor:  CodeMirror 编辑当前章节
 *  - workflow: 当前 workflow 的进度 + 结果
 *
 * 优先级：workflow 一开始跑就自动切；用户编辑 → editor；其他 → welcome。
 */
export default function CenterPane({
  openSettings,
  openNewProject,
  openExistingProject
}: Props): JSX.Element {
  const running = useAnyRunning();
  const hasRuns = useWorkflow((s) => Object.keys(s.runs).length > 0);
  const activeFilePath = useProject((s) => s.activeFilePath);
  const meta = useProject((s) => s.meta);

  // 决定默认 tab：
  //  - workflow 运行中 → workflow
  //  - 已经在编辑文件 → editor
  //  - 否则 → welcome
  const initialTab = (): 'welcome' | 'editor' | 'workflow' => {
    if (running || hasRuns) return 'workflow';
    if (activeFilePath) return 'editor';
    return 'welcome';
  };

  const [tab, setTab] = useState<'welcome' | 'editor' | 'workflow'>(initialTab);
  const prevActivePath = useRef<string | null>(activeFilePath);

  // workflow 一启动 → 自动切到 workflow tab
  useEffect(() => {
    if (running) setTab('workflow');
  }, [running]);

  // 文件**刚打开 / 切到另一个文件**时 → 自动切到 editor。
  // 之前这里的依赖里带了 `tab`，导致点「引导」时 effect 被 tab 变化再次触发，
  // 又把 tab 强拽回 editor —— 现在改成只对 activeFilePath 的真实变化反应。
  useEffect(() => {
    if (activeFilePath && activeFilePath !== prevActivePath.current) {
      setTab('editor');
    }
    prevActivePath.current = activeFilePath;
  }, [activeFilePath]);

  // 项目状态变化 → 重置 tab
  useEffect(() => {
    if (!meta && !activeFilePath) setTab('welcome');
  }, [meta, activeFilePath]);

  return (
    <Tabs
      value={tab}
      onChange={(v) => v && setTab(v as 'welcome' | 'editor' | 'workflow')}
      keepMounted
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <Tabs.List>
        <Tabs.Tab value="welcome">引导</Tabs.Tab>
        <Tabs.Tab
          value="editor"
          leftSection={<IconPencil size={14} />}
          disabled={!activeFilePath}
        >
          编辑
        </Tabs.Tab>
        <Tabs.Tab
          value="workflow"
          leftSection={<IconLayoutDashboard size={14} />}
        >
          Workflow 结果
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="welcome" style={{ flex: 1, minHeight: 0 }}>
        <WelcomeView
          openSettings={openSettings}
          openNewProject={openNewProject}
          openExistingProject={openExistingProject}
        />
      </Tabs.Panel>
      <Tabs.Panel value="editor" style={{ flex: 1, minHeight: 0 }}>
        <ChapterEditor />
      </Tabs.Panel>
      <Tabs.Panel value="workflow" style={{ flex: 1, minHeight: 0 }}>
        <WorkflowResultView />
      </Tabs.Panel>
    </Tabs>
  );
}
