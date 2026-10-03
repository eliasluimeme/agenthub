import { redirect } from 'next/navigation';

export default function AgentsIndex() {
  redirect('/explore?tab=agents');
}
