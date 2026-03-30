editor.once('load', () => {
    editor.method('selection:aabb', () => {
        return null;
    });

    editor.method('entities:aabb', () => {
        return null;
    });

    editor.method('viewport:focus', () => {
        editor.emit('r3f:viewer:focus');
    });
});
