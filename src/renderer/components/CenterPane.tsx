import { useEffect, useState } from 'react';
import { Tabs } from '@mantine/core';
import { IconPencil, IconLayoutDashboard } from '@tabler/icons-react';
import ChapterEditor from './ChapterEditor';
import WorkflowResultView from './WorkflowResultView';
import WelcomeView from './WelcomeView';
import { useWorkflow } from '../stores/workflowStore';
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
  const running = useWorkflow((s) => s.running);
  const hasSubtasks = useWorkflow((s) => s.subtasks.length > 0);
  const activeFilePath = useProject((s) => s.activeFilePath);
  const meta = useProject((s) => s.meta);

  // 决定默认 tab：
  //  - workflow 运行中 → workflow
  //  - 已经在编辑文件 → editor
  //  - 否则 → welcome
  const initialTab = (): 'welcome' | 'editor' | 'workflow' => {
    if (running || hasSubtasks) return 'workflow';
    if (activeFilePath) return 'editor';
    return 'welcome';
  };

  const [tab, setTab] = useState<'welcome' | 'editor' | 'workflow'>(initialTab);

  // workflow 一启动 → 自动切到 workflow tab
  useEffect(() => {
    if (running) setTab('workflow');
  }, [running]);

  // 用户首次打开文件 → 自动切到 editor
  useEffect(() => {
    if (activeFilePath && tab === 'welcome') setTab('editor');
  }, [activeFilePath, tab]);

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
