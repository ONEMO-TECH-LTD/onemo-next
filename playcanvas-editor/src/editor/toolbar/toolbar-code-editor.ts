import type { Observer } from '@playcanvas/observer';

editor.once('load', () => {
    const projectUserSettings = editor.call('settings:projectUser');

    editor.method('picker:codeeditor', (asset?: Observer, _options?: Record<string, unknown>, _popup?: boolean, ideOverride?: string) => {
        void _options;
        void _popup;
        const ide = ideOverride || projectUserSettings.get('editor.codeEditor');

        if (ide === 'vscode' || ide === 'cursor') {
            if (asset) {
                window.open(editor.call('assets:idePath', ide, asset));
            } else {
                console.warn('[editor] Select a script asset to open in the external editor.');
            }
            return;
        }

        // In-browser Monaco bundle removed — open Cursor/VS Code URL (same scheme as Settings → Code Editor).
        if (asset) {
            window.open(editor.call('assets:idePath', 'cursor', asset));
            return;
        }

        console.warn('[editor] Select a script asset to edit, or set Code Editor to VS Code or Cursor in Settings.');
    });
});
