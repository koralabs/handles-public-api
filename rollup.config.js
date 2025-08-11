import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import multiInput from 'rollup-plugin-multi-input';
import nodeExternals from 'rollup-plugin-node-externals';
import typescript from 'rollup-plugin-typescript2';

export default (async () => ({
    input: [
        'express.ts',
        'block_processors/*.processor.ts',
        'ioc/*.registry.ts',
        'middlewares/*.middleware.ts',
        'routes/*.route.ts',
        'workers/*.js'
    ],
    plugins: [
        nodeExternals(), // Marks native modules as external
        typescript(),
        commonjs({ignoreDynamicRequires: true}),
        nodeResolve({dedupe: ['@koralabs/kora-labs-common']}),
        json(),
        multiInput()
    ],
    output: {
        dir: 'dist',
        format: 'es'
    },
    external: [ 'aws-sdk', 'forever', 'swagger-ui-express' ]
}))();

