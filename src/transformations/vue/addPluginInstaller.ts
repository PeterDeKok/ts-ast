import { builders } from 'ast-types';
import { ExpressionKind } from 'ast-types/gen/kinds';
import { NodePath } from 'ast-types/lib/node-path';
import chalk from 'chalk';
import jscodeshift, { ArrayExpression, CallExpression, Collection, Expression, ExpressionStatement } from 'jscodeshift';
import { createComments } from '../../utils';
import Transformer from '../../utils/transformer';

export interface PluginInstallerContext {
    plugin: string;
    options?: string[];
    comment?: string;
}

export default class AddPluginInstaller extends Transformer<PluginInstallerContext> {

    public run(): void {

        this.title(`Add plugin installer '${this.context.plugin}'.`);

        const pluginInstaller: Collection<CallExpression> = this.file
            .find(CallExpression, (node: CallExpression) => {
                return node.callee.type === 'MemberExpression'
                    && node.callee.object.type === 'Identifier'
                    && node.callee.object.name === 'Vue'
                    && node.callee.property.type === 'Identifier'
                    && node.callee.property.name === 'use'
                    && node.arguments.length > 0
                    && node.arguments[0].type === 'Identifier'
                    && node.arguments[0].name === this.context.plugin
            });

        if (pluginInstaller.size()) {
            this.warning(`Plugin ${chalk.blue(`[${this.context.plugin}]`)} already present, cannot add.`);
            return;
        }

        let args: ExpressionKind[] = [];

        if (this.context.options && this.context.options.length) {
            args = jscodeshift(`[${this.context.options.join(',')}]`)
                .find(ArrayExpression)
                .filter((path: NodePath<ArrayExpression>) => {
                    return path.parentPath
                        && path.parentPath.parentPath
                        && path.parentPath.parentPath.node.type === 'Program'
                })
                .find(Expression)
                .filter((path: NodePath<Expression>) => {
                    return path.parentPath
                        && path.parentPath.parentPath
                        && path.parentPath.parentPath.parentPath
                        && path.parentPath.parentPath.parentPath.parentPath
                        && path.parentPath.parentPath.parentPath.parentPath.node.type === 'Program'
                })
                .nodes() as ExpressionKind[];
        }

        const spec: Omit<ExpressionStatement, 'type'> = {
            expression: builders.callExpression(
                builders.memberExpression(
                    builders.identifier('Vue'),
                    builders.identifier('use'),
                ),
                [
                    builders.identifier(this.context.plugin),
                    ...args,
                ],
            )
        };

        if (this.context.comment) {
            spec.comments = createComments(this.context.comment)
        }

        const newPluginInstaller: ExpressionStatement = builders.expressionStatement.from(spec);

        if (this.addAfterLastOfType<ExpressionStatement>(newPluginInstaller, ExpressionStatement, (node: ExpressionStatement) => {
            return node.type === 'ExpressionStatement'
                && node.expression.type === 'CallExpression'
                && node.expression.callee.type === 'MemberExpression'
                && node.expression.callee.object.type === 'Identifier'
                && node.expression.callee.object.name === 'Vue'
                && node.expression.callee.property.type === 'Identifier'
                && node.expression.callee.property.name === 'use'
        })) {
            return;
        }

        this.addAfterImportsOrStartOfProgram(newPluginInstaller);

    }

}
