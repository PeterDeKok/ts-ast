import { builders } from 'ast-types';
import { NodePath } from 'ast-types/lib/node-path';
import chalk from 'chalk';
import jscodeshift, { Collection, Node, Program } from 'jscodeshift';
import matchNode from 'jscodeshift/src/matchNode';
import { EOL } from 'os';
import { createComments, Transformer } from '../../utils';

export interface CodeBlockContext {
    code: string;
    title: string;
    search?: string | object | object[];
    location?: 'before' | 'after';
    ignore?: 'strict' | 'selective' | 'complete' | 'never';
    newline?: 'both' | 'before' | 'after';
}

type OmitRecursive<T, K extends keyof any> = {
    [P in Exclude<keyof T, K>]: T[P] extends {} ? OmitRecursive<T[P], K> : T[P];
};

function handleDeepMergeAndRemoveKeysForProperty(keys: string[], value: any, nodeKey?: string): any {
    if (nodeKey !== undefined && keys.includes(nodeKey)) {
        return undefined;
    }

    if (typeof value !== 'object' || value === null) {
        return value;
    }

    if (Array.isArray(value)) {
        return value.map((item) => {
            return handleDeepMergeAndRemoveKeysForProperty(keys, item);
        })
    }

    return deepMergeAndRemoveKeys(value, ...keys);
}

function deepMergeAndRemoveKeys<T extends {}, K extends string>(node: T, ...keys: K[]): OmitRecursive<T, K> {
    const copy: Partial<T> = {};

    for (const nodeKey in node) {
        if (!Object.prototype.hasOwnProperty.call(node, nodeKey)) {
            continue;
        }

        const newValue: undefined | T[typeof nodeKey] = handleDeepMergeAndRemoveKeysForProperty(keys, node[nodeKey], nodeKey);

        if (newValue !== undefined) {
            copy[nodeKey] = newValue;
        }
    }

    return copy as OmitRecursive<T, K>;
}

function matchExactSequence(haystack: object[], needles: object[]): number[] {

    if (!needles.length) {
        return [];
    }

    // Continue until the last set of haystack items which can still be checked
    // against ALL needles. This WOULD overflow if the length of needles could be zero.
    // However that has been checked above.
    for (let i = 0; i <= (haystack.length - needles.length); i++) {
        const foundIndexes: number[] = [];

        for (let j = 0; j < needles.length; j++) {
            if (matchNode(haystack[i+j], needles[j])) {
                foundIndexes.push(i+j);
            }
        }

        if (foundIndexes.length === needles.length) {
            return foundIndexes;
        }
    }

    return [];

}

export default class AddCodeBlock extends Transformer<CodeBlockContext> {

