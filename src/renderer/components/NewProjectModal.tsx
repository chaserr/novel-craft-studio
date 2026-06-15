import { useState } from 'react';
import {
  Modal,
  Stack,
  TextInput,
  Textarea,
  Button,
  Group,
  Select,
  MultiSelect,
  Switch,
  Text
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useProject } from '../stores/projectStore';
import { api } from '../lib/ipc';
import type { NewProjectFields } from '../../shared/types';

interface Props {
  opened: boolean;
  onClose: () => void;
}

const TONE_OPTIONS = [
  '温暖治愈',
  '青春遗憾',
  '现实写实',
  '轻松幽默',
  '冷静克制',
  '暗黑悬疑',
  '热血燃情',
  '群像写实',
  '不滥情'
];

export default function NewProjectModal({
  opened,
  onClose
}: Props): JSX.Element {
  const createProject = useProject((s) => s.createProject);
  const [submitting, setSubmitting] = useState(false);
  const [fields, setFields] = useState<NewProjectFields>({
    bookTitle: '',
    genre: '',
    targetReader: '',
    coreTone: [],
    mainCharacters: '',
    platform: '私人创作',
    scale: '中长篇 30-80 万字（30-80 章）',
    multiverse: false
  });

  const handleSubmit = async (): Promise<void> => {
    if (!fields.bookTitle.trim()) {
      notifications.show({ message: '请填写书名', color: 'red' });
      return;
    }
    if (!fields.genre.trim()) {
      notifications.show({ message: '请填写题材', color: 'red' });
      return;
    }
    if (fields.coreTone.length === 0) {
      notifications.show({ message: '请选择至少一个核心气质', color: 'red' });
      return;
    }
    if (!fields.mainCharacters.trim()) {
      notifications.show({
        message: '请至少填写一位主线人物',
        color: 'red'
      });
      return;
    }

    const targetDir = await api.project.pickDirectory();
    if (!targetDir) return;

    setSubmitting(true);
    try {
      await createProject(fields, targetDir);
      notifications.show({
        title: '项目已创建',
        message: targetDir,
        color: 'green'
      });
      onClose();
    } catch (err) {
      notifications.show({
        title: '创建失败',
        message: String(err),
        color: 'red'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="新建小说项目"
      size="lg"
      centered
    >
      <Stack gap="md">
        <TextInput
          label="书名"
          required
          value={fields.bookTitle}
          onChange={(e) =>
            setFields({ ...fields, bookTitle: e.currentTarget.value })
          }
          placeholder="例：暮色街角"
        />
        <TextInput
          label="题材"
          required
          value={fields.genre}
          onChange={(e) =>
            setFields({ ...fields, genre: e.currentTarget.value })
          }
          placeholder="例：都市悬疑 / 校园青春 / 武侠 / 科幻"
        />
        <TextInput
          label="目标读者画像"
          required
          value={fields.targetReader}
          onChange={(e) =>
            setFields({ ...fields, targetReader: e.currentTarget.value })
          }
          placeholder="例：25-35 岁，喜欢慢节奏推理"
        />
        <MultiSelect
          label="核心气质（≤5 个）"
          required
          data={TONE_OPTIONS}
          searchable
          value={fields.coreTone}
          onChange={(v) =>
            setFields({ ...fields, coreTone: v.slice(0, 5) })
          }
          placeholder="选择或输入"
          maxValues={5}
        />
        <Textarea
          label="主线人物（一行一位，格式：姓名：一句话设定）"
          required
          value={fields.mainCharacters}
          onChange={(e) =>
            setFields({ ...fields, mainCharacters: e.currentTarget.value })
          }
          placeholder={'陈舟：32 岁前刑警，离职后做私家侦探\n林晚：法医，主角的旧识'}
          autosize
          minRows={3}
        />
        <Group grow>
          <Select
            label="写作平台"
            data={[
              '私人创作',
              '出版向',
              '起点',
              '番茄',
              '晋江',
              '其他网文平台'
            ]}
            value={fields.platform}
            onChange={(v) => v && setFields({ ...fields, platform: v })}
          />
          <Select
            label="篇幅预期"
            description="按字数 / 章数选最贴近的；后续可在 RTK.md 改"
            data={[
              { value: '短篇 5-30 万字（10-30 章）', label: '短篇 · 5-30 万字（10-30 章）' },
              { value: '中长篇 30-80 万字（30-80 章）', label: '中长篇 · 30-80 万字（30-80 章）' },
              { value: '长篇 80-200 万字（80-200 章）', label: '长篇 · 80-200 万字（80-200 章）' },
              { value: '网文长篇 200-500 万字（200-500 章）', label: '网文长篇 · 200-500 万字（200-500 章）' },
              { value: '网文超长 500 万字以上（500+ 章）', label: '网文超长 · 500 万字以上（500+ 章）' }
            ]}
            value={fields.scale}
            onChange={(v) => v && setFields({ ...fields, scale: v })}
          />
        </Group>
        <Switch
          label="多书同宇宙"
          description="勾选后会在 RTK.md 标注本书属于可扩展的同宇宙体系"
          checked={fields.multiverse}
          onChange={(e) =>
            setFields({ ...fields, multiverse: e.currentTarget.checked })
          }
        />
        <Text size="xs" c="dimmed">
          点击"创建"会弹窗让你选择项目目录。模板从 Settings 中指定的
          novel-craft 仓库读取。
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            取消
          </Button>
          <Button onClick={() => void handleSubmit()} loading={submitting}>
            创建
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
