# ManufacturingSpec schema guide

The engine-side canonical payload is a geometry/policy contract, not yet the complete physical product. It includes exact geometry, centres, profile/artifact identities and safety proof.

The fulfilment-side payload adds the versioned component and process profile, verifies tolerance compatibility, and re-hashes the complete physical product.

`createEngineManufacturingSpec` rejects an uncertified preview solution when the profile is marked production-ready. The reference profile may create a non-production spec for integration testing; its proof status makes that limitation explicit.
