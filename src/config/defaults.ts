import { type Config } from './schema';

export const DEFAULT_POLICIES: Config = {
  policies: [
    {
      category: "Security & Admin",
      patterns: [
        {
          type: "glob",
          value: "**/admin/**",
          reason: "Administrative interfaces should not be publicly indexed."
        },
        {
          type: "glob",
          value: "**/.env*",
          reason: "Environment files contain sensitive secrets."
        },
        {
          type: "literal",
          value: "/wp-admin",
          reason: "WordPress admin paths are common attack vectors."
        }
      ]
    },
    {
      category: "Environment Leakage",
      patterns: [
        {
          type: "glob",
          value: "**/staging.**",
          reason: "Staging environments should be restricted."
        },
        {
          type: "glob",
          value: "**/dev.**",
          reason: "Development subdomains detected in production sitemap."
        }
      ]
    },
    {
      category: "Sensitive Files",
      patterns: [
        {
          type: "glob",
          value: "**/*.{sql,bak,zip,tar.gz}",
          reason: "Archive or database backup files exposed."
        }
      ]
    }
  ]
};
