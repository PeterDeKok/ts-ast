import { builders } from 'ast-types';
import { NodePath } from 'ast-types/lib/node-path';
import chalk from 'chalk';
import jscodeshift, {
    Collection,
    Expression, ExpressionStatement,
    Identifier,
    ImportDeclaration,
    ImportDefaultSpecifier,
    ImportSpecifier,
    MemberExpression,
    NewExpression,
    Node,
    ObjectExpression,
    ObjectProperty,
    Program,
    StringLiteral,
    TSInterfaceBody,
    TSInterfaceDeclaration,
    TSModuleDeclaration,
    TSPropertySignature,
    VariableDeclarator,
} from 'jscodeshift';
import { EOL } from 'os';
import {
    nodeFilter_StringableNode_id,
    nodeFilter_StringableNode_key,
} from '../../transformationHelpers/stringableNodeToString';
import { createComments } from '../../utils';
import Transformer from '../../utils/transformer';

export interface RootOptionContext {
    key: string,
    value: string,
    type?: string,
    comment?: string,
}

export default class AddRootOption extends Transformer<RootOptionContext> {

    public run(): void {

        this.title(`Add Vue root option '${this.context.key}'.`);

        const componentOptions: Collection<ObjectExpression> | undefined = this.getComponentOptionsObjectExpression();

        if (!componentOptions || !componentOptions.size()) {
            return;
        }

        if (!this.ensureUniqueComponentOption(componentOptions)) {
            return;
        }

        if (this.context.type) {
            this.addComponentOptionTypeDeclaration();
        }

        this.addComponentOption(componentOptions);

    }

    /**
     *  Fund the component options ('new Vue' options argument) object expression.
     *
     *  This transformation can only be run, if the options definition can be found AND edited.
     *  @private
     */
    private getComponentOptionsObjectExpression(): Collection<ObjectExpression> | undefined {

        const vueIdentifier: Identifier | undefined = this.getImportedIdentifierForVue();

        if (!vueIdentifier) {
            return undefined;
        }

        const newExpression: Collection<NewExpression> = this.file
            .find(NewExpression, (node: NewExpression) => node.callee.type === 'Identifier' && node.callee.name === vueIdentifier.name)
            .at(0);

        if (!newExpression.size()) {
            this.error('\'new Vue\' expression not found.');
            return undefined;
        }

        const argument: NodePath<Node> = newExpression.get('arguments').get(0);

        return this.followExpressionToObjectExpression(argument);

    }

    private followExpressionToObjectExpression(path: NodePath<Expression>): Collection<ObjectExpression> | undefined {
        if (!path.node) {
            return;
        }

        switch (path.node.type) {
            case 'ObjectExpression':
                return this.file
                    .find(ObjectExpression)
                    .filter((objectPath: NodePath<ObjectExpression>) => objectPath === path);
            case 'Identifier':
                const variableDeclarators: Collection<VariableDeclarator> = this.file
                    .find(VariableDeclarator, (node: VariableDeclarator) => node.id.type === 'Identifier' && node.id.name === (path.node as Identifier).name)
                    .at(0);

                if (!variableDeclarators.size()) {
                    this.error(`Options argument for 'new Vue' expression is an identifier, but its declaration is not found.${EOL}Currently only variable declarations (i.e. var, let, const) are supported, other identifiers are not (e.g. imports).`);
                    return;
                }

                const variableDeclarator: NodePath<VariableDeclarator> = variableDeclarators.paths()[0];

                if (!variableDeclarator.node || !variableDeclarator.node.init) {
                    // If the variable declaration is not initialized,
                    // the object expression could be found by searching for assignment expressions, however,
                    // that gets VERY complicated quickly.
                    this.error('Options argument for \'new Vue\' expression is a variable reference, but its declaration is not initialized.')
                    return;
                }

                if (variableDeclarators.size() && variableDeclarators.paths()[0]) {
                    return this.followExpressionToObjectExpression(variableDeclarators.paths()[0].get('init'))
                }

                // !! Only initialized variable declarations are taken into account.
                // !! Imports and assignment expressions are ignored.
                return;
            case 'MemberExpression':
                this.error('Options argument for \'new Vue\' expression is a member expression, this type is not supported yet.')
                return;
            case 'NewExpression':
            // This is most likely just the vue new expression itself. -> Fallthrough
            default:
                this.error('Can not find options object for \'new Vue\' expression.');
                return;
        }
    }

