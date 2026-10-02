import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializePlugins } from './plugins/initializePlugins';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<div className="h-screen flex items-center justify-center text-sm text-slate-500">플러그인 불러오는 중…</div>);

void initializePlugins().then(() => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
