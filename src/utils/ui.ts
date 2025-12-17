import chalk from 'chalk';
import ora, { Ora } from 'ora';

// Claude Code Inspired Palette
const Palette = {
    Brand: '#D97757',      // Warm Terracotta (Main Brand)
    Success: '#A78BFA',    // Soft Purple (Was Green)
    Error: '#D95858',      // Soft Red
    Warning: '#D9A458',    // Mustard Yellow
    Dim: '#6B6B6B',        // Dark Gray
    Text: '#E6E6E6',       // Off-White
    Border: '#3F3F3F',     // Subtle Border
    Highlight: '#A78BFA'   // Soft Purple (Files/Links)
};

export class UI {
    private static spinner: Ora | null = null;

    static log(message: string) {
        if (this.spinner) {
            this.spinner.stop();
            console.log(message);
            this.spinner.start();
        } else {
            console.log(message);
        }
    }

    static info(message: string) {
        this.log(`${chalk.hex(Palette.Dim).bold('•')} ${message}`);
    }

    static success(message: string) {
        this.log(`${chalk.hex(Palette.Dim)('✔')} ${message}`);
    }

    static warning(message: string) {
        this.log(`${chalk.hex(Palette.Dim)('⚠')} ${message}`);
    }

    static error(message: string, error?: Error) {
        this.log(`${chalk.hex(Palette.Dim)('✖')} ${message}`);
        if (error && error.message) {
            this.log(chalk.hex(Palette.Error)(`  ${error.message}`));
        }
    }

    static header(title: string, subtitle?: string) {
        this.log('');
        this.log(chalk.hex(Palette.Brand).bold(`  ${title}`));
        if (subtitle) {
            this.log(chalk.hex(Palette.Dim)(`  ${subtitle}`));
        }
        this.log('');
    }

    static startSpinner(text: string) {
        if (this.spinner) {
            this.spinner.succeed(); // Finish previous spinner if any
        }
        this.spinner = ora({
            text,
            color: 'white', // Neutral spinner
            spinner: 'dots'
        }).start();
    }

    static updateSpinner(text: string) {
        if (this.spinner) {
            this.spinner.text = text;
        }
    }

    static stopSpinner(success: boolean = true, text?: string) {
        if (!this.spinner) return;

        if (success) {
            this.spinner.stopAndPersist({
                symbol: chalk.hex(Palette.Dim)('✔'),
                text: text
            });
        } else {
            this.spinner.stopAndPersist({
                symbol: chalk.hex(Palette.Dim)('✖'),
                text: text
            });
        }
        this.spinner = null;
    }

    static box(title: string, content: string[]) {
        const border = chalk.hex(Palette.Border)('──────────────────────────────────────────────────');
        this.log('');
        this.log(border);
        this.log(chalk.hex(Palette.Brand).bold(`  ${title}`));
        this.log(border);
        content.forEach(line => this.log(`  ${line}`));
        this.log(border);
        this.log('');
    }

    static newUrl(url: string): string {
        return chalk.hex(Palette.Highlight).bold.underline(url);
    }

    static dim(text: string): string {
        return chalk.hex(Palette.Dim)(text);
    }

    static highlight(text: string): string {
        return chalk.hex(Palette.Highlight)(text);
    }
}
