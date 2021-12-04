import chalk from 'chalk';
import { EOL } from 'os';
import * as util from 'util';

export default class Logger {

    private readonly verbose: boolean;
    private readonly indent: string;
    private readonly indentPerLevel: string;
    private readonly indentLevel: number;

    private get levelIndent(): string {

        return `${this.indent}${Array.from(Array(this.indentLevel).keys()).map(_ => this.indentPerLevel).join('')}`

    }

    constructor(verbose: boolean, indent: string = '', indentPerLevel: string = '  ', indentLevel: number = 0) {

        this.verbose = verbose;
        this.indent = indent;
        this.indentPerLevel = indentPerLevel;
        this.indentLevel = indentLevel;

    }

    public increaseLevel(): Logger {

        return new Logger(this.verbose, this.indent, this.indentPerLevel, this.indentLevel + 1);

    }

    public error(message: string, ...params: any[]): void {

        this._log(chalk.redBright(message), ...params);

    }

    public warning(message: string, ...params: any[]): void {

        if (this.verbose) {
            this._log(chalk.yellowBright(message), ...params);
        }

    }

    public info(message: string, ...params: any[]): void {

        if (this.verbose) {
            this._log(chalk.blueBright(message), ...params);
        }

    }

    public log(message: string, ...params: any[]): void {

        if (this.verbose) {
            this._log(message, ...params);
        }

    }

    public write(message: string): void {
        console.log(message);
    }

    private _log(message: string, ...params: any[]): void {

        const formatted = util.formatWithOptions({
            colors: true,
            showHidden: false,
        }, message, ...params)

        console.log(this.indentMessage(formatted));

    }

    private indentMessage(message: string): string {

        return `${this.levelIndent}${message.split(/\r?\n/).join(`${EOL}${this.levelIndent}`)}`;

    }

}
