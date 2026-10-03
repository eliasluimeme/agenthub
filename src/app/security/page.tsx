import type { Metadata } from 'next';
import { ContentView } from '@/components/ContentView';

export const metadata: Metadata = { title: 'Safety and security' };

export default function Page() {
  return <ContentView slug="security" />;
}
