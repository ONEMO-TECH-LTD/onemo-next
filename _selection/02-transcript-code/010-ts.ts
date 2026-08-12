type BandResult =
  | {
      ok: true;
      fit: FitResult;
    }
  | {
      ok: false;
      band: BandId;
      reason: "NO_VALID_LAYOUT";
    };
