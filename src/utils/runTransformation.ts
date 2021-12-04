import chalk from 'chalk';
import jscodeshift, { Collection, File, Options as TransformOptions } from 'jscodeshift';
import { FileInfo } from 'jscodeshift/src/core';
import { EOL } from 'os';
import { Options as RecastOptions } from 'recast';
import TransformerClass, { BaseOptions, ThrowOptions, TransformerOptions } from './transformer';

export interface ITransformer<T extends TransformOptions> {
    new(file: FileInfo, collection: Collection<File>, context: T, options: (BaseOptions | ThrowOptions) & TransformerOptions): TransformerClass<T>;
}

const PARSERS: { [ext: string]: string } = {
    '.ts': 'ts'
};

function ensureRecastOptions(options?: Readonly<RecastOptions>): RecastOptions {

    return {
        // parser: typescriptParser,
        tabWidth: 4,
        useTabs: false,
        reuseWhitespace: false,
        wrapColumn: 130,
        tolerant: false,
        quote: 'single',
        trailingComma: true,
        arrayBracketSpacing: true,
        objectCurlySpacing: true,
        arrowParensAlways: true,

        ...options,
    }

}

function getParser(path: string): string {

    const extension: string | undefined = (/\.([^.]*)$/.exec(path) || [])[0];

    if (PARSERS[extension]) {

        return PARSERS[extension];

    }

    throw new Error(`${extension} is not a valid parser.`);

}

export default function runTransformation<T extends TransformOptions>(
    fileInfo: FileInfo,
    transformation: ITransformer<T>,
    context: T,
    transformationOptions: (BaseOptions | ThrowOptions) & TransformerOptions,
    recastOptions?: Readonly<RecastOptions>,
): string {

    const _recastOptions: RecastOptions = ensureRecastOptions(recastOptions);

    const { path, source } = fileInfo;

    const j = jscodeshift.withParser(getParser(path));

    transformationOptions.global.logger.info(`${EOL}Running transformation ${transformation.name}`, `${EOL}  ${chalk.gray(`for file: ${fileInfo.path}`)}`)

    try {

        return (new transformation(fileInfo, j(source), context, {
            ...transformationOptions,
            global: {
                ...transformationOptions.global,
                logger: transformationOptions.global.logger.increaseLevel(),
            }
        }))
            .transform()
            .toSource(_recastOptions);

    } catch (e) {

        transformationOptions.global.logger.error(`Failed to run transformation '${transformation.name}'`, `${EOL}${chalk.gray(`Continue-ing without transformation.`)}${EOL}`);

        if (transformationOptions && transformationOptions.throwOnError) {
            throw e;
        }

        // console.error(e);

        return source; // Return original
    }



}
