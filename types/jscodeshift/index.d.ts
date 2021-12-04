declare module 'jscodeshift/src/matchNode' {
    declare function matchNode(haystack, needle): boolean;
    // function matchNode(haystack, needle) {
    //   if (typeof needle === 'function') {
    //       return needle(haystack);
    //   }
    //   if (isNode(needle) && isNode(haystack)) {
    //       return Object.keys(needle).every(function(property) {
    //           return (
    //               hasOwn(haystack, property) &&
    //               matchNode(haystack[property], needle[property])
    //           );
    //       });
    //   }
    //   return haystack === needle;
    // }

    export = matchNode;
}
