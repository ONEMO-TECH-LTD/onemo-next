editor.once('load', () => {
    const types = new Set(['css', 'html', 'json', 'shader', 'text']);

    editor.method('assets:edit', async (asset, ide?: string) => {
        const type = asset.get('type');

        if (type === 'script') {
            editor.call('status:error', 'Script assets are not part of the ONEMO Studio runtime surface.');
            return;
        }

        editor.call('picker:codeeditor', asset, undefined, undefined, ide);
    });

    const attachDblClickHandler = (key, asset) => {
        const gridItem = editor.call('assets:panel:get', asset.get(key));
        if (gridItem) {
            gridItem.element.addEventListener('dblclick', () => {
                editor.call('assets:edit', asset);
            });
        }
    };

    editor.on('assets:add', (asset) => {
        if (types.has(asset.get('type'))) {
            attachDblClickHandler('id', asset);
        }
    });

    editor.on('sourcefiles:add', (file) => {
        attachDblClickHandler('filename', file);
    });
});
