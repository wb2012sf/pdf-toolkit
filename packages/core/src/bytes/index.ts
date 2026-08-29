// The filesystem free layer. Everything here is bytes in, bytes out, so it
// runs unchanged in a browser or a Tauri webview. Import it as
// `@pdf-toolkit/core/bytes` to keep node:fs out of a bundle entirely.
export { pageCountOf } from './inspect.js';
export { mergePdfBytes } from './merge.js';
export { parsePageSpec } from './pages.js';
export { pageFileName, splitPdfBytes } from './split.js';
export { deletePagesBytes } from './delete.js';
export { insertPagesBytes } from './insert.js';
export { reorderPagesBytes } from './reorder.js';
export { rotatePagesBytes } from './rotate.js';
export { extractPagesBytes } from './extract.js';
export {
  type EncryptionAlgorithm,
  type PdfPermissions,
  type ProtectOptions,
  protectPdfBytes,
} from './protect.js';
export { unlockPdfBytes } from './unlock.js';
export {
  type FormFieldInfo,
  type FormFieldOption,
  type FormFieldType,
  type FormFieldValue,
  fillFormBytes,
  flattenFormBytes,
  readFormFieldsBytes,
} from './form.js';
export {
  type SignOptions,
  type SignatureResult,
  type SignatureWarning,
  signPdfBytes,
} from './sign.js';
