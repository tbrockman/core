import test, { suite } from 'node:test';
import { fs as _fs, configure, mount, resolveMountConfig, SingleBuffer, umount } from '../../src/index.js';

await suite('SingleBuffer`', () => {
	test('should be able to restore filesystem from original buffer', async () => {
		configure({ log: { level: 'debug' } });
		umount('/');

		const buffer = new ArrayBuffer(0x100000);
		const writable = await resolveMountConfig({ backend: SingleBuffer, buffer });
		mount('/', writable);
		_fs.writeFileSync('/example.ts', 'hello', 'utf-8');
		_fs.statSync('/example.ts'); // <-- file exists

		umount('/');
		const snapshot = await resolveMountConfig({ backend: SingleBuffer, buffer });
		mount('/', snapshot);
		_fs.statSync('/example.ts'); // <-- exception thrown here
	});
});
