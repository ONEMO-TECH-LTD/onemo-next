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
    policy.sparse_mode = MAGFIT_PHASE_ANY;
    policy.sparse_min_active_nodes = 1;

    const MagfitStatusC status = magfit_solve_band_i32(
        square_xy, 4, 2, NULL, 0, 2, &policy, &result, error, sizeof(error));
    require(status == MAGFIT_STATUS_OK, error);
    require(result.fit, "72 mm square must fit");
    require(result.manufactured_size_mm == 72, "default band 2 size must be 72 mm");
    require(result.magnet_count == 4, "square must expose four magnets");
    require(result.verified_link_count == 4, "square must expose four verified links");
    require(strcmp(magfit_engine_version(), "magfit-core/0.2.0") == 0,
            "version must be stable");

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