    private getImportedIdentifierForVue(): Identifier | undefined {

        const directImport: Collection<ImportDefaultSpecifier> = this.file
            .find(ImportDeclaration, (node: ImportDeclaration) => node.source.value === 'vue')
            .find(ImportDefaultSpecifier);

        if (directImport.size()) {
            const specifier: ImportDefaultSpecifier = directImport.nodes()[0];

            if (specifier.local && specifier.local.type === 'Identifier') {
                return specifier.local
            }
        }

        const namedImport: Collection<ImportSpecifier> = this.file
            .find(ImportDeclaration, (node: ImportDeclaration) => ['vue-class-component', 'vue-property-decorator'].includes(node.source.value as string))
            .find(ImportSpecifier, (node: ImportSpecifier) => node.imported.name === 'Vue');

        if (namedImport.size()) {
            const specifier: ImportSpecifier = namedImport.nodes()[0];

            if (specifier.local && specifier.local.type === 'Identifier') {
                return specifier.local;
            } else if (specifier.imported.type === 'Identifier') {
                return specifier.imported;
            }
        }

        // Note technically could be imported as namespace from vue-class-component or vue-property-decorator,
        // but that gets VERY hairy to find in the code... Ignoring for now.

        // Also technically Vue could be extended, or re-exported somewhere else,
        // which currently can not be found also...

        this.error('Import of Vue not found.');

        return undefined;

    }

    private ensureUniqueComponentOption(componentOptions: Collection<ObjectExpression>): boolean {

        const vueOptions: Collection<ObjectProperty> = componentOptions
            .find(ObjectProperty, nodeFilter_StringableNode_key(this.context.key))
            .filter((path: NodePath<ObjectProperty>) => path.parentPath.parentPath === componentOptions.paths()[0])

        if (vueOptions.size() > 0) {
            this.warning(`Vue option already present.`);
            return false;
        }

        return true;

    }

