import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "rollup-plugin-typescript2";
import multiInput from "rollup-plugin-multi-input";
import commonjs from '@rollup/plugin-commonjs'
import json from "@rollup/plugin-json";

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
		typescript(),
		commonjs({ignoreDynamicRequires: true}),
		nodeResolve(),
		json(),
		multiInput()
	],
	output: {
		dir: 'dist',
		format: 'es'
	},
	external: [ 'aws-sdk', 'forever', 'swagger-ui-express' ]
}))();

