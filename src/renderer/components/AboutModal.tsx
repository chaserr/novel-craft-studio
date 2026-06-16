import { useEffect, useState } from 'react';
import {
  Modal,
  Stack,
  Group,
  Text,
  Title,
  Badge,
  Anchor,
  Button,
  CopyButton,
  Code,
  Divider,
  Tooltip,
  Image
} from '@mantine/core';
import { IconCopy, IconCheck, IconExternalLink, IconScale } from '@tabler/icons-react';
import { api } from '../lib/ipc';
import type { BuildInfo } from '../../preload/index';
import iconUrl from '../assets/icon.png';

const APP_VERSION = '0.2.0';
const UPSTREAM_REPO = 'https://github.com/chaserr/novel-craft-studio';
const LICENSE_URL = 'https://polyformproject.org/licenses/noncommercial/1.0.0';
const COMMERCIAL_ISSUE_URL =
  'https://github.com/chaserr/novel-craft-studio/issues/new?title=%5BCommercial+License+Request%5D';

interface Props {
  opened: boolean;
  onClose: () => void;
}

export default function AboutModal({ opened, onClose }: Props): JSX.Element {
  const [info, setInfo] = useState<BuildInfo | null>(null);

  useEffect(() => {
    if (!opened) return;
    api.app
      .buildInfo()
      .then(setInfo)
      .catch(() => setInfo(null));
  }, [opened]);

  const openExternal = (url: string): void => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Modal opened={opened} onClose={onClose} title="关于 Orchid" size="md" centered>
      <Stack gap="md">
        <Group gap="md" align="center" wrap="nowrap">
          <Image src={iconUrl} alt="Orchid" w={72} h={72} radius="md" />
          <Stack gap={4}>
            <Group gap="xs">
              <Title order={3} m={0}>
                Orchid
              </Title>
              <Badge variant="light" color="indigo">
                v{APP_VERSION}
              </Badge>
              {info && (
                <Badge variant="outline" color={info.channel === 'release' ? 'green' : 'gray'}>
                  {info.channel}
                </Badge>
              )}
            </Group>
            <Text size="sm" c="dimmed">
              多 LLM 长篇小说创作工作台
            </Text>
          </Stack>
        </Group>

        <Divider />

        <Stack gap={6}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            构建指纹 / Build Fingerprint
          </Text>
          {info ? (
            <Group gap="xs" wrap="nowrap">
              <Code style={{ flex: 1, overflow: 'auto' }}>{info.fingerprint}</Code>
              <CopyButton value={info.fingerprint} timeout={1500}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? '已复制' : '复制'}>
                    <Button
                      size="xs"
                      variant="default"
                      leftSection={
                        copied ? <IconCheck size={14} /> : <IconCopy size={14} />
                      }
                      onClick={copy}
                    >
                      {copied ? '已复制' : '复制'}
                    </Button>
                  </Tooltip>
                )}
              </CopyButton>
            </Group>
          ) : (
            <Text size="sm" c="dimmed">
              加载中…
            </Text>
          )}
          {info && (
            <Text size="xs" c="dimmed">
              tag={info.tag} · built={info.timestamp}
            </Text>
          )}
        </Stack>

        <Divider />

        <Stack gap={6}>
          <Group gap="xs">
            <IconScale size={16} />
            <Text size="sm" fw={600}>
              使用许可
            </Text>
          </Group>
          <Text size="sm">
            本软件采用{' '}
            <Anchor
              size="sm"
              component="button"
              type="button"
              onClick={() => openExternal(LICENSE_URL)}
            >
              PolyForm Noncommercial License 1.0.0
            </Anchor>{' '}
            协议，允许个人学习、研究、修改与非商业传播。
          </Text>
          <Text size="sm" c="red.7">
            <b>禁止</b>：销售、付费 SaaS 托管、商业贴牌、二次包装售卖，或移除/篡改软件内嵌的版本指纹。
          </Text>
          <Text size="xs" c="dimmed">
            完整条款见随附 <Code>LICENSE</Code> 文件。
          </Text>
        </Stack>

        <Divider />

        <Group justify="space-between" gap="xs">
          <Button
            size="xs"
            variant="default"
            leftSection={<IconExternalLink size={14} />}
            onClick={() => openExternal(UPSTREAM_REPO)}
          >
            上游仓库
          </Button>
          <Button
            size="xs"
            variant="filled"
            color="indigo"
            leftSection={<IconExternalLink size={14} />}
            onClick={() => openExternal(COMMERCIAL_ISSUE_URL)}
          >
            申请商业授权
          </Button>
        </Group>

        <Text size="xs" c="dimmed" ta="center">
          © 2026 chaser
        </Text>
      </Stack>
    </Modal>
  );
}
