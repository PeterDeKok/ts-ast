import { builders } from 'ast-types';
import chalk from 'chalk';
import { CallExpression, Collection, ExpressionStatement } from 'jscodeshift';
import { createComments, Transformer } from '../../utils';

export interface PluginInstallerFactoryContext {
    callee: string,
    comment?: string,
}

export default class AddPluginInstallerFactory extends Transformer<PluginInstallerFactoryContext> {

    public run(): void {

        this.title(`Add plugin installer factory '${this.context.callee}'.`);

        const pluginInstallerFactory: Collection<CallExpression> = this.file
            .find(CallExpression, (node: CallExpression) => {
                return node.callee.type === 'Identifier'
                    && node.callee.name === this.context.callee
            });

        if (pluginInstallerFactory.size()) {
            this.warning(`Plugin installer factory ${chalk.blue(`[${this.context.callee}]`)} already present, cannot add.`);
            return;
        }

        const spec: Omit<ExpressionStatement, "type"> = {
            expression: builders.callExpression(
                builders.identifier(this.context.callee),
                [],
            ),
        };

        if (this.context.comment) {
            spec.comments = createComments(this.context.comment)
        }

        const newPluginInstallerFactory: ExpressionStatement = builders.expressionStatement.from(spec);

        if (this.addAfterLastOfType<ExpressionStatement>(newPluginInstallerFactory, ExpressionStatement, (node: ExpressionStatement) => {
            return node.expression
                && node.expression.type === 'CallExpression'
                && node.expression.callee.type === 'MemberExpression'
                && node.expression.callee.object.type === 'Identifier'
                && node.expression.callee.object.name === 'Vue'
                && node.expression.callee.property.type === 'Identifier'
                && node.expression.callee.property.name === 'use'
        })) {
            return;
        }

        this.addAfterImportsOrStartOfProgram(newPluginInstallerFactory);

    }

}
