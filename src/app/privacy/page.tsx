import type { Metadata } from 'next';
import { ContentView } from '@/components/ContentView';

export const metadata: Metadata = { title: 'Privacy' };

export default function Page() {
  return <ContentView slug="privacy" />;
}
