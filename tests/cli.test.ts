import { Command } from 'commander';

describe('CLI Options', () => {
    let program: Command;

    beforeEach(() => {
        program = new Command();
        program
            .option('-p, --port <port>', 'Port', '3080')
            .option('-r, --reconfigure', 'Force reconfiguration')
            .option('--no-claude-settings', 'Skip updating Claude Code settings');
    });

    describe('--no-claude-settings flag', () => {
        it('should default claudeSettings to true', () => {
            program.parse(['node', 'test']);
            expect(program.opts().claudeSettings).toBe(true);
        });

        it('should set claudeSettings to false when --no-claude-settings is passed', () => {
            program.parse(['node', 'test', '--no-claude-settings']);
            expect(program.opts().claudeSettings).toBe(false);
        });

        it('should work independently of --reconfigure', () => {
            program.parse(['node', 'test', '--reconfigure', '--no-claude-settings']);
            const opts = program.opts();
            expect(opts.reconfigure).toBe(true);
            expect(opts.claudeSettings).toBe(false);
        });

        it('should work with --port option', () => {
            program.parse(['node', 'test', '--port', '4000', '--no-claude-settings']);
            const opts = program.opts();
            expect(opts.port).toBe('4000');
            expect(opts.claudeSettings).toBe(false);
        });
    });
});
