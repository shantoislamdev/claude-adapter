#!/usr/bin/env node
// CLI entry point for claude-adapter
import { Command } from 'commander';
import inquirer from 'inquirer';
import { AdapterConfig } from './types/config';
import {
    loadConfig,
    saveConfig,
    updateClaudeJson,
    updateClaudeSettings
} from './utils/config';
import { createServer, findAvailablePort } from './server';
import { UI } from './utils/ui';

const program = new Command();

program
    .name('claude-adapter')
    .description('Proxy adapter to use OpenAI API with Claude Code')
    .version('1.0.0');

program
    .option('-p, --port <port>', 'Port to run the proxy server on', '3080')
    .option('-r, --reconfigure', 'Force reconfiguration even if config exists')
    .action(async (options) => {
        UI.banner();
        UI.header('Convert Anthropic API requests to OpenAI format for Claude Code');

        try {
            // Step 1: Update ~/.claude.json for onboarding skip
            UI.startSpinner('Setting up Claude Code onboarding...');
            updateClaudeJson();
            UI.stopSpinner(true, 'Claude onboarding configured');

            // Step 2: Load or create configuration
            let config = loadConfig();

            if (!config || options.reconfigure) {
                UI.log(''); // Spacing
                UI.warning('Configuration required');
                config = await promptForConfiguration();
                saveConfig(config);
                UI.success('Configuration saved');
            } else {
                UI.info('Using existing configuration');
            }

            // Step 3: Find available port and start server
            const preferredPort = parseInt(options.port, 10) || 3080;
            const port = await findAvailablePort(preferredPort);

            UI.startSpinner('Starting proxy server...');
            const server = createServer(config);
            const proxyUrl = await server.start(port);
            UI.stopSpinner(true, `Proxy server running at ${UI.newUrl(proxyUrl)}`);

            // Step 4: Update Claude Code settings
            UI.startSpinner('Updating Claude Code settings...');
            updateClaudeSettings(proxyUrl, config.models);
            UI.stopSpinner(true, 'Claude Code settings updated');

            // Display configured models
            UI.table([
                { label: 'Opus', value: config.models.opus },
                { label: 'Sonnet', value: config.models.sonnet },
                { label: 'Haiku', value: config.models.haiku }
            ]);

            // Display final instructions
            UI.box('Setup Complete!', [
                'Claude Code is now configured to use your OpenAI-compatible API.',
                'You can now start Claude Code and it will route through this proxy.',
                '',
                'Press Ctrl+C to stop the proxy server.'
            ]);

            // Keep the process running
            process.on('SIGINT', async () => {
                UI.log('');
                UI.warning('Shutting down proxy server...');
                await server.stop();
                process.exit(0);
            });

        } catch (error) {
            UI.stopSpinner(false, 'An error occurred');
            UI.error('Setup failed', error as Error);
            process.exit(1);
        }
    });

/**
 * Prompt user for configuration
 */
async function promptForConfiguration(): Promise<AdapterConfig> {
    const prefix = UI.dim('?');
    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'baseUrl',
            prefix,
            message: 'Enter your OpenAI or OpenAI-compatible base URL:',
            default: 'https://api.openai.com/v1',
            transformer: (input: string) => UI.highlight(input),
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
            prefix,
            message: 'Enter your API key:',
            mask: '*',
            transformer: (input: string) => UI.highlight('*'.repeat(input.length)),
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
            prefix,
            message: 'Write the model name that you want to replace the Opus model with:',
            transformer: (input: string) => UI.highlight(input),
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
            prefix,
            message: 'Write the model name that you want to replace the Sonnet model with (Press Enter to skip):',
            default: '',
            transformer: (input: string) => UI.highlight(input),
        },
        {
            type: 'input',
            name: 'haikuModel',
            prefix,
            message: 'Write the model name that you want to replace the Haiku model with (Press Enter to skip):',
            default: '',
            transformer: (input: string) => UI.highlight(input),
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
