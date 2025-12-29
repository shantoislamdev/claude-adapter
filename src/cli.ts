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
import { checkForUpdates } from './utils/update';
import { getMetadata } from './utils/metadata';
import { version } from '../package.json';

const program = new Command();

program
    .name('claude-adapter')
    .description('Proxy adapter to use OpenAI API with Claude Code')
    .version(version);

program
    .option('-p, --port <port>', 'Port to run the proxy server on', '3080')
    .option('-r, --reconfigure', 'Force reconfiguration even if config exists')
    .action(async (options) => {
        UI.banner();
        UI.header('Adapt any model for Claude Code');

        try {
            // Initialize metadata (creates metadata.json on first run)
            getMetadata();

            // Step 1: Update ~/.claude.json for onboarding skip
            updateClaudeJson();
            UI.statusDone(true, 'Initialized Claude Adapter');

            // Step 2: Load or create configuration
            let config = loadConfig();

            if (!config || options.reconfigure) {
                UI.log(''); // Spacing
                config = await promptForConfiguration();
                saveConfig(config);
                UI.info('Creating Claude Adapter API...');
            } else if (config.toolFormat === undefined) {
                // Existing config missing toolFormat - prompt only for that
                UI.log(''); // Spacing
                const toolStyle = await promptForToolCallingStyle();
                config.toolFormat = toolStyle;
                saveConfig(config);
                UI.info('Tool calling preference saved');
            } else {
                UI.info('Using existing configuration');
            }

            // Step 3: Find available port and start server
            const preferredPort = parseInt(options.port, 10) || 3080;
            const port = await findAvailablePort(preferredPort);

            const server = createServer(config);
            const proxyUrl = await server.start(port);
            UI.statusDone(true, `Claude Adapter running at ${UI.newUrl(proxyUrl)}`);

            // Step 4: Update Claude Code settings
            updateClaudeSettings(proxyUrl, config.models);
            UI.statusDone(true, 'Models configured:');

            // Display configured models
            UI.table([
                { label: 'Opus', value: config.models.opus },
                { label: 'Sonnet', value: config.models.sonnet },
                { label: 'Haiku', value: config.models.haiku }
            ]);

            UI.success('Claude Adapter is ready!');
            UI.info('Open a new terminal tab and run Claude Code.');
            UI.hint('Press Ctrl+C to stop the proxy server.');

            // Non-blocking update check
            checkForUpdates().then(update => {
                if (update?.hasUpdate) {
                    UI.updateNotify(update.current, update.latest);
                }
                UI.log('');
            });

            // Keep the process running
            process.on('SIGINT', async () => {
                UI.log('');
                await server.stop();
                UI.success('Claude Adapter stopped');
                process.exit(0);
            });

        } catch (error) {
            UI.statusDone(false, 'An error occurred');
            UI.error('Setup failed', error as Error);
            process.exit(1);
        }
    });

/**
 * Prompt user for configuration
 */
async function promptForConfiguration(): Promise<AdapterConfig> {
    const prefix = UI.dim('?');

    // Required configuration prompts
    const requiredAnswers = await inquirer.prompt([
        {
            type: 'input',
            name: 'baseUrl',
            prefix,
            message: 'OpenAI-compatible base URL:',
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
            message: 'API Key:',
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
            message: 'Alternative model for Opus:',
            transformer: (input: string) => UI.highlight(input),
            validate: (input: string) => {
                if (!input || input.trim() === '') {
                    return 'Model name is required for Opus';
                }
                return true;
            },
        },
    ]);

    const opusModel = requiredAnswers.opusModel.trim();

    // Sonnet prompt
    const sonnetAnswer = await inquirer.prompt([{
        type: 'input',
        name: 'sonnetModel',
        prefix,
        message: 'Alternative model for Sonnet:',
        transformer: (input: string) => input ? UI.highlight(input) : '',
    }]);

    const sonnetModel = sonnetAnswer.sonnetModel.trim() || opusModel;

    // If skipped, replace blank line with fallback display
    if (!sonnetAnswer.sonnetModel.trim()) {
        process.stdout.write('\x1b[1A\x1b[2K');
        console.log(`${prefix} Alternative model for Sonnet: ${UI.dim(`[${opusModel}]`)}`);
    }

    // Haiku prompt
    const haikuAnswer = await inquirer.prompt([{
        type: 'input',
        name: 'haikuModel',
        prefix,
        message: 'Alternative model for Haiku:',
        transformer: (input: string) => input ? UI.highlight(input) : '',
    }]);

    const haikuModel = haikuAnswer.haikuModel.trim() || sonnetModel;

    // If skipped, replace blank line with fallback display
    if (!haikuAnswer.haikuModel.trim()) {
        process.stdout.write('\x1b[1A\x1b[2K');
        console.log(`${prefix} Alternative model for Haiku: ${UI.dim(`[${sonnetModel}]`)}`);
    }

    // Tool calling support prompt (after all models are entered)
    const toolSupportAnswer = await inquirer.prompt([{
        type: 'list',
        name: 'supportsTools',
        prefix,
        message: 'Do your models support tool/function calling?',
        choices: [
            { name: 'Yes', value: true },
            { name: 'No', value: false }
        ],
        default: true
    }]);

    let toolFormat: 'native' | 'xml';

    if (toolSupportAnswer.supportsTools) {
        // User selected "Yes" - ask for tool type
        const toolTypeAnswer = await inquirer.prompt([{
            type: 'list',
            name: 'toolType',
            prefix,
            message: 'Select tool/function type:',
            choices: [
                { name: 'XML (Recommended)', value: 'xml' },
                { name: 'Native (Openai Format)', value: 'native' }
            ],
            default: 'xml'
        }]);
        toolFormat = toolTypeAnswer.toolType as 'native' | 'xml';
    } else {
        // User selected "No" - auto-select xml
        console.log(`${prefix} Tool Format: ${UI.dim('[XML]')}`);
        toolFormat = 'xml';
    }

    return {
        baseUrl: requiredAnswers.baseUrl.trim(),
        apiKey: requiredAnswers.apiKey.trim(),
        models: {
            opus: opusModel,
            sonnet: sonnetModel,
            haiku: haikuModel,
        },
        toolFormat,
    };
}

/**
 * Prompt only for tool calling style (for existing configs missing this field)
 */
async function promptForToolCallingStyle(): Promise<'native' | 'xml'> {
    const prefix = UI.dim('?');

    const toolSupportAnswer = await inquirer.prompt([{
        type: 'list',
        name: 'supportsTools',
        prefix,
        message: 'Do your models support tool/function calling?',
        choices: [
            { name: 'Yes', value: true },
            { name: 'No', value: false }
        ],
        default: true
    }]);

    if (toolSupportAnswer.supportsTools) {
        // User selected "Yes" - ask for tool type
        const toolTypeAnswer = await inquirer.prompt([{
            type: 'list',
            name: 'toolType',
            prefix,
            message: 'Select tool/function type:',
            choices: [
                { name: 'XML (Recommended)', value: 'xml' },
                { name: 'Native (Openai Format)', value: 'native' }
            ],
            default: 'xml'
        }]);
        return toolTypeAnswer.toolType as 'native' | 'xml';
    } else {
        // User selected "No" - auto-select xml
        console.log(`${prefix} Tool Format: ${UI.dim('[XML]')}`);
        return 'xml';
    }
}

// Run the CLI
program.parse();

