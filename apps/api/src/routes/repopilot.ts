import { FastifyInstance } from 'fastify';

interface SecurityAuditRequest {
  packageJson?: {
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  dockerfile?: string;
  githubActions?: string;
}

interface SecurityFinding {
  type: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  description: string;
  recommendation: string;
}

interface SecurityAuditResult {
  riskScore: number;
  findings: SecurityFinding[];
  recommendedAction: string;
  meta: {
    mode: string;
    durationMs: number;
  };
}

// 危险关键词
const DANGEROUS_KEYWORDS = {
  scripts: ['postinstall', 'preinstall', 'curl', 'wget', 'sudo', 'rm -rf', 'chmod', 'eval', 'base64', 'powershell', 'invoke-webrequest'],
  dockerfile: ['run curl', 'run wget', 'run sudo', 'add http', 'copy http'],
  actions: ['uses: docker/', 'run: curl', 'run: wget', 'run: sudo'],
};

// 检测危险脚本
function auditPackageJson(packageJson: any): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  
  if (packageJson.scripts) {
    for (const [name, script] of Object.entries(packageJson.scripts)) {
      const scriptStr = (script as string).toLowerCase();
      for (const keyword of DANGEROUS_KEYWORDS.scripts) {
        if (scriptStr.includes(keyword)) {
          findings.push({
            type: keyword === 'postinstall' || keyword === 'preinstall' ? 'critical' : 'high',
            category: 'package.json scripts',
            description: `脚本 "${name}" 包含危险关键词: ${keyword}`,
            recommendation: `检查脚本内容，确认是否安全。建议: npm inspect <package>`,
          });
        }
      }
    }
  }
  
  return findings;
}

// 检测 Dockerfile
function auditDockerfile(dockerfile: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const lines = dockerfile.split('\n');
  
  for (const line of lines) {
    const lower = line.toLowerCase().trim();
    for (const keyword of DANGEROUS_KEYWORDS.dockerfile) {
      if (lower.includes(keyword)) {
        findings.push({
          type: 'high',
          category: 'Dockerfile',
          description: `Dockerfile 包含危险命令: ${keyword}`,
          recommendation: '检查 Dockerfile 内容，确认是否安全',
        });
      }
    }
  }
  
  return findings;
}

// 计算风险分数
function calculateRiskScore(findings: SecurityFinding[]): number {
  let score = 100;
  for (const finding of findings) {
    switch (finding.type) {
      case 'critical': score -= 30; break;
      case 'high': score -= 20; break;
      case 'medium': score -= 10; break;
      case 'low': score -= 5; break;
    }
  }
  return Math.max(0, score);
}

export async function repopilotRoutes(fastify: FastifyInstance) {
  // 安全审查
  fastify.post<{ Body: SecurityAuditRequest }>('/security-audit', async (request, reply) => {
    const { packageJson, dockerfile, githubActions } = request.body;
    
    if (!packageJson && !dockerfile && !githubActions) {
      return reply.status(400).send({ error: '请提供 packageJson、dockerfile 或 githubActions' });
    }
    
    const startTime = Date.now();
    const findings: SecurityFinding[] = [];
    
    if (packageJson) {
      findings.push(...auditPackageJson(packageJson));
    }
    
    if (dockerfile) {
      findings.push(...auditDockerfile(dockerfile));
    }
    
    const riskScore = calculateRiskScore(findings);
    const recommendedAction = riskScore >= 80 ? '可以安全部署' : riskScore >= 50 ? '需要审查后部署' : '不建议部署';
    
    return {
      riskScore,
      findings,
      recommendedAction,
      meta: {
        mode: 'local-rules',
        durationMs: Date.now() - startTime,
      },
    };
  });
  
  // 部署计划
  fastify.post('/deploy-plan', async (request, reply) => {
    const { repo, packageJson } = request.body as any;
    
    if (!repo) {
      return reply.status(400).send({ error: '请提供仓库信息' });
    }
    
    const startTime = Date.now();
    
    // 检测框架
    let framework = 'unknown';
    let devCommand = 'npm run dev';
    let buildCommand = 'npm run build';
    let startCommand = 'npm start';
    const requiredEnvVars: string[] = [];
    
    if (packageJson) {
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      if (deps.astro) {
        framework = 'Astro';
        devCommand = 'npm run dev';
        buildCommand = 'npm run build';
        startCommand = 'npm run preview';
      } else if (deps.next) {
        framework = 'Next.js';
        devCommand = 'npm run dev';
        buildCommand = 'npm run build';
        startCommand = 'npm start';
      } else if (deps.vite) {
        framework = 'Vite';
        devCommand = 'npm run dev';
        buildCommand = 'npm run build';
        startCommand = 'npm run preview';
      } else if (deps.react || deps.vue || deps.svelte) {
        framework = 'SPA';
        devCommand = 'npm run dev';
        buildCommand = 'npm run build';
        startCommand = 'npm run preview';
      }
      
      // 检测需要的环境变量
      if (deps.openai) requiredEnvVars.push('OPENAI_API_KEY');
      if (deps['@supabase/supabase-js']) {
        requiredEnvVars.push('SUPABASE_URL');
        requiredEnvVars.push('SUPABASE_ANON_KEY');
      }
    }
    
    return {
      cloneCommand: `git clone https://github.com/${repo}.git`,
      installCommand: 'npm install',
      devCommand,
      buildCommand,
      startCommand,
      requiredEnvVars,
      detectedFramework: framework,
      ports: framework === 'Astro' ? [4321] : framework === 'Next.js' ? [3000] : [5173],
      riskWarnings: [],
      manualSteps: [
        '选择部署目录',
        '确认 clone',
        '配置环境变量',
        '确认 install',
        '确认 start',
      ],
      meta: {
        mode: 'local-rules',
        durationMs: Date.now() - startTime,
      },
    };
  });
  
  // 热门仓库（demo 数据）
  fastify.get('/trending', async () => {
    return {
      repos: [
        { name: 'mimo-tools', owner: 'falses00', stars: 10, description: '个人工程工具生态', language: 'TypeScript' },
        { name: 'astro', owner: 'withastro', stars: 45000, description: 'The web framework for content-driven websites', language: 'TypeScript' },
        { name: 'next.js', owner: 'vercel', stars: 120000, description: 'The React Framework', language: 'JavaScript' },
      ],
      meta: {
        mode: 'demo-data',
        durationMs: 0,
      },
    };
  });
}
