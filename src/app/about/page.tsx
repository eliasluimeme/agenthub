import type { Metadata } from 'next';
import { ContentView } from '@/components/ContentView';

export const metadata: Metadata = { title: 'About' };

export default function Page() {
  return <ContentView slug="about" />;
}
