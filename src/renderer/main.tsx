import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import App from './App';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './styles/globals.css';

const theme = createTheme({
  primaryColor: 'indigo',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  fontFamilyMonospace:
    '"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace',
  defaultRadius: 'md'
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark">
      {/* autoClose 2s — 之前默认 4s 太长。单条 notification 可以再覆盖 */}
      <Notifications position="top-right" autoClose={2000} />
      <App />
    </MantineProvider>
  </React.StrictMode>
);
