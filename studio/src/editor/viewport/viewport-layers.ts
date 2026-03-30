editor.once('load', () => {
    // Layer composition editing is disabled in ONEMO Studio. Keep a minimal
    // settings listener so legacy callers can still request a repaint.
    editor.on('settings:project:load', () => {
        editor.call('viewport:render');
    });
});
