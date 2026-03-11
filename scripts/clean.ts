import { rm } from 'node:fs/promises';

const pathsToRemove = [
	'dist',
	'packages/docs/dist',
	'packages/temporal/dist',
	'packages/server/dist',
];

for (const path of pathsToRemove) {
	await rm(path, { recursive: true, force: true });
}
