'use client';

// V1.5.0 修：ThemeScript 拆到独立 'use client' 文件
// 之前跟 ThemeProvider 同文件 'use client' 导致 SSR 错

import { STORAGE_KEY, DEFAULT_THEME } from './ThemeProvider';

export const ThemeScript = () => {
  const code = `
    (function() {
      try {
        var t = localStorage.getItem('${STORAGE_KEY}');
        if (t === 'blue' || t === 'green') {
          document.documentElement.setAttribute('data-theme', t);
        } else {
          document.documentElement.setAttribute('data-theme', '${DEFAULT_THEME}');
        }
      } catch (e) {
        document.documentElement.setAttribute('data-theme', '${DEFAULT_THEME}');
      }
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
};
