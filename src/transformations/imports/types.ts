import { ImportDefaultSpecifier, ImportNamespaceSpecifier, ImportSpecifier } from 'jscodeshift';

export interface Specifier {
    exported: Exclude<string, 'default' | '*'>;
    local: string;
}

export interface DefaultSpecifier {
    exported: 'default';
    local: string;
}

export interface NamespacedSpecifier {
    exported: '*';
    local: string;
}

export type AnySpecifier = Specifier | DefaultSpecifier | NamespacedSpecifier;

export interface ImportContext {
    source: string;
    specifiers?: [ AnySpecifier, ...AnySpecifier[] ];
    comment?: string;
}

export type ImportSpecifierType = ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier;
