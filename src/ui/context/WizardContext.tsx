import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { PresetData, ModuleData, RoleData } from '../types';

// --- Types ---

export type WizardPath = 'manual' | 'ai';

export type Step =
  | 'onboarding'
  | 'name'
  | 'goal'
  | 'preset'
  | 'modules'
  | 'roles'
  | 'summary'
  | 'ai-wizard'
  | 'provision'
  | 'done';

export interface Goal {
  title: string;
  description: string;
  parentGoal?: string;
}

export interface WizardProject {
  name: string;
  description: string;
  goals: string[]; // goal titles this project is linked to
}

export interface CeoAdapter {
  type: string;
  cwd: string;
  model: string;
}

export interface ProvisionResult {
  companyId: string;
  issuePrefix?: string;
  paperclipUrl?: string;
  goalId?: string;
  agentIds: Record<string, string>;
  issueIds: string[];
}

export interface SkillAssignment {
  role: string;
  skills: string[];
  reason: string;
}

export interface ModelRoutingEntry {
  role: string;
  model: string;
  reason: string;
  monthlyCost?: string;
}

export interface TeamReviewEntry {
  role: string;
  reason: string;
  skills?: string[];
  model?: string;
}

export interface WizardState {
  step: Step;
  path: WizardPath | null;

  // User input
  companyName: string;
  goals: Goal[];
  projects: WizardProject[];
  ceoAdapter: CeoAdapter;
  existingCompanyId: string;
  presetName: string;
  selectedModules: string[];
  selectedRoles: string[];

  // AI wizard
  aiDescription: string;
  aiExplanation: string;
  companyDescription: string;
  aiLoading: boolean;
  agentSkillAssignments: SkillAssignment[];
  modelRouting: ModelRoutingEntry[];
  teamReview: TeamReviewEntry[];
  projectedCostEstimate: string;

  // Templates
  presets: PresetData[];
  modules: ModuleData[];
  roles: RoleData[];

  // File overrides: relative path → edited content (applied during provisioning)
  fileOverrides: Record<string, string>;

  // Results
  provisioning: boolean;
  provisionLog: string[];
  provisionResult: ProvisionResult | null;
  error: string | null;
}

// --- Actions ---

type Action =
  | { type: 'SET_PATH'; path: WizardPath }
  | { type: 'GO_TO'; step: Step }
  | { type: 'SET_COMPANY_NAME'; value: string }
  | { type: 'SET_GOALS'; goals: Goal[] }
  | { type: 'SET_PROJECTS'; projects: WizardProject[] }
  | { type: 'SET_CEO_ADAPTER'; adapter: Partial<CeoAdapter> }
  | { type: 'SET_EXISTING_COMPANY_ID'; value: string }
  | { type: 'SET_PRESET'; name: string }
  | { type: 'SET_MODULES'; modules: string[] }
  | { type: 'SET_ROLES'; roles: string[] }
  | { type: 'SET_AI_DESCRIPTION'; value: string }
  | { type: 'SET_AI_LOADING'; value: boolean }
  | { type: 'APPLY_AI_RESULT'; result: Partial<WizardState> }
  | { type: 'SET_AGENT_SKILL_ASSIGNMENTS'; assignments: SkillAssignment[] }
  | { type: 'SET_MODEL_ROUTING'; routing: ModelRoutingEntry[] }
  | { type: 'SET_TEAM_REVIEW'; review: TeamReviewEntry[] }
  | { type: 'SET_PROJECTED_COST_ESTIMATE'; estimate: string }
  | { type: 'SET_FILE_OVERRIDE'; path: string; content: string }
  | { type: 'DELETE_FILE_OVERRIDE'; path: string }
  | { type: 'CLEAR_FILE_OVERRIDES' }
  | { type: 'SET_PROVISIONING'; value: boolean }
  | { type: 'ADD_PROVISION_LOG'; line: string }
  | { type: 'SET_PROVISION_RESULT'; result: ProvisionResult }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'RESET' };

// --- Step flow ---

const MANUAL_STEPS: Step[] = [
  'onboarding',
  'name',
  'goal',
  'preset',
  'modules',
  'roles',
  'summary',
  'provision',
  'done',
];

const AI_STEPS: Step[] = ['onboarding', 'ai-wizard', 'provision', 'done'];

export function getStepIndex(state: WizardState): number {
  const steps = state.path === 'ai' ? AI_STEPS : MANUAL_STEPS;
  return steps.indexOf(state.step);
}

