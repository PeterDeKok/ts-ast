import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import typescript from '@rollup/plugin-typescript';

export default {
    input: 'src/index.ts',
    output: {
        dir: 'lib',
        format: 'cjs',
        exports: 'named',
    },
    plugins: [
        nodeResolve(),
        json(),
        typescript(),
        commonjs(),
    ],
};
