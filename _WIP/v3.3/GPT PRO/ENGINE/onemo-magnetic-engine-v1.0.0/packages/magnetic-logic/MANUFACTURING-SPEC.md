# ManufacturingSpec schema guide

The engine-side canonical payload is a geometry/policy contract, not yet the complete physical product. It includes the canonical source and final rings, scale, governed selection identity, integer and millimetre centres, profile/artifact identities, decision trace and exact safety proof.

The verifier resolves the pinned profile and Compute/Logic artifacts, reruns certification from the stored source ring, and requires the rebuilt payload to match. The fulfilment-side payload adds the versioned component and process profile, validates physical dimensions and tolerance compatibility, records verifier artifacts, and re-hashes the complete physical product.

`createEngineManufacturingSpec` accepts only the certified offered solution reconstructed from complete per-rung evidence. The reference profile may create a non-production spec for integration testing; its proof status makes that limitation explicit.
