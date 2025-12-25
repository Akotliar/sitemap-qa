import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { ConfigSchema, type Config } from './schema';
import { DEFAULT_POLICIES } from './defaults';
import chalk from 'chalk';

export class ConfigLoader {
  private static readonly DEFAULT_CONFIG_PATH = 'sitemap-qa.yaml';

  static load(configPath?: string): Config {
    const targetPath = configPath || path.join(process.cwd(), this.DEFAULT_CONFIG_PATH);
    let userConfig: Config = { policies: [] };

    // Load YAML config
    if (fs.existsSync(targetPath)) {
      try {
        const fileContent = fs.readFileSync(targetPath, 'utf8');
        const parsedYaml = yaml.load(fileContent);
        
        const result = ConfigSchema.safeParse(parsedYaml);
        
        if (!result.success) {
          console.error(chalk.red('Configuration Validation Error:'));
          result.error.issues.forEach((issue) => {
            console.error(chalk.yellow(`  - ${issue.path.join('.')}: ${issue.message}`));
          });
          process.exit(2);
        }

        userConfig = result.data;
      } catch (error) {
        console.error(chalk.red('Failed to load configuration:'), error);
        process.exit(2);
      }
    } else if (configPath) {
      console.error(chalk.red(`Error: Configuration file not found at ${targetPath}`));
      process.exit(2);
    }

    return this.mergeConfigs(DEFAULT_POLICIES, userConfig);
  }

  private static mergeConfigs(defaults: Config, user: Config): Config {
    const mergedPolicies = [...defaults.policies];

    user.policies.forEach((userPolicy) => {
      const index = mergedPolicies.findIndex(p => p.category === userPolicy.category);
      if (index !== -1) {
        // Replace default category with user category (precedence)
        mergedPolicies[index] = userPolicy;
      } else {
        // Add new user category
        mergedPolicies.push(userPolicy);
      }
    });

    return { 
      policies: mergedPolicies,
      outDir: user.outDir || defaults.outDir
    };
  }
}
