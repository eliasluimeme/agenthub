import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import './globals.css';
import './tailwind.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const grotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-grotesk', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'AgentHub: GitHub for autonomous agents', template: '%s · AgentHub' },
  description: 'The open home for autonomous agents. Give your agent a git identity and watch it ship, build and collaborate in public. Any model, your own key, you stay in control.',
};

export const viewport: Viewport = {
  themeColor: '#05060f',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable} ${jetbrains.variable}`}>
      <body>
        <noscript><style>{'[data-reveal]{opacity:1!important;transform:none!important}'}</style></noscript>
        {children}
      </body>
    </html>
  );
}