export function getTotalSteps(state: WizardState): number {
  const steps = state.path === 'ai' ? AI_STEPS : MANUAL_STEPS;
  return steps.filter((s) => s !== 'onboarding' && s !== 'provision' && s !== 'done').length;
}

export function getUserStepIndex(state: WizardState): number {
  const steps = state.path === 'ai' ? AI_STEPS : MANUAL_STEPS;
  const userSteps = steps.filter((s) => s !== 'onboarding' && s !== 'provision' && s !== 'done');
  return userSteps.indexOf(state.step as (typeof userSteps)[number]) + 1;
}

export function nextStep(state: WizardState): Step {
  const steps = state.path === 'ai' ? AI_STEPS : MANUAL_STEPS;
  const idx = steps.indexOf(state.step);
  return steps[Math.min(idx + 1, steps.length - 1)];
}

export function prevStep(state: WizardState): Step {
  const steps = state.path === 'ai' ? AI_STEPS : MANUAL_STEPS;
  const idx = steps.indexOf(state.step);
  return steps[Math.max(idx - 1, 0)];
}

// --- Derived state ---

export function getAllRoles(state: WizardState): string[] {
  const baseRoles = state.roles.filter((r) => r._base).map((r) => r.name);
  return [...new Set([...baseRoles, ...state.selectedRoles])];
}

const SOFTWARE_MODULES = new Set([
  'build-api',
  'ci-cd',
  'github-repo',
  'tech-stack',
  'codebase-onboarding',
  'security-audit',
]);
const MARKETING_MODULES = new Set(['market-analysis', 'brand-identity', 'launch-mvp', 'website-relaunch']);
const PRODUCTION_KEYWORDS = /(production|compliance|regulated|safety-critical|mission-critical|uptime|high availability|stability|reliable|operator|plant|factory)/i;
const SOFTWARE_KEYWORDS = /(software|app|application|webapp|website|mobile|platform|frontend|backend|repo|code|API|service|SaaS|product)/i;
const MARKETING_KEYWORDS = /(marketing|go-to-market|launch|growth|campaign|brand|awareness|demand|lead gen|sales)/i;

export function getTeamWarnings(state: WizardState): string[] {
  const warnings: string[] = [];
  const hasEngineer = state.selectedRoles.includes('engineer');
  const hasQa = state.selectedRoles.includes('qa');
  const hasCmo = state.selectedRoles.includes('cmo');
  const hasSecurity = state.selectedRoles.includes('security-engineer');
  const hasDocumentation = state.selectedModules.includes('documentation');
  const lowerDescription = state.companyDescription.toLowerCase() + ' ' + state.goals.map((g) => g.description).join(' ').toLowerCase();
  const mentionsSoftware = SOFTWARE_KEYWORDS.test(lowerDescription) || state.selectedModules.some((m) => SOFTWARE_MODULES.has(m));
  const mentionsProduction = PRODUCTION_KEYWORDS.test(lowerDescription) || state.selectedModules.includes('monitoring');
  const mentionsMarketing = MARKETING_KEYWORDS.test(lowerDescription) || state.selectedModules.some((m) => MARKETING_MODULES.has(m));

  if (mentionsSoftware && !hasEngineer) {
    warnings.push(
      'This looks like software product work, but no engineer is included. Add the engineer role so someone can implement code, repos, and integrations.',
    );
  }

  if (mentionsProduction && !hasQa) {
    warnings.push(
      'The project has a production or compliance focus, but no QA agent is assigned. Add QA to protect quality, catch regressions, and validate releases.',
    );
  }

  if (hasCmo && !mentionsMarketing) {
    warnings.push(
      'A CMO is assigned, but the current goals or modules do not emphasize marketing, launch, or growth. Add a marketing goal or include market-oriented modules.',
    );
  }

  if (hasSecurity && !state.selectedModules.includes('security-audit')) {
    warnings.push(
      'A security engineer is on the team, but the security-audit module is not active. Enable it to give them a concrete security workflow.',
    );
  }

  if (!hasDocumentation && state.selectedRoles.includes('technical-writer')) {
    warnings.push(
      'A technical writer is included, but the documentation module is not selected. Enable documentation so they have a clear deliverable stream.',
    );
  }

  return warnings;
}

export function getActiveModules(state: WizardState): ModuleData[] {
  const allRoles = new Set(getAllRoles(state));
  return state.modules.filter((m) => {
    if (!state.selectedModules.includes(m.name)) return false;
    if (m.activatesWithRoles?.length) {
      return m.activatesWithRoles.some((r) => allRoles.has(r));
    }
    return true;
  });
}

// --- Reducer ---

