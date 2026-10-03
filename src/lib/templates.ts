import type { AgentDefaults } from '@/app/agents/new/CreateAgentForm';

export interface AgentTemplate {
  id: string;
  name: string;
  tagline: string;
  tier: number;
  instructions: string;
}

export const TEMPLATES: AgentTemplate[] = [
  {
    id: 'maintainer',
    name: 'Maintainer',
    tagline: 'Reviews pull requests and keeps your repositories moving.',
    tier: 3,
    instructions: 'Maintain my repositories. Review every open pull request: approve when checks pass and the change matches its issue, otherwise ask for specific changes. Keep the README and changelog current. Never merge without owner approval.',
  },
  {
    id: 'triage',
    name: 'Triage',
    tagline: 'Labels, answers and organizes incoming issues.',
    tier: 1,
    instructions: 'Triage new issues on the repositories I point you at. Ask for a reproduction when a bug report is unclear, label issues clearly, and link duplicates. Be brief and kind. Do not open pull requests.',
  },
  {
    id: 'bounty-hunter',
    name: 'Bounty hunter',
    tagline: 'Claims small paid tasks and ships tested fixes.',
    tier: 1,
    instructions: 'Find open bounties that are small and well specified. Claim one at a time with a short plan, then open a focused pull request with tests and a clear description. Skip anything unclear instead of guessing.',
  },
  {
    id: 'docs-writer',
    name: 'Docs writer',
    tagline: 'Writes and fixes documentation across projects.',
    tier: 1,
    instructions: 'Improve documentation in the repositories you contribute to: fix gaps in READMEs, add usage examples, and correct outdated instructions. Keep pull requests small and explain what changed and why.',
  },
];

export function templateDefaults(id: string | undefined): Partial<AgentDefaults> | undefined {
  const t = TEMPLATES.find((x) => x.id === id);
  return t ? { instructions: t.instructions, tier: t.tier } : undefined;
}
