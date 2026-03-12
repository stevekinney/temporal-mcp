import { describe, expect, test } from 'bun:test';
import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const repositoryRoot = resolve(import.meta.dir, '..', '..', '..', '..');
const builtCliPath = join(repositoryRoot, 'dist', 'cli.js');

async function runCommand(
	command: string,
	argumentsList: string[],
): Promise<void> {
	await new Promise<void>((resolvePromise, rejectPromise) => {
		const childProcess = spawn(command, argumentsList, {
			cwd: repositoryRoot,
			stdio: ['ignore', 'pipe', 'pipe'],
		});

		let standardError = '';
		let standardOutput = '';

		childProcess.stdout.on('data', (chunk) => {
			standardOutput += chunk.toString();
		});
		childProcess.stderr.on('data', (chunk) => {
			standardError += chunk.toString();
		});

		childProcess.on('error', rejectPromise);
		childProcess.on('exit', (code) => {
			if (code === 0) {
				resolvePromise();
				return;
			}

			rejectPromise(
				new Error(
					`${command} ${argumentsList.join(' ')} failed with code ${code}\n${standardOutput}\n${standardError}`,
				),
			);
		});
	});
}

describe('cli smoke test', () => {
	test('built dist/cli.js starts and reaches ready state', async () => {
		await runCommand('bun', ['run', 'build:javascript']);
		await access(builtCliPath, constants.X_OK);

		const temporaryDirectory = await mkdtemp(
			join(tmpdir(), 'temporal-mcp-cli-smoke-'),
		);

		try {
			await new Promise<void>((resolvePromise, rejectPromise) => {
				const cliProcess = spawn('node', [builtCliPath], {
					cwd: temporaryDirectory,
					stdio: ['pipe', 'pipe', 'pipe'],
					env: {
						...process.env,
						HOME: temporaryDirectory,
					},
				});

				let standardError = '';
				let isReady = false;
				const timeoutHandle = setTimeout(() => {
					cliProcess.kill('SIGTERM');
					rejectPromise(
						new Error(
							`Timed out waiting for ready message. stderr output:\n${standardError}`,
						),
					);
				}, 10000);

				cliProcess.stderr.on('data', (chunk) => {
					standardError += chunk.toString();

					if (standardError.includes('[temporal-mcp] Server ready')) {
						isReady = true;
						clearTimeout(timeoutHandle);
						cliProcess.kill('SIGTERM');
						resolvePromise();
					}
				});

				cliProcess.on('error', (error) => {
					clearTimeout(timeoutHandle);
					rejectPromise(error);
				});

				cliProcess.on('exit', (code, signal) => {
					clearTimeout(timeoutHandle);
					if (!isReady) {
						rejectPromise(
							new Error(
								`CLI exited before ready state (code: ${String(code)}, signal: ${String(signal)}). stderr output:\n${standardError}`,
							),
						);
					}
				});
			});
		} finally {
			await rm(temporaryDirectory, { recursive: true, force: true });
		}

		expect(true).toBe(true);
	}, 20000);
});