const initialState: WizardState = {
  step: 'onboarding',
  path: null,
  companyName: '',
  goals: [],
  projects: [],
  ceoAdapter: { type: 'claude_local', cwd: '', model: '' },
  existingCompanyId: '',
  presetName: '',
  selectedModules: [],
  selectedRoles: [],
  aiDescription: '',
  aiExplanation: '',
  companyDescription: '',
  aiLoading: false,
  agentSkillAssignments: [],
  modelRouting: [],
  teamReview: [],
  projectedCostEstimate: '',
  presets: [],
  modules: [],
  roles: [],
  fileOverrides: {},
  provisioning: false,
  provisionLog: [],
  provisionResult: null,
  error: null,
};

function reducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case 'SET_PATH':
      return {
        ...state,
        path: action.path,
        step: action.path === 'ai' ? 'ai-wizard' : 'name',
      };
    case 'GO_TO':
      return { ...state, step: action.step, error: null };
    case 'SET_COMPANY_NAME':
      return { ...state, companyName: action.value };
    case 'SET_GOALS':
      return { ...state, goals: action.goals };
    case 'SET_PROJECTS':
      return { ...state, projects: action.projects };
    case 'SET_CEO_ADAPTER':
      return { ...state, ceoAdapter: { ...state.ceoAdapter, ...action.adapter } };
    case 'SET_EXISTING_COMPANY_ID':
      return { ...state, existingCompanyId: action.value };
    case 'SET_PRESET': {
      const preset = state.presets.find((p) => p.name === action.name);
      return {
        ...state,
        presetName: action.name,
        selectedModules: preset?.modules ?? [],
        selectedRoles: preset?.roles ?? [],
        fileOverrides: {},
      };
    }
    case 'SET_MODULES':
      return { ...state, selectedModules: action.modules, fileOverrides: {} };
    case 'SET_ROLES':
      return { ...state, selectedRoles: action.roles, fileOverrides: {} };
    case 'SET_AI_DESCRIPTION':
      return { ...state, aiDescription: action.value };
    case 'SET_AI_LOADING':
      return { ...state, aiLoading: action.value };
    case 'SET_AGENT_SKILL_ASSIGNMENTS':
      return { ...state, agentSkillAssignments: action.assignments };
    case 'SET_MODEL_ROUTING':
      return { ...state, modelRouting: action.routing };
    case 'SET_TEAM_REVIEW':
      return { ...state, teamReview: action.review };
    case 'SET_PROJECTED_COST_ESTIMATE':
      return { ...state, projectedCostEstimate: action.estimate };
    case 'APPLY_AI_RESULT':
      return { ...state, ...action.result };
    case 'SET_FILE_OVERRIDE':
      return { ...state, fileOverrides: { ...state.fileOverrides, [action.path]: action.content } };
    case 'DELETE_FILE_OVERRIDE': {
      const next = { ...state.fileOverrides };
      delete next[action.path];
      return { ...state, fileOverrides: next };
    }
    case 'CLEAR_FILE_OVERRIDES':
      return { ...state, fileOverrides: {} };
    case 'SET_PROVISIONING':
      return {
        ...state,
        provisioning: action.value,
        provisionLog: action.value ? [] : state.provisionLog,
      };
    case 'ADD_PROVISION_LOG':
      return {
        ...state,
        provisionLog: [...state.provisionLog, action.line],
      };
    case 'SET_PROVISION_RESULT':
      return {
        ...state,
        provisionResult: action.result,
        provisioning: false,
      };
    case 'SET_ERROR':
      return { ...state, error: action.error, provisioning: false };
    case 'RESET':
      return {
        ...initialState,
        presets: state.presets,
        modules: state.modules,
        roles: state.roles,
      };
    default:
      return state;
  }
}

// --- Context ---

const WizardContext = createContext<WizardState>(initialState);
const WizardDispatchContext = createContext<(action: Action) => void>(() => {});

export function WizardProvider({
  children,
  templates,
}: {
  children: ReactNode;
  templates: { presets: PresetData[]; modules: ModuleData[]; roles: RoleData[] };
}) {
  const [state, setState] = useState<WizardState>({
    ...initialState,
    ...templates,
  });
  const dispatch = useCallback((action: Action) => setState((prev) => reducer(prev, action)), []);

  return (
    <WizardContext.Provider value={state}>
      <WizardDispatchContext.Provider value={dispatch}>{children}</WizardDispatchContext.Provider>
    </WizardContext.Provider>
  );
}

export function useWizard() {
  return useContext(WizardContext);
}

export function useWizardDispatch() {
  return useContext(WizardDispatchContext);
}
