// Local Automation Client for MIMO Automation Agent
// Connects to http://127.0.0.1:8799

const AGENT_URL = 'http://127.0.0.1:8799';

interface AutomationPlan {
  plan: string[];
  risks: string[];
  requiresConfirmation: boolean;
  dryRun: boolean;
  requiredUserConfig: string[];
}

interface AutomationResult {
  dryRun: boolean;
  executed?: string[];
  wouldExecute?: string[];
  workspace: string;
  results?: Array<{
    command: string;
    status: string;
    output: string;
  }>;
}

interface HealthCheckResult {
  status: string;
  agent: string;
  version: string;
  capabilities: string[];
}

export async function healthCheck(): Promise<HealthCheckResult | null> {
  try {
    const response = await fetch(`${AGENT_URL}/api/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch {
    return null;
  }
}

export async function createAutomationPlan(payload: {
  goal: string;
  workspace?: string;
  target?: string;
}): Promise<AutomationPlan | null> {
  try {
    const response = await fetch(`${AGENT_URL}/api/automation/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch {
    return null;
  }
}

export async function runAutomation(payload: {
  commands: string[];
  workspace?: string;
  dryRun?: boolean;
  explicitConfirm?: boolean;
}): Promise<AutomationResult | null> {
  try {
    const response = await fetch(`${AGENT_URL}/api/automation/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch {
    return null;
  }
}

export function isAgentOnline(): Promise<boolean> {
  return healthCheck().then(result => result !== null);
}