import { RiskPattern } from '@/core/risk-detector';

export const ADMIN_PATH_PATTERNS: RiskPattern[] = [
  {
    name: 'Admin Path',
    category: 'admin_paths',
    severity: 'high',
    regex: /\/(admin|administrator)(?:\/|$|\?)/i,
    description: 'URL contains /admin or /administrator as a path segment'
  },
  {
    name: 'Dashboard Path',
    category: 'admin_paths',
    severity: 'high',
    regex: /\/dashboard(?:\/|$|\?)/i,
    description: 'URL contains /dashboard as a path segment'
  },
  {
    name: 'Config Path',
    category: 'admin_paths',
    severity: 'high',
    regex: /\/(config|configuration)(?:\/|$|\?)/i,
    description: 'URL contains /config or /configuration as a path segment'
  },
  {
    name: 'Console Path',
    category: 'admin_paths',
    severity: 'high',
    regex: /\/console(?:\/|$|\?)/i,
    description: 'URL contains /console as a path segment'
  },
  {
    name: 'Control Panel Path',
    category: 'admin_paths',
    severity: 'high',
    regex: /\/(cpanel|control-panel)(?:\/|$|\?)/i,
    description: 'URL contains control panel as a path segment'
  }
];

// Internal content patterns - lower severity as these may be legitimate public-facing content
// that happens to use "internal" in the naming (e.g., internal ticket requests, internal forms)
export const INTERNAL_CONTENT_PATTERNS: RiskPattern[] = [
  {
    name: 'Internal Content Path',
    category: 'internal_content',
    severity: 'medium',
    regex: /\/internal\b/i,
    description: 'URL contains /internal path segment - may be internal-only content not intended for public indexing'
  }
];

export const SENSITIVE_PARAM_PATTERNS: RiskPattern[] = [
  {
    name: 'Authentication Token Parameter',
    category: 'sensitive_params',
    severity: 'high',
    regex: /[?&](token|auth_token|access_token|api_token)=/i,
    description: 'Query parameter may contain authentication token'
  },
  {
    name: 'API Key Parameter',
    category: 'sensitive_params',
    severity: 'high',
    regex: /[?&](apikey|api_key|key)=/i,
    description: 'Query parameter may contain API key'
  },
  {
    name: 'Password Parameter',
    category: 'sensitive_params',
    severity: 'high',
    regex: /[?&](password|passwd|pwd)=/i,
    description: 'Query parameter may contain password'
  },
  {
    name: 'Secret Parameter',
    category: 'sensitive_params',
    severity: 'high',
    regex: /[?&](secret|client_secret)=/i,
    description: 'Query parameter may contain secret value'
  },
  {
    name: 'Session Parameter',
    category: 'sensitive_params',
    severity: 'high',
    regex: /[?&](session|sessionid|sid)=/i,
    description: 'Query parameter may contain session identifier'
  },
  {
    name: 'Credentials Parameter',
    category: 'sensitive_params',
    severity: 'high',
    regex: /[?&]credentials=/i,
    description: 'Query parameter may contain credentials'
  },
  {
    name: 'Debug Parameter',
    category: 'sensitive_params',
    severity: 'medium',
    regex: /[?&](debug|trace|verbose)=/i,
    description: 'Query parameter contains debug or diagnostic flag'
  },
  {
    name: 'Test Mode Parameter',
    category: 'sensitive_params',
    severity: 'medium',
    regex: /[?&](test_mode|test|testing)=/i,
    description: 'Query parameter indicates test mode'
  }
];
