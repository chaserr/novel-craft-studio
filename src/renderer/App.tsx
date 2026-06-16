import { useEffect, useState } from 'react';
import { AppShell, Group, Title, Button, ActionIcon, Tooltip, Badge, Tabs, Box } from '@mantine/core';
import { IconSettings, IconFolderOpen, IconFilePlus, IconLayoutDashboard, IconMessage, IconInfoCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useSettings } from './stores/settingsStore';
import { useProject } from './stores/projectStore';
import ProjectSidebar from './components/ProjectSidebar';
import CenterPane from './components/CenterPane';
import WorkflowPanel from './components/WorkflowPanel';
import ChatPanel from './components/ChatPanel';
import SettingsModal from './components/SettingsModal';
import NewProjectModal from './components/NewProjectModal';
import AboutModal from './components/AboutModal';
import { api } from './lib/ipc';

export default function App(): JSX.Element {
  const isMac = api.platform === 'darwin';
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const loadSettings = useSettings((s) => s.load);
  const settingsLoaded = useSettings((s) => s.loaded);
  const novelCraftPath = useSettings((s) => s.settings.novelCraftPath);
  const meta = useProject((s) => s.meta);
  const openProject = useProject((s) => s.openProject);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // 首次启动如果没设置 novel-craft 路径，自动弹 Settings
  useEffect(() => {
    if (settingsLoaded && !novelCraftPath) {
      setSettingsOpen(true);
    }
  }, [settingsLoaded, novelCraftPath]);

  const handleOpen = async (): Promise<void> => {
    const dir = await api.project.pickDirectory();
    if (!dir) return;
    try {
      await openProject(dir);
      notifications.show({ message: '项目已打开', color: 'green' });
    } catch (err) {
      notifications.show({
        title: '打开失败',
        message: String(err),
        color: 'red'
      });
    }
  };

  return (
    <AppShell
      header={{ height: 48 }}
      navbar={{ width: 260, breakpoint: 'sm' }}
      aside={{ width: 360, breakpoint: 'sm' }}
      padding={0}
    >
      <AppShell.Header className="app-titlebar">
        <Group justify="space-between" h="100%" px="md" wrap="nowrap">
          <Group gap="xs" pl={isMac ? 60 : 0}>
            <Title order={5}>Orchid</Title>
            {meta && (
              <Badge variant="light" color="indigo">
                {meta.bookTitle}
              </Badge>
            )}
          </Group>
          <Group gap="xs">
            <Button
              size="xs"
              variant="default"
              leftSection={<IconFilePlus size={14} />}
              onClick={() => setNewProjectOpen(true)}
              data-no-drag
            >
              新建项目
            </Button>
            <Button
              size="xs"
              variant="default"
              leftSection={<IconFolderOpen size={14} />}
              onClick={handleOpen}
              data-no-drag
            >
              打开项目
            </Button>
            <Tooltip label="关于">
              <ActionIcon
                variant="default"
                onClick={() => setAboutOpen(true)}
                data-no-drag
              >
                <IconInfoCircle size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="设置">
              <ActionIcon
                variant="default"
                onClick={() => setSettingsOpen(true)}
                data-no-drag
              >
                <IconSettings size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        <ProjectSidebar />
      </AppShell.Navbar>

      <AppShell.Aside p={0}>
        <Tabs
          defaultValue="workflow"
          keepMounted
          style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
        >
          <Tabs.List>
            <Tabs.Tab value="workflow" leftSection={<IconLayoutDashboard size={14} />}>
              工作流
            </Tabs.Tab>
            <Tabs.Tab value="chat" leftSection={<IconMessage size={14} />}>
              自由询问
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="workflow" style={{ flex: 1, minHeight: 0 }}>
            <Box h="100%">
              <WorkflowPanel />
            </Box>
          </Tabs.Panel>
          <Tabs.Panel value="chat" style={{ flex: 1, minHeight: 0 }}>
            <Box h="100%">
              <ChatPanel />
            </Box>
          </Tabs.Panel>
        </Tabs>
      </AppShell.Aside>

      <AppShell.Main style={{ height: 'calc(100vh - 48px)' }}>
        <CenterPane
          openSettings={() => setSettingsOpen(true)}
          openNewProject={() => setNewProjectOpen(true)}
          openExistingProject={() => void handleOpen()}
        />
      </AppShell.Main>

      <SettingsModal opened={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <NewProjectModal
        opened={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
      />
      <AboutModal opened={aboutOpen} onClose={() => setAboutOpen(false)} />
    </AppShell>
  );
}
