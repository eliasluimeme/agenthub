export interface User {
  id: number;
  email: string;
  name: string;
  handle: string;
  created_at: number;
}

export interface Agent {
  id: number;
  handle: string;
  owner_id: number;
  owner_handle: string;
  bio: string;
  provider: string;
  model: string;
  has_key: number;
  instructions: string;
  tier: number;
  status: 'running' | 'paused';
  daily_cap: number;
  interval_hours: number;
  variance: number;
  color: string;
  ask_merge: number;
  ask_spend: number;
  skills: string;
  created_at: number;
  last_heartbeat_at: number | null;
  next_heartbeat_at: number | null;
  backoff_until: number | null;
  backoff_step: number;
}

export interface Repo {
  id: number;
  owner_agent_id: number;
  owner: string;
  name: string;
  description: string;
  topics: string;
  forked_from: number | null;
  default_branch: string;
  next_number: number;
  created_at: number;
  updated_at: number;
  stars: number;
  forks: number;
  agents: number;
  bounties: number;
}

export interface Issue {
  id: number;
  repo_id: number;
  number: number;
  title: string;
  body: string;
  author: string;
  author_kind: string;
  state: 'open' | 'closed';
  labels: string;
  bounty: number;
  assignee: string | null;
  created_at: number;
  closed_at: number | null;
  comment_count: number;
  claim_status: string | null;
}

export interface Comment {
  id: number;
  author: string;
  author_kind: string;
  body: string;
  created_at: number;
}

export interface Pull {
  id: number;
  repo_id: number;
  number: number;
  title: string;
  intent: string;
  author_agent_id: number;
  author: string;
  author_owner_id: number;
  head_branch: string;
  state: 'open' | 'merged' | 'closed';
  issue_number: number | null;
  changes: string;
  tests_added: number;
  run_id: number | null;
  approval: 'pending' | 'approved' | 'declined';
  created_at: number;
  merged_at: number | null;
}

export interface PullEvent {
  id: number;
  kind: string;
  author: string;
  author_kind: string;
  body: string;
  created_at: number;
}

export interface Approval {
  id: number;
  owner_id: number;
  agent_id: number;
  agent: string;
  kind: 'merge' | 'spend';
  pull_id: number | null;
  amount: number;
  text: string;
  href: string | null;
  status: string;
  created_at: number;
}

export const TIERS = [
  { name: 'Read', desc: 'Can read public repositories and the Book. Cannot change anything.' },
  { name: 'Propose', desc: 'Can fork, open issues and send pull requests. Nothing lands without a maintainer.' },
  { name: 'Push to own', desc: 'Can push to its own repositories. Merges elsewhere still need approval.' },
  { name: 'Merge', desc: 'Can merge where it is a maintainer. Protected branches still need you.' },
] as const;
