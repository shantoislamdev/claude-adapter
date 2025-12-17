#!/usr/bin/env node
// CLI entry point for claude-adapter
import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { AdapterConfig } from './types/config';
import {
    loadConfig,
    saveConfig,
    configExists,
    updateClaudeJson,
    updateClaudeSettings,
    getClaudePaths,
    getConfigDir
} from './utils/config';
import { createServer, findAvailablePort } from './server';

const program = new Command();

program
    .name('claude-adapter')
    .description('Proxy adapter to use OpenAI API with Claude Code')
    .version('1.0.0');

program
    .option('-p, --port <port>', 'Port to run the proxy server on', '3080')
    .option('-r, --reconfigure', 'Force reconfiguration even if config exists')
    .action(async (options) => {
        console.log(chalk.cyan.bold('\n🔌 Claude Adapter\n'));
        console.log(chalk.gray('Convert Anthropic API requests to OpenAI format for Claude Code\n'));

        try {
            // Step 1: Update ~/.claude.json for onboarding skip
            console.log(chalk.yellow('📝 Setting up Claude Code onboarding...'));
            updateClaudeJson();
            const paths = getClaudePaths();
            console.log(chalk.green(`   ✓ Updated ${paths.claudeJson}`));

            // Step 2: Load or create configuration
            let config = loadConfig();

            if (!config || options.reconfigure) {
                console.log(chalk.yellow('\n⚙️  Configuration required\n'));
                config = await promptForConfiguration();
                saveConfig(config);
                console.log(chalk.green(`\n   ✓ Configuration saved to ${getConfigDir()}/config.json`));
            } else {
                console.log(chalk.green(`\n✓ Using existing configuration from ${getConfigDir()}/config.json`));
                console.log(chalk.gray(`   Base URL: ${config.baseUrl}`));
                console.log(chalk.gray(`   Models: opus=${config.models.opus}, sonnet=${config.models.sonnet}, haiku=${config.models.haiku}`));
            }

            // Step 3: Find available port and start server
            const preferredPort = parseInt(options.port, 10) || 3080;
            const port = await findAvailablePort(preferredPort);

            console.log(chalk.yellow('\n🚀 Starting proxy server...'));

            const server = createServer(config);
            const proxyUrl = await server.start(port);

            console.log(chalk.green(`   ✓ Proxy server running at ${chalk.bold(proxyUrl)}`));

            // Step 4: Update Claude Code settings
            console.log(chalk.yellow('\n📁 Updating Claude Code settings...'));
            updateClaudeSettings(proxyUrl, config.models);
            console.log(chalk.green(`   ✓ Updated ${paths.claudeSettings}`));

            // Display final instructions
            console.log(chalk.cyan.bold('\n✅ Setup complete!\n'));
            console.log(chalk.white('Claude Code is now configured to use your OpenAI-compatible API.'));
            console.log(chalk.white('You can now start Claude Code and it will route through this proxy.\n'));
            console.log(chalk.gray('Press Ctrl+C to stop the proxy server.\n'));

            // Keep the process running
            process.on('SIGINT', () => {
                console.log(chalk.yellow('\n\n👋 Shutting down proxy server...'));
                server.stop();
                process.exit(0);
            });

        } catch (error) {
            console.error(chalk.red(`\n❌ Error: ${(error as Error).message}`));
            process.exit(1);
        }
    });

/**
 * Prompt user for configuration
 */
async function promptForConfiguration(): Promise<AdapterConfig> {
    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'baseUrl',
            message: 'Enter your OpenAI or OpenAI-compatible base URL:',
            default: 'https://api.openai.com/v1',
            validate: (input: string) => {
                try {
                    new URL(input);
                    return true;
                } catch {
                    return 'Please enter a valid URL';
                }
            },
        },
        {
            type: 'password',
            name: 'apiKey',
            message: 'Enter your API key:',
            mask: '*',
            validate: (input: string) => {
                if (!input || input.trim() === '') {
                    return 'API key is required';
                }
                return true;
            },
        },
        {
            type: 'input',
            name: 'opusModel',
            message: 'Write the model name that you want to replace the Opus model with:',
            validate: (input: string) => {
                if (!input || input.trim() === '') {
                    return 'Model name is required for Opus';
                }
                return true;
            },
        },
        {
            type: 'input',
            name: 'sonnetModel',
            message: 'Write the model name that you want to replace the Sonnet model with (Press Enter to skip):',
            default: '',
        },
        {
            type: 'input',
            name: 'haikuModel',
            message: 'Write the model name that you want to replace the Haiku model with (Press Enter to skip):',
            default: '',
        },
    ]);

    // Use opus model as fallback for unspecified models
    const opusModel = answers.opusModel.trim();
    const sonnetModel = answers.sonnetModel.trim() || opusModel;
    const haikuModel = answers.haikuModel.trim() || sonnetModel;

    return {
        baseUrl: answers.baseUrl.trim(),
        apiKey: answers.apiKey.trim(),
        models: {
            opus: opusModel,
            sonnet: sonnetModel,
            haiku: haikuModel,
        },
    };
}

// Run the CLI
program.parse();
