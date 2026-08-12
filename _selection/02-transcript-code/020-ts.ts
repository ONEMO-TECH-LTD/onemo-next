function findBindingContact(
  magnets: readonly MagnetResult[],
) {
  let index = 0;

  for (let i = 1; i < magnets.length; i++) {
    if (
      magnets[i].clearanceMm <
      magnets[index].clearanceMm
    ) {
      index = i;
    }
  }

  return {
    magnetIndex: index,
    edgeIndex: magnets[index].bindingEdge,
    clearanceMm:
      magnets[index].clearanceMm,
  };
}
