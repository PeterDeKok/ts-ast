import { builders } from 'ast-types';
import { NodePath } from 'ast-types/lib/node-path';
import chalk from 'chalk';
import {
    Collection,
    ImportDeclaration,
    ModuleSpecifier,
    Identifier,
    Program,
} from 'jscodeshift';
import { addNewLineAfterCollection, createComments } from '../../utils';
import {
    ImportTransformer,
    nodeFilter_ModuleSpecifier,
    nodeFilter_ModuleSpecifier_local,
    sourceType,
} from './common';
import { AnySpecifier, ImportSpecifierType } from './types';

export default class AddImport extends ImportTransformer {

    public run(): void {

        this.title(`Add import from '${this.context.source}'.`);

        if (!this.context.specifiers) {
            if(this.getImportDeclarations().size()) {
                this.warning(`An import from ${this.context.source} is already present, side-effects are already loaded.`);

                return;
            }

            this.addNewImportDeclaration();
        } else {
            for (const specifier of this.context.specifiers) {

                if (this.specifierAlreadyExists(specifier)) {
                    continue; // Ignore when already present!
                }

                if (!this.localIsUnique(specifier.local)) {
                    continue;
                }

                const newImportSpecifier: ImportSpecifierType = createImportSpecifier(specifier);

                if (this.addSpecifierToCompatibleImportDeclarations(newImportSpecifier)) {
                    continue;
                }

                this.addNewImportDeclaration(newImportSpecifier);

            }
        }

        addNewLineAfterCollection(this.getImportDeclarations(true));

    }

    private specifierAlreadyExists(specifier: AnySpecifier): boolean {

        const specifierMatches: Collection<ModuleSpecifier> = this.getImportDeclarations()
            .find(ModuleSpecifier, nodeFilter_ModuleSpecifier(specifier));

        if (specifierMatches.size() === 1) {
            this.warning(`Import specifier ${chalk.blueBright(`[${specifier.exported} as ${specifier.local}]`)} already exists and will be (safely) ignored.`)

            return true;
        }

        return false;

    }

    private localIsUnique(local: string): boolean {

        const localMatches: Collection<ModuleSpecifier> = this.getImportDeclarations(true)
            .find(ModuleSpecifier, nodeFilter_ModuleSpecifier_local(local))

        if (localMatches.size()) {
            return this.warning(`Import local ${local} is not unique and will be skipped. This could lead to unexpected behaviour!`);
        }

        return true;

    }

    private addSpecifierToCompatibleImportDeclarations(specifier: ImportSpecifierType): boolean {

        const compatible: Collection<ImportDeclaration> = this.getImportDeclarations()
            .filter((path: NodePath<ImportDeclaration>) => {

                if (!path.node.specifiers) {
                    return true;
                }

                return path.node.specifiers.every((existingSpecifier: ImportSpecifierType) => {
                    switch (specifier.type) {
                        case 'ImportDefaultSpecifier':
                            return existingSpecifier.type !== 'ImportDefaultSpecifier'
                        case 'ImportNamespaceSpecifier':
                            return existingSpecifier.type !== 'ImportSpecifier' && existingSpecifier.type !== 'ImportNamespaceSpecifier';
                        default:
                            return existingSpecifier.type !== 'ImportNamespaceSpecifier'
                    }
                });

            });

        if (!compatible.size()) {
            return false;
        }

        const compatibleImportDeclaration: ImportDeclaration = compatible.nodes()[0];
        const existingSpecifiers: Array<ImportSpecifierType> = compatibleImportDeclaration.specifiers || [];

        compatible.at(0).replaceWith(builders.importDeclaration.from({
            ...compatibleImportDeclaration,
            specifiers: [
                ...existingSpecifiers,
                specifier,
            ],
        }));

        return true;

    }

    private addNewImportDeclaration(...specifiers: ImportSpecifierType[]): void {

        const spec: Omit<ImportDeclaration, 'type'> = {
            source: builders.stringLiteral(this.context.source),
            specifiers,
        };

        if (this.context.comment) {
            spec.comments = createComments(this.context.comment);
        }

        const newImportDeclaration: ImportDeclaration = builders.importDeclaration.from(spec);

        const allImportDeclarations: Collection<ImportDeclaration> = this.getImportDeclarations(true);

        // When no import declarations are present in the file,
        // add the import declaration to the start of the program.
        if (!allImportDeclarations.size()) {
            this.file.find(Program).get('body').at(0).insertBefore(newImportDeclaration);

            return;
        }

        const sourceImportDeclarations: Collection<ImportDeclaration> = this.getImportDeclarations();

        // When other import declarations are present in the program for the same source,
        // add the import declaration after the last import declaration of the same source.
        if (sourceImportDeclarations.size()) {

            sourceImportDeclarations.at(-1).insertAfter(newImportDeclaration)

            return;
        }

        // When the source is for a package module,
        // add the import declaration after the last package module import declaration,
        // or before all relative module import declarations.
        if (sourceType(this.context.source) === 'package') {

            const packageImportDeclarations: Collection<ImportDeclaration> = this.getPackageImportDeclarations();

            if (packageImportDeclarations.size()) {
                packageImportDeclarations.at(-1).insertAfter(newImportDeclaration);
            } else {
                this.getRelativeImportDeclarations().at(0).insertBefore(newImportDeclaration);
            }

            return;
        }

        // If non of the above cases are valid,
        // add the import declaration after the last import declarations.
        // This happens (only) when:
        // - There are other import declarations
        // - There are no other import declarations with the same source
        // - The new import declaration is for a relative module import.
        allImportDeclarations.at(-1).insertAfter(newImportDeclaration);

    }

}

function createImportSpecifier(specifier: AnySpecifier): ImportSpecifierType {

    const localIdentifier: Identifier = builders.identifier(specifier.local);

    let importSpecifier: ImportSpecifierType;

    switch (specifier.exported) {
        case 'default':
            importSpecifier = builders.importDefaultSpecifier(localIdentifier);
            break;
        case '*':
            importSpecifier = builders.importNamespaceSpecifier(localIdentifier);
            break;
        default:
            if (specifier.local === specifier.exported) {
                importSpecifier = builders.importSpecifier(builders.identifier(specifier.exported));
            } else {
                importSpecifier = builders.importSpecifier(builders.identifier(specifier.exported), localIdentifier);
            }
            break;
    }

    return importSpecifier;

}
