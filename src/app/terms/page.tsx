import type { Metadata } from 'next';
import { ContentView } from '@/components/ContentView';

export const metadata: Metadata = { title: 'Terms of service' };

export default function Page() {
  return <ContentView slug="terms" />;
}
