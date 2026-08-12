#include "magfit/magfit_c.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static void require(int condition, const char* message) {
    if (!condition) {
        fprintf(stderr, "C ABI test failure: %s\n", message);
        exit(EXIT_FAILURE);
    }
}

int main(void) {
    const int32_t square_xy[] = {-36, -36, 36, -36, 36, 36, -36, 36};
    MagfitPolicyC policy;
    MagfitBandResultC result;
    char error[256];
    magfit_default_policy(&policy);

    const MagfitStatusC status = magfit_solve_band_i32(
        square_xy, 4, 2, NULL, 0, 2, &policy, &result, error, sizeof(error));
    require(status == MAGFIT_STATUS_OK, error);
    require(result.fit, "72 mm square must fit");
    require(result.manufactured_size_mm == 72, "default band 2 size must be 72 mm");
    require(result.magnet_count == 4, "square must expose four magnets");
    require(result.verified_link_count == 4, "square must expose four verified links");
    require(result.sparse_phase_present == 0,
            "96 mm population must not engage in band 2");
    require(!result.flap_left.extent_reaches_12,
            "zero-overhang square must report neutral extent evidence");
    require(result.flap.coverage_within_12 && result.flap.coverage_within_24,
            "zero-overhang square must pass both flap limits");
    require(strcmp(magfit_engine_version(), "magfit-core/0.2.0-grid-pixel") == 0,
            "version must be stable");

    {
        const int32_t bands[] = {2, 3, 4};
        MagfitBandResultC results[3];
        const MagfitStatusC multi_status = magfit_solve_bands_i32(
            square_xy, 4, bands, 3, &policy, results, 3, error, sizeof(error));
        require(multi_status == MAGFIT_STATUS_OK, error);
        require(results[0].manufactured_size_mm == 72,
                "multi-band solve must preserve band 2 result");
        require(results[1].manufactured_size_mm == 120,
                "multi-band solve must produce band 3 from one prepared shape");
        require(results[2].manufactured_size_mm == 168,
                "multi-band solve must exercise band 4 from one prepared shape");

        for (size_t i = 0; i < 3; ++i) {
            MagfitBandResultC single;
            const MagfitStatusC single_status = magfit_solve_band_i32(
                square_xy, 4, bands[i], NULL, 0, 2, &policy,
                &single, error, sizeof(error));
            require(single_status == MAGFIT_STATUS_OK, error);
            require(single.fit == results[i].fit,
                    "single and multi-band fit decisions must agree");
            require(single.manufactured_size_mm == results[i].manufactured_size_mm,
                    "single and multi-band sizes must agree");
            require(single.layout_tier == results[i].layout_tier,
                    "single and multi-band layout tiers must agree");
            require(single.magnet_count == results[i].magnet_count,
                    "single and multi-band magnet counts must agree");
            require(single.verified_link_count == results[i].verified_link_count,
                    "single and multi-band link counts must agree");
        }
    }

    {
        const int32_t invalid_xy[] = {0, 0, 10, 10, 0, 10, 10, 0};
        const MagfitStatusC invalid_status = magfit_solve_band_i32(
            invalid_xy, 4, 2, NULL, 0, 2, &policy, &result, error, sizeof(error));
        require(invalid_status == MAGFIT_STATUS_INVALID_ARGUMENT,
                "self-intersection must be reported as invalid input");
        require(error[0] != '\0', "invalid input must include an error message");
    }

    puts("all magfit C ABI tests passed");
    return EXIT_SUCCESS;
}
