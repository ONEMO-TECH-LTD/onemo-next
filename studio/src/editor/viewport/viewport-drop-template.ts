editor.once('load', () => {
    const canvas = editor.call('viewport:canvas');
    if (!canvas) {
        return;
    }

    editor.call('drop:target', {
        ref: canvas,
        filter: () => false,
        drop: () => undefined
    });
});
