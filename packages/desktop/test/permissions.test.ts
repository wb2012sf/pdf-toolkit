import type { PdfPermissions } from '@pdf-toolkit/core/bytes';
import { describe, expect, it } from 'vitest';
import { PERMISSION_LABELS, forbiddenPermissions } from '../src/permissions.js';

describe('forbiddenPermissions', () => {
  it('sends nothing when everything is still allowed', () => {
    const allowed = new Map<keyof PdfPermissions, boolean>([
      ['print', true],
      ['copy', true],
    ]);

    expect(forbiddenPermissions(allowed)).toEqual({});
  });

  it('sends only the ones that were unticked', () => {
    const allowed = new Map<keyof PdfPermissions, boolean>([
      ['print', true],
      ['copy', false],
      ['modify', false],
    ]);

    expect(forbiddenPermissions(allowed)).toEqual({
      copy: false,
      modify: false,
    });
  });

  it('never sends true, which would restate a default', () => {
    const allowed = new Map<keyof PdfPermissions, boolean>([['print', true]]);

    expect(Object.values(forbiddenPermissions(allowed))).not.toContain(true);
  });
});

describe('PERMISSION_LABELS', () => {
  it('covers every permission the engine accepts, once each', () => {
    // If the engine grows a permission this fails, rather than the screen
    // quietly offering fewer than it could.
    const names = PERMISSION_LABELS.map(([name]) => name);
    const expected: (keyof PdfPermissions)[] = [
      'print',
      'printHighQuality',
      'modify',
      'copy',
      'annotate',
      'fillForms',
      'accessibility',
      'assemble',
    ];

    expect([...names].sort()).toEqual([...expected].sort());
  });
});
