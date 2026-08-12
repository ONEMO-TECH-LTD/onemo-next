MagfitPreparedShape* magfit_prepare_i32(...);

MagfitStatusC magfit_solve_prepared_bands(
    const MagfitPreparedShape* shape,
    const MagfitBandRequestC* requests,
    size_t request_count,
    MagfitBandResultC* results,
    ...
);

void magfit_prepared_destroy(
    MagfitPreparedShape* shape
);
