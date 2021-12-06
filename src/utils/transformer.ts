import { NodePath } from 'ast-types/lib/node-path';
import { Type } from 'ast-types/lib/types';
import { ASTNode, Collection, File, ImportDeclaration, Node, Program } from 'jscodeshift';
import { FileInfo } from 'jscodeshift/src/core';
import Logger from './logger';

export interface BaseOptions {
    throwOnError?: false;
}
export interface ThrowOptions {
    throwOnError: true;
}

export interface TransformerOptions {
    global: {
        logger: Logger;
        verbose: boolean;
    };
}

type ThrowOrBase<O, R> = O extends ThrowOptions ? never : R;

export default abstract class Transformer<Context> {

    protected readonly source: string;
    protected readonly path: string;
    protected readonly file: Collection<File>;
    protected readonly context: Context;
    private readonly _options: (BaseOptions | ThrowOptions) & TransformerOptions;
    private _logger: Logger;

    constructor(
        file: FileInfo,
        collection: Collection<File>,
        context: Context,
        options: (BaseOptions | ThrowOptions) & TransformerOptions,
    ) {

        this.source = file.source;
        this.path = file.path;
        this.file = collection;
        this.context = context;
        this._options = options;
        this._logger = options.global.logger;

    }

    public abstract run(): void;

    public transform(): Collection<File> {

        this.run();

        return this.file;

    }

    // --- LOGGING ---

    protected error(message: string, ...params: any[]): ThrowOrBase<BaseOptions | ThrowOptions, false> {

        this._logger.error(message, ...params);

        if (optionsThrowable(this._options)) {
            process.exit(1);
        }

        return false;

    }

    protected warning(message: string, ...params: any[]): ThrowOrBase<BaseOptions | ThrowOptions, false> {

        this._logger.warning(message, ...params);

        if (optionsThrowable(this._options)) {
            process.exit(1);
        }

        return false;

    }

    protected info(message: string, ...params: any[]): void {

        this._logger.info(message, ...params);

    }

    protected title(message: string, ...params: any[]): void {

        this._logger.info(message, ...params);

        this.increaseLogIndent();

    }

    protected increaseLogIndent(): void {

        this._logger = this._logger.increaseLevel();

    }

    // --- OFTEN USED AST HELPERS ---

    protected addAfterImportsOrStartOfProgram(insert: Node): void {

        return this.addAfterLastOfTypeOrAtStartOfProgram(insert, ImportDeclaration);

    }

    protected addAfterLastOfTypeOrAtStartOfProgram<T extends ASTNode>(insert: Node, searchType: Type<T>, searchFilter?: (value: T) => boolean): void {

        if (this.addAfterLastOfType(insert, searchType, searchFilter)) {
            return;
        }

        this.file
            .find(Program)
            .get('body', 0)
            .insertBefore(insert);

    }

    protected addAfterLastOfType<T extends ASTNode>(insert: Node, searchType: Type<T>, searchFilter?: (value: T) => boolean): boolean {

        const search: Collection<T> = this.file.find(Program).find(searchType, searchFilter);

        if (!search.size()) {
            return false;
        }

        search.at(-1).insertAfter(insert);

        return true;

    }

    protected get topLevelNodePaths(): Collection<Node> {

        return this.programCollection
            .find(Node)
            .filter((path: NodePath<Node>) => path.parentPath.node === this.programPath.node)

    }

    protected get programCollection(): Collection<Program> {

        const programCollection: Collection<Program> = this.file.find(Program);

        if (!programCollection.size()) {
            this.error('Failed to retrieve Program from AST');

            throw new Error('TERMINATE TRANSFORMATION');
        }

        return programCollection;

    }

    protected get programPath(): NodePath<Program> {

        return this.programCollection.paths()[0];

    }

}

function optionsThrowable(options: BaseOptions | ThrowOptions): options is ThrowOptions {

    return !!options.throwOnError;

}
