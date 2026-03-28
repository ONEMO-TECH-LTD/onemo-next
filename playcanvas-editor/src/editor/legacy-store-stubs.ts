/**
 * Store/marketplace modules were removed. Register no-op handlers so
 * remaining UI paths (context menu, asset panel) do not throw at runtime.
 */
editor.once('load', () => {
    editor.method('picker:store:cms', () => {
        console.warn('[editor] Store CMS is not available in this build.');
    });

    editor.method('picker:store:licenses', async () =>
        [] as Array<{ id: string; name: string; url: string }>
    );

    editor.method('assets:move-to-store', () => {
        console.warn('[editor] Move to store is not available in this build.');
    });
});
