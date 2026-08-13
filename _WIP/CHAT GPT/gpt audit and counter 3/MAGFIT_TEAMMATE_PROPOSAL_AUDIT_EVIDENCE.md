# MAGFIT Teammate Proposal — Independent Audit Evidence

## Input integrity

```text
Archive: Grid-Pixel-Magfit-Proposal-20260812.zip
SHA-256: 4eac3583ac61580b1fc6b519fd7af373fbc24a8ce324389b8c46a75551b6f818
Manifest: every listed file passed sha256sum -c
```

## Independent build matrix

```text
GCC Release                           PASS
GCC native acceptance tests           PASS
GCC C ABI tests                       PASS
Clang Release                         PASS
Clang native acceptance tests         PASS
Clang C ABI tests                     PASS
Clang ASan + UBSan                    PASS
GCC UBSan                             PASS
libstdc++ debug mode                  PASS
```

## Independent benchmark

```text
GCC Release, 1,000 vertices, bands 2+3
hot mean: approximately 11.2 ms

Clang Release, 1,000 vertices, bands 2+3
hot mean: approximately 9.1 ms

Adversarial simple-polygon preparation:
502 vertices      0.213 ms
1,002             0.581 ms
2,002             2.359 ms
4,002             8.102 ms
8,002            33.202 ms
16,002          132.336 ms
32,002          510.171 ms

8,100 input points / 5,872 canonical vertices, bands 2+3+4:
mean hot solve approximately 208.253 ms
```

## Executable counterexamples

```text
EXACT_THRESHOLD fit=1 size=96 tier=Full top_mm=12
reaches12=1 any12=0 all12=0 exception12=0 coverage12=1

COVE_BLINDSPOT fit=1 size=156 tier=ConnectedFallback
magnets=8 links=9 top_mm=18
reaches12=1 any12=1 all12=1 exception12=0 failpoints12=0

U_FALLBACK fit=1 tier=ConnectedFallback magnets=4 links=3

NO_FIT_ENUM fit=0 tier=ConnectedFallback size=0 magnets=0
```

## Arithmetic/oracle checks

```text
1,000,000 random custom U256 multiplication comparisons vs Boost multiprecision: PASS
1,000 random polygon comparisons against independent current-rule oracle: 0 mismatches
```

These checks support retaining the exact low-level predicates while correcting the higher-level product law and API.
