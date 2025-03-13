import test, { beforeEach, suite } from 'node:test';
import { fs as _fs, mount, resolveMountConfig, SingleBuffer, umount, type StatsLike } from '../../dist/index.js';
import assert from 'node:assert';
import nodeFs from 'node:fs';
import { dirname } from '../../dist/path.js';
import { flagToMode } from '../../dist/vfs/file.js';
import { randomUUID } from 'node:crypto';

await suite('SingleBuffer`', () => {
	let buffer = new ArrayBuffer(0);
	let files = [
		{
			path: '/example.ts',
			content: 'console.log("hello world")',
			mode: flagToMode('rw'),
			uid: 0,
			gid: 0,
		},
		{
			path: '/example/nested/folder/nested.ts',
			content: 'console.log("hello world")'.repeat(1024),
			mode: flagToMode('rw'),
			uid: 0,
			gid: 0,
		},
		{
			path: '/example/elsewhere/a/symlink',
			target: '/example.ts',
			mode: flagToMode('r'),
		},
	];
	let stored: { path: string; content?: string; stats: StatsLike }[] = [];

	beforeEach(async () => {
		umount('/');
		buffer = new ArrayBuffer(0x100000);
		const writable = await resolveMountConfig({ backend: SingleBuffer, buffer });
		mount('/', writable);

		for (const { path, content, mode, uid, gid, target } of files) {
			_fs.mkdirSync(dirname(path), { recursive: true });

			if (target) {
				_fs.symlinkSync(target, path);
			} else {
				_fs.writeFileSync(path, content!, { mode, encoding: 'utf-8' });
				_fs.chmodSync(path, mode!);
				_fs.chownSync(path, uid!, gid!);
			}
		}

		stored = files.map(({ path, content, mode, uid, gid }) => {
			const stats = _fs.lstatSync(path);
			const written = _fs.readFileSync(path, 'utf-8');
			content && assert.strictEqual(written, content, `Expected ${path} to have content "${content}"`);
			// ???
			// mode && assert.strictEqual(stats.mode, mode, `Expected ${path} to have mode ${mode.toString(8)}`);
			uid && assert.strictEqual(stats.uid, uid, `Expected ${path} to have uid ${uid}`);
			gid && assert.strictEqual(stats.gid, gid, `Expected ${path} to have gid ${gid}`);
			return { path, content, stats };
		});
	});

	test('should be able to restore filesystem (with same metadata) from original buffer in memory', async () => {
		umount('/');
		const snapshot = await resolveMountConfig({ backend: SingleBuffer, buffer });
		mount('/', snapshot);

		const after = files.map(({ path, content, mode, uid, gid }, i) => {
			const stats = _fs.lstatSync(path);
			const written = _fs.readFileSync(path, 'utf-8');
			const before = stored[i];
			content && assert.strictEqual(written, before.content, `Expected ${path} to have content "${content}"`);
			// ???
			// mode && assert.strictEqual(stats.mode, mode, `Expected ${path} to have mode ${mode.toString(8)}`);
			uid && assert.strictEqual(stats.uid, before.stats.uid, `Expected ${path} to have uid ${uid}`);
			gid && assert.strictEqual(stats.gid, before.stats.gid, `Expected ${path} to have gid ${gid}`);
			return { path, content, stats };
		});
	});

	test('should be able to restore filesystem (with same metadata) from buffer on disk', async () => {
		const filename = `/tmp/single-buffer-test-${randomUUID()}`;
		nodeFs.writeFileSync(filename, Buffer.from(buffer));

		const readBuffer = nodeFs.readFileSync(filename);

		umount('/');
		const snapshot = await resolveMountConfig({ backend: SingleBuffer, buffer: Buffer.from(readBuffer) });
		mount('/', snapshot);

		const after = files.map(({ path, content, mode, uid, gid }, i) => {
			const stats = _fs.lstatSync(path);
			const written = _fs.readFileSync(path, 'utf-8');
			const before = stored[i];
			content && assert.strictEqual(written, before.content, `Expected ${path} to have content "${content}"`);
			// ???
			// mode && assert.strictEqual(stats.mode, mode, `Expected ${path} to have mode ${mode.toString(8)}`);
			uid && assert.strictEqual(stats.uid, before.stats.uid, `Expected ${path} to have uid ${uid}`);
			gid && assert.strictEqual(stats.gid, before.stats.gid, `Expected ${path} to have gid ${gid}`);
			return { path, content, stats };
		});
	});
});
