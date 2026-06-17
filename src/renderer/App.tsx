import { useEffect, useRef, useState } from 'react';
import {
  AppShell,
  Group,
  Title,
  Button,
  ActionIcon,
  Tooltip,
  Tabs,
  Box,
  CloseButton,
  Menu,
  useMantineColorScheme
} from '@mantine/core';
import {
  IconSettings,
  IconFolderOpen,
  IconFilePlus,
  IconLayoutDashboard,
  IconMessage,
  IconInfoCircle,
  IconSun,
  IconMoon,
  IconDeviceDesktop
} from '@tabler/icons-react';
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
  const settingsColorScheme = useSettings((s) => s.settings.colorScheme);
  const setColorSchemeSetting = useSettings((s) => s.setColorScheme);
  const opened = useProject((s) => s.opened);
  const activeId = useProject((s) => s.activeId);
  const setActive = useProject((s) => s.setActive);
  const closeProjectById = useProject((s) => s.closeProjectById);
  const openProject = useProject((s) => s.openProject);
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  const firstLoadAutoOpened = useRef(false);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // 首次启动且 novel-craft 路径未配 → 自动弹设置一次。用 ref 守护防止
  // 后续 settings 字段变化（比如主题切换）重复触发弹窗。
  useEffect(() => {
    if (!settingsLoaded || firstLoadAutoOpened.current) return;
    firstLoadAutoOpened.current = true;
    if (!novelCraftPath) setSettingsOpen(true);
  }, [settingsLoaded, novelCraftPath]);

  // 把 settings 里的 colorScheme 同步到 Mantine（仅在它们不一致时）
  useEffect(() => {
    if (!settingsLoaded) return;
    if (settingsColorScheme && settingsColorScheme !== colorScheme) {
      setColorScheme(settingsColorScheme);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoaded, settingsColorScheme]);

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

  const cycleColorScheme = (): void => {
    const order = ['light', 'dark', 'auto'] as const;
    const cur = settingsColorScheme ?? 'dark';
    const next = order[(order.indexOf(cur) + 1) % order.length];
    setColorScheme(next);
    void setColorSchemeSetting(next);
  };

  const colorSchemeIcon =
    settingsColorScheme === 'light' ? (
      <IconSun size={16} />
    ) : settingsColorScheme === 'auto' ? (
      <IconDeviceDesktop size={16} />
    ) : (
      <IconMoon size={16} />
    );

  return (
    <AppShell
      header={{ height: 48 }}
      navbar={{ width: 260, breakpoint: 'sm' }}
      aside={{ width: 360, breakpoint: 'sm' }}
      padding={0}
    >
      <AppShell.Header className="app-titlebar">
        <Group justify="space-between" h="100%" px="md" wrap="nowrap">
          <Group gap="xs" pl={isMac ? 60 : 0} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
            <Title order={5} style={{ flexShrink: 0 }}>
              Orchid
            </Title>
            {opened.length > 0 && (
              <Group
                gap={4}
                wrap="nowrap"
                style={{
                  overflowX: 'auto',
                  minWidth: 0,
                  flex: 1,
                  scrollbarWidth: 'thin'
                }}
              >
                {opened.map((p) => {
                  const isActive = p.id === activeId;
                  return (
                    <Button
                      key={p.id}
                      size="xs"
                      variant={isActive ? 'light' : 'subtle'}
                      color="indigo"
                      onClick={() => setActive(p.id)}
                      data-no-drag
                      style={{ flexShrink: 0, paddingRight: 4 }}
                      rightSection={
                        <CloseButton
                          size="xs"
                          aria-label={`关闭 ${p.meta.bookTitle}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            closeProjectById(p.id);
                          }}
                        />
                      }
                    >
                      {p.meta.bookTitle}
                    </Button>
                  );
                })}
              </Group>
            )}
          </Group>
          <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
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
            <Tooltip label={`主题：${settingsColorScheme ?? 'dark'}（点击切换）`}>
              <ActionIcon variant="default" onClick={cycleColorScheme} data-no-drag>
                {colorSchemeIcon}
              </ActionIcon>
            </Tooltip>
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
