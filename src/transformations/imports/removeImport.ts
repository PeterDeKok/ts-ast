import { NodePath } from 'ast-types/lib/node-path';
import { ImportDeclaration, ModuleSpecifier } from 'jscodeshift';
import { ImportTransformer, nodeFilter_ModuleSpecifier } from './common';
import { ImportContext } from './types';

export interface RemoveImportContext extends ImportContext {
    keepSourceForSideEffects?: true;
}

export default class RemoveImport extends ImportTransformer<RemoveImportContext> {

    public run(): void {

        if (this.context.keepSourceForSideEffects && !this.context.specifiers) {
            return;
        }

        if (!this.context.specifiers) {
            this.getImportDeclarations().remove();

            return;
        }

        for (const specifier of this.context.specifiers) {
            this.getImportDeclarations()
                .find(ModuleSpecifier, nodeFilter_ModuleSpecifier(specifier))
                .remove()
        }

        if (this.context.keepSourceForSideEffects) {
            return;
        }

        this.getImportDeclarations()
            .filter((path: NodePath<ImportDeclaration>): boolean => !path.node.specifiers || !path.node.specifiers.length)
            .remove();

    }

}
