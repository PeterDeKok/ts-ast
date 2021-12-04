import * as fs from 'fs';
import { Options as TransformOptions } from 'jscodeshift';
import { Options as RecastOptions } from 'recast';
import {
    BaseOptions,
    ITransformer,
    Logger,
    ThrowOptions,
    TransformerOptions,
    runTransformation,
} from './utils';

export {
    BaseOptions,
    ITransformer,
    Logger,
    RecastOptions,
    ThrowOptions,
    TransformOptions,
    TransformerOptions,
}

export default class TsAst {

    private readonly _path: string;
    private readonly _globalOptions: TransformerOptions['global'];

    constructor(path: string, globalOptions?: Partial<TransformerOptions['global']>) {

        this._path = path;
        this._globalOptions = {
            verbose: false,
            logger: new Logger(globalOptions ? globalOptions.verbose || false : false),

            ...globalOptions,
        };

    }

    public runTransformation<T extends TransformOptions>(
        transformer: ITransformer<T>,
        context: T,
        transformationOptions?: (BaseOptions | ThrowOptions),
        recastOptions?: RecastOptions,
    ): void {

        let source = fs.readFileSync(this._path, { encoding: 'utf-8' });

        source = runTransformation({ path: this._path, source }, transformer, context, {
            ...transformationOptions,
            global: this._globalOptions,
        }, recastOptions);

        fs.writeFileSync(this._path, source, { encoding: 'utf-8' });

    }

}
