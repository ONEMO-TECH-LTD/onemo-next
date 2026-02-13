import { describe, expect, it } from "vitest";

import { signUploadParams } from "../upload-signature";

describe("signUploadParams", () => {
  it("produces correct SHA-1 hex digest for known input", () => {
    // toSign = "folder=dev/onemo-designs/private/customer_abc/&timestamp=12345" + "mysecret"
    const params = {
      folder: "dev/onemo-designs/private/customer_abc/",
      timestamp: 12345,
    };
    const secret = "mysecret";
    const got = signUploadParams(params, secret);
    const expected = "457bfe3e847d8cfab1fec219fd342bb6dd551053";
    expect(got).toMatch(/^[a-f0-9]{40}$/);
    expect(got).toBe(expected);
  });

  it("sorts params alphabetically before signing", () => {
    // { z: 1, a: 2 } → string "a=2&z=1" + secret
    const params = { z: 1, a: 2 };
    const secret = "s";
    const got = signUploadParams(params, secret);
    expect(got).toMatch(/^[a-f0-9]{40}$/);
    expect(got).toBe("89ce4cb6f314ba7f652e4517d05f04c1819a7c6e");
    const explicit = signUploadParams({ a: 2, z: 1 }, secret);
    expect(got).toBe(explicit);
  });

  it("handles empty params object", () => {
    const got = signUploadParams({}, "secret");
    // toSign = "" + "secret" → SHA1("secret")
    expect(got).toMatch(/^[a-f0-9]{40}$/);
    expect(got).toBe("e5e9fa1ba31ecd1ae84f75caaa474f3a663f05f4");
  });
});
