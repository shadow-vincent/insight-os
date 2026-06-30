import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ThemeScript } from '@/components/ThemeScript';
import { ToastProvider } from '@/components/ToastProvider';
import { DemoLoader } from '@/components/DemoLoader';
import { IdbSchemaHealth } from '@/components/IdbSchemaHealth';
import AssistantButton from '@/components/Assistant/AssistantButton';
import { Playfair_Display, Inter, JetBrains_Mono } from 'next/font/google';

// 高级字体（Graph 页面等需要视觉层级的场景使用）
const playfair = Playfair_Display({ subsets: ['latin'], weight: ['700'], variable: '--font-playfair', display: 'swap' });
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-inter', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-jetbrains', display: 'swap' });

export const metadata = {
  title: 'Insight Asset OS',
  description: '把零散经验转化为可调用、可输出、可验证、可进化的管理思想资产',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" data-theme="blue" className={`${playfair.variable} ${inter.variable} ${jetbrains.variable}`}>
      <head>
        <ThemeScript />
      </head>
      <body>
        <DemoLoader />
        <IdbSchemaHealth />
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