    run(): void {

        this.title(`Add code block '${this.context.title}'.`);

        const codeBlock: Collection<Node> | undefined = this.parseCodeBlockAndRetrieveNodes(this.context.code, 'Code block');

        if (!codeBlock) {
            return;
        }

        const nonExistingExpressionsFromCodeBlock = codeBlock.filter((path: NodePath<Node>) => {
            return !this.programCollection.find(Node, deepMergeAndRemoveKeys(path.node, 'loc', 'start', 'end') as object).size();
        });

        if (this.context.ignore !== 'never' && nonExistingExpressionsFromCodeBlock.size() === 0) {
            this.warning('Entire code block already present, ignoring code block.', chalk.gray(`${EOL}Ignore setting is '${this.context.ignore || 'strict (default)'}'`));

            return;
        } else if ((this.context.ignore === 'strict' || !this.context.ignore) && nonExistingExpressionsFromCodeBlock.size() !== codeBlock.size()) {
            this.warning('Some expressions in code block already present, ignoring entire code block.', chalk.gray(`${EOL}Ignore setting is '${this.context.ignore || 'strict (default)'}'`));

            return;
        } else if (this.context.ignore === 'selective' && nonExistingExpressionsFromCodeBlock.size() !== codeBlock.size()) {
            this.info('Some expressions in the code block are already present, ignoring those expressions!', `${EOL}Depending on the code block and target file, this could lead to unexpected behaviour!`, chalk.gray(`${EOL}Ignore setting is '${this.context.ignore}'`));
        } else if (this.context.ignore === 'never' && nonExistingExpressionsFromCodeBlock.size() !== codeBlock.size()) {
            this.info('Some expressions in the code block are already present, adding all expression anyway!', chalk.gray(`${EOL}Ignore setting is '${this.context.ignore}'`));
        }

        let codeBlockExpressions: Node[];

        if (this.context.ignore === 'selective') {
            codeBlockExpressions = nonExistingExpressionsFromCodeBlock.nodes();
        } else {
            codeBlockExpressions = codeBlock.nodes();
        }

        if (!codeBlockExpressions[0].comments) {
            codeBlockExpressions[0].comments = [];
        }

        codeBlockExpressions[0].comments.unshift(...createComments(this.context.title));

        if (this.context.newline === 'both' || this.context.newline === 'before') {
            codeBlockExpressions.unshift(builders.noop());
        }

        if (this.context.newline === 'both' || this.context.newline === 'after') {
            codeBlockExpressions.push(builders.noop());
        }

        if (this.context.search) {
            const searchCollection: Collection<Node> = this.getSearchCollection();

            if (!searchCollection.size()) {
                this.error('Search code not found, ignoring..');

                return;
            }

            if (this.context.location === 'before') {
                searchCollection.insertBefore(codeBlockExpressions);
            } else {

                searchCollection.at(-1).insertAfter(codeBlockExpressions);
            }

            return;
        }

        try {
            this.topLevelNodePaths.at(-1).insertAfter(codeBlockExpressions);
        } catch (e) {
            this.error('Failed to insert code block.', e);

            return;
        }

    }

    protected parseCodeBlockAndRetrieveNodes(code: string, title: string): undefined | Collection<Node> {

        try {
            const parsedProgramCollection: Collection<Program> = jscodeshift.withParser('ts')(code).find(Program);

            const parsedProgram: Program = parsedProgramCollection.nodes()[0];

            const codeBlock: Collection<Node> = parsedProgramCollection
                .find(Node)
                .filter((path: NodePath<Node>) => path.parentPath.node === parsedProgram);

            if (!codeBlock.size()) {
                this.error(`${title} is empty, ignoring.`);

                return;
            }

            return codeBlock;
        } catch (e) {
            this.error(`Failed to parse ${title.toLowerCase()}.`, e)
        }

    }

    private getSearchObjects(): object[] {

        if (!this.context.search) {
            return [];
        }

        if (Array.isArray(this.context.search)) {
            return this.context.search;
        }

        if (typeof this.context.search === 'string') {
            const searchBlock: Collection<Node> | undefined = this.parseCodeBlockAndRetrieveNodes(this.context.search, 'Search code');

            if (!searchBlock) {
                return [];
            }

            let searchBlockNodes = searchBlock.nodes();

            return searchBlockNodes.map((node: Node) => deepMergeAndRemoveKeys(node, 'loc', 'start', 'end', 'typeAnnotation'));
        }

        return [ this.context.search ];

    }

    private getSearchCollection(): Collection<Node> {

        const searchObjects: object[] = this.getSearchObjects();

        const topLevelNodeDescriptions: object[] = this.topLevelNodePaths.nodes().map((node: Node) => {
            return deepMergeAndRemoveKeys(node, 'loc', 'start', 'end', 'typeAnnotation');
        })

        const topLevelIndexes: number[] = matchExactSequence(topLevelNodeDescriptions, searchObjects);

        return this.topLevelNodePaths.filter((_: NodePath<Node>, i: number) => {
            return topLevelIndexes.includes(i);
        });

    }
}
