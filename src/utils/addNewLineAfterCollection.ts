import { builders } from 'ast-types';
import { Collection } from 'jscodeshift';

export default function addNewLineAfterCollection(collection: Collection): void {

    if (!collection.size()) {
        return;
    }

    collection.at(-1).insertAfter(builders.noop());

}
