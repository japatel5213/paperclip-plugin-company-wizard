import type { PaperclipPluginManifestV1 } from '@paperclipai/plugin-sdk';

const manifest: PaperclipPluginManifestV1 = {
  id: 'yesterday-ai.paperclip-plugin-company-wizard',
  apiVersion: 1,
  version: '0.3.0',
  displayName: 'Company Wizard',
  description: 'AI-powered wizard to bootstrap agent companies from composable templates',
  author: 'Jay',
  categories: ['workspace', 'ui'],
  capabilities: [
    'companies.read',
    'issues.create',
    'issues.read',
    'issues.update',
    'goals.create',
    'goals.read',
    'agents.read',
    'projects.read',
    'plugin.state.read',
    'plugin.state.write',
    'events.subscribe',
    'ui.page.register',
    'ui.sidebar.register',
  ],
  instanceConfigSchema: {
    type: 'object',
    properties: {
      companiesDir: {
        type: 'string',
        description:
          'Directory where assembled company workspaces are written. Defaults to ~/.paperclip/instances/default/companies. Override for Docker setups (e.g. /paperclip/instances/default/companies).',
      },
      templatesPath: {
        type: 'string',
        description:
          'Path to the templates directory. Defaults to ~/.paperclip/plugin-templates (auto-downloaded from templatesRepoUrl if missing). Override for Docker setups (e.g. /paperclip/plugin-templates).',
      },
      templatesRepoUrl: {
        type: 'string',
        default:
          'https://github.com/Yesterday-AI/paperclip-plugin-company-wizard/tree/main/templates',
        description:
          'GitHub tree URL to pull templates from when the templates directory does not exist.',
      },
      aiProvider: {
        type: 'string',
        enum: ['anthropic', 'gemini', 'openai', 'opencode'],
        default: 'anthropic',
        description:
          'AI provider for the wizard interview. Options: anthropic (Claude), gemini (Google Gemini), openai (OpenAI/OpenRouter), opencode (a self-hosted `opencode serve` instance). Default: anthropic.',
      },
      anthropicApiKey: {
        anyOf: [
          { type: 'string' },
          { type: 'string', format: 'secret-ref' }
        ],
        description:
          'Anthropic API key. Required when aiProvider is "anthropic" (default). Get one at console.anthropic.com.',
      },
      geminiApiKey: {
        anyOf: [
          { type: 'string' },
          { type: 'string', format: 'secret-ref' }
        ],
        description:
          'Google Gemini API key. Required when aiProvider is "gemini". Get one at aistudio.google.com.',
      },
      openaiApiKey: {
        anyOf: [
          { type: 'string' },
          { type: 'string', format: 'secret-ref' }
        ],
        description:
          'OpenAI or OpenRouter API key. Required when aiProvider is "openai". For OpenRouter, also set openaiBaseUrl.',
      },
      openaiBaseUrl: {
        type: 'string',
        default: 'https://api.openai.com/v1',
        description:
          'Base URL for OpenAI-compatible API. Default: https://api.openai.com/v1. For OpenRouter use https://openrouter.ai/api/v1.',
      },
      geminiModel: {
        type: 'string',
        description:
          'Gemini model to use. Default: gemini-2.0-flash. Options: gemini-2.0-flash, gemini-2.0-flash-lite, gemini-1.5-pro.',
      },
      openaiModel: {
        type: 'string',
        description:
          'OpenAI/OpenRouter model to use. Default: gpt-4o-mini. For OpenRouter use format: google/gemini-2.0-flash-exp:free',
      },
      opencodeBaseUrl: {
        type: 'string',
        default: 'http://localhost:4096',
        description:
          'Base URL of your OpenCode server (`opencode serve`). Default: http://localhost:4096. For a remote server use http://<host>:4096.',
      },
      opencodeModel: {
        type: 'string',
        description:
          'OpenCode model id in provider/model form (e.g. anthropic/claude-sonnet-4, google/gemini-2.0-flash, or a local provider/model). Required when aiProvider is "opencode".',
      },
      opencodeUsername: {
        type: 'string',
        description:
          'Basic-auth username for the OpenCode server (only if OPENCODE_SERVER_PASSWORD is set). Defaults to "opencode".',
      },
      opencodePassword: {
        anyOf: [
          { type: 'string' },
          { type: 'string', format: 'secret-ref' }
        ],
        description:
          'Basic-auth password for the OpenCode server (matches OPENCODE_SERVER_PASSWORD). Leave empty for an unauthenticated local server.',
      },
      paperclipUrl: {
        type: 'string',
        description:
          'Paperclip instance URL. Defaults to http://localhost:3100 or the PAPERCLIP_PUBLIC_URL env var.',
      },
      paperclipEmail: {
        type: 'string',
        description: 'Board login email (for authenticated instances).',
      },
      paperclipPassword: {
        anyOf: [
          { type: 'string' },
          { type: 'string', format: 'secret-ref' }
        ],
        description: 'Board login password.',
      },
      disableBoardApprovalOnNewCompanies: {
        type: 'boolean',
        default: false,
        description:
          'Optional. If true, the wizard will PATCH new companies to set requireBoardApprovalForNewAgents=false during provisioning. Leave false to preserve approval-gated hiring policies.',
      },
    },
  },
  entrypoints: {
    worker: './dist/worker.js',
    ui: './dist/ui',
  },
  ui: {
    slots: [
      {
        type: 'page',
        id: 'company-wizard',
        displayName: 'Company Wizard',
        exportName: 'WizardPage',
        routePath: 'company-creator',
      },
      {
        type: 'sidebar',
        id: 'company-wizard-link',
        displayName: 'Create Company',
        exportName: 'SidebarLink',
      },
    ],
  },
};

export default manifest;