    private addComponentOptionTypeDeclaration(): void {

        const vueOptionsModuleDeclaration: Collection<TSModuleDeclaration> = this.file
            .find(TSModuleDeclaration, nodeFilter_StringableNode_id('vue/types/options'));

        const componentOptionsInterfaceDeclaration: Collection<TSInterfaceDeclaration> = vueOptionsModuleDeclaration
            .find(TSInterfaceDeclaration, nodeFilter_StringableNode_id('ComponentOptions'));

        const existingSignatures: Collection<TSPropertySignature> = componentOptionsInterfaceDeclaration
            .find(TSInterfaceBody)
            .find(TSPropertySignature)
            .filter((path: NodePath<TSPropertySignature>) => path.parentPath === componentOptionsInterfaceDeclaration.find(TSInterfaceBody).paths()[0]);

        if (
            existingSignatures
                .filter((path: NodePath<TSPropertySignature>) => nodeFilter_StringableNode_key(this.context.key)(path.node))
                .size()
        ) {
            this.rawError(`Type declaration for ${chalk.blue(`[${this.context.key}: ${this.context.type}]`)} already exists. Ignoring...`)
            return;
        }

        const tempSignature: Collection<TSPropertySignature> = jscodeshift
            .withParser('ts')(`declare module 'vue/types/options' { interface ComponentOptions<V extends Vue> { property: ${this.context.type}; } }`)
            .find(TSInterfaceDeclaration, nodeFilter_StringableNode_id('ComponentOptions'))
            .find(TSInterfaceBody)
            .find(TSPropertySignature, nodeFilter_StringableNode_key('property'))
            .filter((path: NodePath<TSPropertySignature>) => nodeFilter_StringableNode_id('ComponentOptions')(path.parentPath.parentPath.parentPath.node));

        if (!tempSignature.size()) {
            this.rawError(`Failed to parse new type property signature ${chalk.blue(`[${this.context.key}: ${this.context.type}]`)}. Ignoring...`);
            return;
        }

        const newSignature: TSPropertySignature = builders.tsPropertySignature(
            /^[a-zA-Z0-9_]+$/.test(this.context.key) ? builders.identifier(this.context.key) : builders.stringLiteral(this.context.key),
            tempSignature.get('typeAnnotation').node,
        );

        // Note, all property signatures need to be recreated, as there seems to be an open bug in recast,
        // where extra semi-colons are inserted for existing property declarations.
        // See: https://github.com/benjamn/recast/issues/867
        const newInterface: TSInterfaceDeclaration = builders.tsInterfaceDeclaration.from({
            id: builders.identifier('ComponentOptions'),
            typeParameters: builders.tsTypeParameterDeclaration([
                builders.tsTypeParameter('V', builders.tsTypeReference(builders.identifier('Vue'))),
            ]),
            body: builders.tsInterfaceBody([
                // Here we could sort/find where to add it according to sorted list
                ...existingSignatures.nodes().map((node: TSPropertySignature) => builders.tsPropertySignature.from(node)),
                newSignature,
            ]),
        });

        if (!vueOptionsModuleDeclaration.size()) {
            const newModuleDeclaration: TSModuleDeclaration = builders.tsModuleDeclaration.from({
                id: builders.stringLiteral('vue/types/options'),
                body: builders.tsModuleBlock([ newInterface ]),
                declare: true,
            });

            this.addAfterImportsOrStartOfProgram(newModuleDeclaration);

            return;
        }

        componentOptionsInterfaceDeclaration.replaceWith(newInterface);

    }

    private addComponentOption(componentOptions: Collection<ObjectExpression>): void {

        let key: Identifier | StringLiteral = /^[a-zA-Z0-9_]+$/.test(this.context.key)
            ? builders.identifier(this.context.key)
            : builders.stringLiteral(this.context.key);

        let value: Collection = jscodeshift(this.context.value);

        const spec: Omit<ObjectProperty, 'type'> = {
            key,
            value: (value.find(Program).get('body', 0) as NodePath<ExpressionStatement>).node.expression,
        };

        if (this.context.comment) {
            spec.comments = createComments(this.context.comment)
        }

        const prop: ObjectProperty = builders.objectProperty.from(spec);

        const renderProp: Collection<ObjectProperty> = componentOptions
            .find(ObjectProperty, nodeFilter_StringableNode_key('render'))
            .filter((path: NodePath<ObjectProperty>) => path.parentPath.parentPath === componentOptions.paths()[0])

        if (renderProp.size()) {
            renderProp.insertBefore(prop);
        } else {
            componentOptions
                .find(ObjectProperty)
                .filter((path: NodePath<ObjectProperty>) => path.parentPath.parentPath === componentOptions.paths()[0])
                .at(-1)
                .insertAfter(prop);
        }

    }

    protected error(message: string): false | never {

        const punctuation: string = /\.$/.test(message) ? '' : '.';

        return super.error(`${message}${punctuation}${EOL}  Cannot add option [${chalk.blue(`${this.context.key}: ${this.context.value}`)}]`);

    }

    protected warning(message: string): false | never {

        const punctuation: string = /\.$/.test(message) ? '' : '.';

        return super.warning(`${message}${punctuation}${EOL}  Cannot add option [${chalk.blue(`${this.context.key}: ${this.context.value}`)}]`);

    }

    protected rawError(message: string): false | never {

        return super.error(message);

    }

}
