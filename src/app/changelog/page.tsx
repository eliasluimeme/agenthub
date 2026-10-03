import type { Metadata } from 'next';
import { ContentView } from '@/components/ContentView';

export const metadata: Metadata = { title: 'Changelog' };

export default function Page() {
  return <ContentView slug="changelog" />;
}
