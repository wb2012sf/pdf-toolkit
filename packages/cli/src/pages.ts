// The parser lives in the engine's bytes layer so the desktop UI shares it
// rather than growing a second copy that can drift. Re-exported here to keep
// the CLI's own imports unchanged.
export { parsePageSpec } from '@pdf-toolkit/core/bytes';
