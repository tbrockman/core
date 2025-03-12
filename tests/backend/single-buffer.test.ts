import test, { suite } from 'node:test';
import { fs as _fs, mount, resolveMountConfig, SingleBuffer, umount } from '../../dist/index.js';
import assert from 'node:assert';
import { dirname } from '../../dist/path.js';
import { fs } from '../common.js';

await suite('SingleBuffer`', () => {
	test('should be able to restore filesystem (with same metadata) from original buffer', async () => {
		const buffer = new ArrayBuffer(0x100000);

		umount('/');
		const writable = await resolveMountConfig({ backend: SingleBuffer, buffer });
		mount('/', writable);

		let files = [
			{
				path: '/example.ts',
				content: 'console.log("hello world")',
				mode: 0o644,
				uid: 0,
				gid: 0,
			},
			{
				path: '/example/nested/folder/nested.ts',
				content: 'console.log("hello world")'.repeat(1024),
				mode: 0o644,
				uid: 0,
				gid: 0,
			},
			{
				path: '/example/elsewhere/a/symlink',
				target: '/example.ts',
			},
		];

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

		// @ts-ignore
		files = files.map(({ path, content, mode, uid, gid }) => {
			const stats = _fs.lstatSync(path);
			const written = _fs.readFileSync(path, 'utf-8');
			assert.strictEqual(written, content, `Expected ${path} to have content "${content}"`);
			mode && assert.strictEqual(stats.mode, mode, `Expected ${path} to have mode ${mode.toString(8)}`);
			uid && assert.strictEqual(stats.uid, uid, `Expected ${path} to have uid ${uid}`);
			gid && assert.strictEqual(stats.gid, gid, `Expected ${path} to have gid ${gid}`);
			return { path, content, stats };
		});

		umount('/');
		const snapshot = await resolveMountConfig({ backend: SingleBuffer, buffer });
		mount('/', snapshot);
	});
});
