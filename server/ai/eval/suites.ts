/**
 * 蓉才通™ ATOS — Pre-built Evaluation Suites
 * 
 * 覆盖所有核心 Agent 的评估用例集：
 * - Interview Agent Suite
 * - Resume Agent Suite
 * - PeopleGPT Agent Suite
 * - Candidate Copilot Suite
 * - Memory System Suite
 */

import type { EvalSuite } from './types';

// ─── Interview Agent Eval Suite ──────────────────────────────────────────────

export const interviewEvalSuite: EvalSuite = {
  id: 'suite_interview_v1',
  name: 'Interview Agent Evaluation',
  description: 'Evaluates STAR detection, competency scoring, and follow-up generation quality',
  agentName: 'interview-pipeline',
  version: '1.0.0',
  metrics: ['accuracy', 'faithfulness', 'relevance', 'completeness', 'coherence'],
  thresholds: {
    accuracy: 0.75,
    faithfulness: 0.85,
    relevance: 0.80,
    completeness: 0.70,
    coherence: 0.80,
    toxicity: 0.95,
    latency: 0.5,
    cost: 0.5,
    consistency: 0.7,
    hallucination: 0.85,
    custom: 0.5,
  },
  cases: [
    {
      id: 'int_star_01',
      name: 'STAR Detection - Complete Answer',
      input: {
        query: 'Detect STAR structure in this candidate response',
        context: `Question: Tell me about a time you led a difficult project.
Answer: When I was at Alibaba (Situation), we needed to migrate 200 microservices to Kubernetes within 3 months (Task). I created a phased migration plan, set up CI/CD pipelines, and trained 15 engineers on container orchestration (Action). We completed the migration 2 weeks early with zero downtime, reducing infrastructure costs by 40% (Result).`,
      },
      expectedOutput: {
        contains: ['Situation', 'Task', 'Action', 'Result'],
        factualClaims: ['Alibaba', 'Kubernetes', '200 microservices', '3 months', '15 engineers', '40%'],
      },
      tags: ['star', 'behavioral'],
      weight: 1.0,
    },
    {
      id: 'int_star_02',
      name: 'STAR Detection - Incomplete Answer',
      input: {
        query: 'Detect STAR structure in this candidate response',
        context: `Question: Describe a conflict with a colleague.
Answer: I had a disagreement with my product manager about feature priorities. We eventually worked it out by having more frequent sync meetings.`,
      },
      expectedOutput: {
        contains: ['incomplete', 'missing'],
        notContains: ['complete STAR'],
      },
      tags: ['star', 'incomplete'],
      weight: 0.8,
    },
    {
      id: 'int_comp_01',
      name: 'Competency Scoring - Leadership',
      input: {
        query: 'Score this response on leadership competency (1-5)',
        context: `The candidate described leading a cross-functional team of 20 people through a company restructuring. They established clear communication channels, held weekly all-hands, addressed concerns individually, and achieved 95% team retention during the transition.`,
      },
      expectedOutput: {
        contains: ['4', '5'],
        notContains: ['1', '2'],
      },
      tags: ['competency', 'leadership'],
      weight: 1.0,
    },
    {
      id: 'int_followup_01',
      name: 'Follow-up Question Generation',
      input: {
        query: 'Generate a follow-up question based on this response',
        context: `Candidate said: "I improved team velocity by 30% by implementing agile practices."
Current competency being assessed: Technical Leadership
Depth needed: Probe for specific actions and challenges.`,
      },
      expectedOutput: {
        notContains: ['yes or no', 'tell me more'],
      },
      tags: ['followup', 'probing'],
      weight: 0.9,
    },
    {
      id: 'int_summary_01',
      name: 'Interview Summary Generation',
      input: {
        query: 'Generate interview summary report',
        context: `Session: 45 minutes, 6 questions asked.
Competency scores: Leadership 4.2, Communication 3.8, Technical 4.5, Problem-solving 4.0, Teamwork 3.5.
Key observations: Strong technical depth, clear communication, some gaps in cross-functional collaboration examples.
STAR completeness: 4/6 responses had complete STAR structure.`,
      },
      expectedOutput: {
        contains: ['recommendation', 'strength', 'development'],
        factualClaims: ['Leadership', 'Communication', 'Technical'],
      },
      tags: ['summary', 'report'],
      weight: 1.0,
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  metadata: { domain: 'interview', priority: 'P0' },
};

// ─── Resume Agent Eval Suite ─────────────────────────────────────────────────

export const resumeEvalSuite: EvalSuite = {
  id: 'suite_resume_v1',
  name: 'Resume Intelligence Evaluation',
  description: 'Evaluates resume parsing, skill extraction, risk detection, and JD matching',
  agentName: 'resume-pipeline',
  version: '1.0.0',
  metrics: ['accuracy', 'faithfulness', 'completeness', 'hallucination'],
  thresholds: {
    accuracy: 0.80,
    faithfulness: 0.90,
    completeness: 0.75,
    hallucination: 0.90,
    relevance: 0.7,
    toxicity: 0.95,
    latency: 0.5,
    cost: 0.5,
    consistency: 0.7,
    coherence: 0.7,
    custom: 0.5,
  },
  cases: [
    {
      id: 'res_parse_01',
      name: 'Resume Parsing - Standard Format',
      input: {
        query: 'Parse this resume and extract structured data',
        context: `张三 | Senior Software Engineer | 8 years experience
Education: Tsinghua University, CS, 2016
Experience:
- ByteDance (2020-present): Tech Lead, led 12-person team, built recommendation system serving 100M DAU
- Alibaba (2017-2020): Senior Engineer, microservices architecture, Go/Java
Skills: Go, Java, Python, Kubernetes, distributed systems, machine learning
Certifications: AWS Solutions Architect, CKA`,
      },
      expectedOutput: {
        contains: ['张三', 'ByteDance', 'Alibaba', 'Tsinghua', 'Go', 'Kubernetes'],
        factualClaims: ['8 years', '12-person team', '100M DAU'],
      },
      tags: ['parsing', 'extraction'],
      weight: 1.0,
    },
    {
      id: 'res_risk_01',
      name: 'Risk Detection - Job Hopping',
      input: {
        query: 'Detect risk signals in this resume',
        context: `Work history:
- Company A: 6 months (2023)
- Company B: 8 months (2022-2023)
- Company C: 4 months (2022)
- Company D: 7 months (2021-2022)
- Company E: 5 months (2021)`,
      },
      expectedOutput: {
        contains: ['risk', 'tenure', 'short'],
      },
      tags: ['risk', 'job-hopping'],
      weight: 0.9,
    },
    {
      id: 'res_match_01',
      name: 'JD-Resume Matching',
      input: {
        query: 'Calculate match score between this JD and resume',
        context: `JD: Senior Backend Engineer, requires 5+ years Go experience, distributed systems, Kubernetes, team leadership.
Resume: 8 years experience, Go expert, led distributed systems team at ByteDance, CKA certified.`,
      },
      expectedOutput: {
        contains: ['match', 'score'],
      },
      tags: ['matching', 'scoring'],
      weight: 1.0,
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  metadata: { domain: 'resume', priority: 'P1' },
};

// ─── PeopleGPT Eval Suite ────────────────────────────────────────────────────

export const peopleGPTEvalSuite: EvalSuite = {
  id: 'suite_people_v1',
  name: 'PeopleGPT Search Evaluation',
  description: 'Evaluates natural language search, ranking, and outreach generation',
  agentName: 'people-pipeline',
  version: '1.0.0',
  metrics: ['relevance', 'accuracy', 'completeness', 'coherence'],
  thresholds: {
    relevance: 0.80,
    accuracy: 0.75,
    completeness: 0.70,
    coherence: 0.80,
    faithfulness: 0.7,
    toxicity: 0.95,
    latency: 0.5,
    cost: 0.5,
    consistency: 0.7,
    hallucination: 0.8,
    custom: 0.5,
  },
  cases: [
    {
      id: 'ppl_search_01',
      name: 'NL Search - Technical Role',
      input: {
        query: '帮我找一个有5年以上Go经验、做过分布式系统、在大厂工作过的后端工程师，最好在成都',
      },
      expectedOutput: {
        contains: ['Go', '分布式', '后端'],
      },
      tags: ['search', 'technical'],
      weight: 1.0,
    },
    {
      id: 'ppl_outreach_01',
      name: 'Cold Email Generation',
      input: {
        query: 'Generate a cold outreach email for this candidate',
        context: `Candidate: Senior ML Engineer at Google, 6 years experience, published papers on NLP.
Position: Head of AI at a Series B startup, competitive compensation, equity.
Tone: Professional but warm, highlight growth opportunity.`,
      },
      expectedOutput: {
        contains: ['subject', 'personalized'],
        notContains: ['Dear Sir/Madam', 'To Whom It May Concern'],
      },
      tags: ['outreach', 'email'],
      weight: 0.8,
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  metadata: { domain: 'people-search', priority: 'P2' },
};

// ─── Memory System Eval Suite ────────────────────────────────────────────────

export const memoryEvalSuite: EvalSuite = {
  id: 'suite_memory_v1',
  name: 'Memory OS Evaluation',
  description: 'Evaluates memory retrieval accuracy, summarization quality, and reflection depth',
  agentName: 'memory-system',
  version: '1.0.0',
  metrics: ['accuracy', 'relevance', 'faithfulness', 'completeness'],
  thresholds: {
    accuracy: 0.80,
    relevance: 0.85,
    faithfulness: 0.90,
    completeness: 0.75,
    toxicity: 0.95,
    latency: 0.5,
    cost: 0.5,
    consistency: 0.8,
    hallucination: 0.9,
    coherence: 0.7,
    custom: 0.5,
  },
  cases: [
    {
      id: 'mem_retrieval_01',
      name: 'Memory Retrieval - Relevant Context',
      input: {
        query: 'What are this candidate\'s leadership experiences?',
        context: `Stored memories:
- "Led 20-person engineering team at ByteDance for 2 years"
- "Organized company hackathon with 200 participants"
- "Prefers Python over Java"
- "Has a dog named Max"
- "Mentored 5 junior engineers who all got promoted"`,
      },
      expectedOutput: {
        contains: ['led', 'team', 'mentor'],
        notContains: ['dog', 'Max', 'Python'],
      },
      tags: ['retrieval', 'relevance'],
      weight: 1.0,
    },
    {
      id: 'mem_summary_01',
      name: 'Memory Summarization',
      input: {
        query: 'Summarize these memories into a candidate profile',
        context: `Memories:
- "5 years at Alibaba as backend engineer"
- "Promoted twice in 3 years"
- "Expert in distributed systems"
- "Led migration from monolith to microservices"
- "Speaks Mandarin and English fluently"
- "Prefers remote work"
- "Strong at system design interviews"`,
      },
      expectedOutput: {
        contains: ['Alibaba', 'distributed', 'promoted'],
      },
      tags: ['summarization', 'profile'],
      weight: 0.9,
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  metadata: { domain: 'memory', priority: 'P0' },
};

// ─── All Suites ──────────────────────────────────────────────────────────────

export const allEvalSuites: EvalSuite[] = [
  interviewEvalSuite,
  resumeEvalSuite,
  peopleGPTEvalSuite,
  memoryEvalSuite,
];

export function getEvalSuite(id: string): EvalSuite | undefined {
  return allEvalSuites.find(s => s.id === id);
}

export function getEvalSuiteByAgent(agentName: string): EvalSuite | undefined {
  return allEvalSuites.find(s => s.agentName === agentName);
}
