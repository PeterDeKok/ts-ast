import { NodePath } from 'ast-types/lib/node-path';
import {
    Collection,
    ImportDeclaration,
    ImportDefaultSpecifier,
    ImportNamespaceSpecifier,
    ImportSpecifier,
    ModuleSpecifier,
} from 'jscodeshift';
import { Transformer } from '../../utils';
import { AnySpecifier, ImportContext } from './types';

export abstract class ImportTransformer<T extends ImportContext = ImportContext> extends Transformer<T> {

    protected getImportDeclarations(all?: boolean): Collection<ImportDeclaration> {

        return this.file.find(ImportDeclaration, all ? undefined : (node: ImportDeclaration) => node.source.value === this.context.source);

    }

    protected getPackageImportDeclarations(): Collection<ImportDeclaration> {

        return this.getPackageOrRelativeImportDeclarations('package');

    }

    protected getRelativeImportDeclarations(): Collection<ImportDeclaration> {

        return this.getPackageOrRelativeImportDeclarations('relative');

    }

    protected getPackageOrRelativeImportDeclarations(packageOrRelative: 'package' | 'relative'): Collection<ImportDeclaration> {

        return this.getImportDeclarations(true)
            .filter((path: NodePath<ImportDeclaration>) => sourceType(path.node.source.value as string) === packageOrRelative);

    }

}

export function nodeFilter_ModuleSpecifier(specifier: AnySpecifier): (node: ModuleSpecifier) => boolean {

    const localFilter = nodeFilter_ModuleSpecifier_local(specifier.local);
    const exportedFilter = nodeFilter_ModuleSpecifier_exported(specifier.exported);

    return (node: ModuleSpecifier): boolean => localFilter(node) && exportedFilter(node);

}

export function nodeFilter_ModuleSpecifier_local(local: string): (node: ModuleSpecifier) => boolean {

    return (node: ModuleSpecifier): boolean => !!node.local && node.local.name === local;

}

export function nodeFilter_ModuleSpecifier_exported(exported: string): (node: ModuleSpecifier) => boolean {

    return (node: ModuleSpecifier): boolean => {

        switch (exported) {
            case 'default':
                return node.type === 'ImportDefaultSpecifier'
            case '*':
                return node.type === 'ImportNamespaceSpecifier'
            default:
                if (node.type !== 'ImportSpecifier') {
                    return false;
                }

                return !!(node as ImportSpecifier).imported && (node as ImportSpecifier).imported.name === exported;
        }

    }

}

export function sourceType(source: string): 'package' | 'relative' {
    return /^\.\.?\//.test(source) ? 'relative' : 'package';
}
