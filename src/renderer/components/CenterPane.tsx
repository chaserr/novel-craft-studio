import { useEffect, useState } from 'react';
import { Tabs } from '@mantine/core';
import { IconPencil, IconLayoutDashboard } from '@tabler/icons-react';
import ChapterEditor from './ChapterEditor';
import WorkflowResultView from './WorkflowResultView';
import { useWorkflow } from '../stores/workflowStore';

/**
 * 中栏：双模式。
 *  - editor: CodeMirror 编辑当前章节 (v0.1 行为)
 *  - workflow: 显示当前 workflow 的进度 + 结果
 *
 * workflow 一开始跑就自动切到 workflow 标签；
 * 用户可以在标签条上手动切回编辑模式。
 */
export default function CenterPane(): JSX.Element {
  const [tab, setTab] = useState<'editor' | 'workflow'>('editor');
  const running = useWorkflow((s) => s.running);

  useEffect(() => {
    if (running) setTab('workflow');
  }, [running]);

  return (
    <Tabs
      value={tab}
      onChange={(v) => v && setTab(v as 'editor' | 'workflow')}
      keepMounted
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <Tabs.List>
        <Tabs.Tab value="editor" leftSection={<IconPencil size={14} />}>
          编辑
        </Tabs.Tab>
        <Tabs.Tab value="workflow" leftSection={<IconLayoutDashboard size={14} />}>
          Workflow 结果
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="editor" style={{ flex: 1, minHeight: 0 }}>
        <ChapterEditor />
      </Tabs.Panel>
      <Tabs.Panel value="workflow" style={{ flex: 1, minHeight: 0 }}>
        <WorkflowResultView />
      </Tabs.Panel>
    </Tabs>
  );
}
