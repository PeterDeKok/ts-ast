import * as K from 'ast-types/gen/kinds';
import { StringLiteral } from 'jscodeshift';

type StringableTypes = K.LiteralKind | K.IdentifierKind | K.ExpressionKind | K.TSQualifiedNameKind;

export function nodeFilter_StringableNode(str: string): (node: StringableTypes) => boolean {

    return (node: StringableTypes) => {
        switch (node.type) {
            case 'Identifier':
                return node.name === str;
            case 'StringLiteral':
                return node.value === str;
            // TODO MORE CASES??
            default:
                return false;
        }
    }

}

export function nodeFilter_StringableNode_id(str: string): (node: { id: StringableTypes }) => boolean {

    return (node: { id: StringableTypes }) => nodeFilter_StringableNode(str)(node.id);

}


export function nodeFilter_StringableNode_key(str: string): (node: { key: StringableTypes }) => boolean {

    return (node: { key: StringableTypes }) => nodeFilter_StringableNode(str)(node.key);

}
