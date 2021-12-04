import { builders } from 'ast-types';
import { CommentKind } from 'ast-types/gen/kinds';
import { EOL } from 'os';

export default function createComments(comment: string, multiAsLines: boolean = true, leading: boolean = true): CommentKind[] {

    if (multiAsLines || !/\n/.test(comment)) {
        return comment.split(/\r?\n/).map((commentLine: string) => {
            return builders.commentLine.from({
                leading: leading,
                // trailing: !leading,
                value: commentLine ? ` ${commentLine}` : '',
            });
        });
    } else {
        const spacedComment = comment ? ` ${comment.replace(/\r?\n/gm, `${EOL} * `)}${EOL} ` : '';

        return [ builders.commentBlock.from({ leading: leading, trailing: !leading, value: spacedComment }) ];
    }

}
