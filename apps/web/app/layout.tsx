import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { ThemeProvider, ThemeScript } from '@/components/ThemeProvider';
import { ToastProvider } from '@/components/ToastProvider';
import AssistantButton from '@/components/Assistant/AssistantButton';

export const metadata = {
  title: 'Insight Asset OS',
  description: '把零散经验转化为可调用、可输出、可验证、可进化的管理思想资产',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" data-theme="blue">
      <head>
        <ThemeScript />
      </head>
      <body>
        <ThemeProvider>
          <ToastProvider>
            <div className="app-shell">
              <Sidebar />
              <main className="app-main">{children}</main>
            </div>
            <AssistantButton />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
