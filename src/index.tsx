import * as React from 'react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';

// HTMLから 'root' 要素を取得
const rootElement = document.getElementById('root');

// もし rootElement が存在したら、それをターゲットにしてReactアプリを起動
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}