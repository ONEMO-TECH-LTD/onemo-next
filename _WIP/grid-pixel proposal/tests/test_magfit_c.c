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

typedef struct Collected {
    size_t count;
    size_t band_counts[5];
    int saw_band2_full_72;
    int saw_band2_pair_72;
    int saw_band3;
} Collected;

static int32_t collect_option(const MagfitLayoutOptionC* option, void* user_data) {
    Collected* collected = (Collected*)user_data;
    ++collected->count;
    if (option->band >= 0 && option->band < 5) ++collected->band_counts[option->band];
    if (option->band == 2 && option->manufactured_size_mm == 72 &&
        option->layout_kind == MAGFIT_LAYOUT_FULL && option->magnet_count == 4) {
        collected->saw_band2_full_72 = 1;
    }
    if (option->band == 2 && option->manufactured_size_mm == 72 &&
        option->layout_kind == MAGFIT_LAYOUT_PAIR && option->magnet_count == 2) {
        collected->saw_band2_pair_72 = 1;
    }
    if (option->band == 3) collected->saw_band3 = 1;
    return 1;
}

int main(void) {
    const int32_t square_xy[] = {-36, -36, 36, -36, 36, 36, -36, 36};
    MagfitPolicyC policy;
    char error[256];
    size_t option_count = 0;
    Collected single = {0};
    size_t observed_band3_count = 0;
    magfit_default_policy(&policy);

    const MagfitStatusC status = magfit_review_band_i32(
        square_xy, 4, 2, NULL, 0, 2, &policy, collect_option, &single,
        &option_count, error, sizeof(error));
    require(status == MAGFIT_STATUS_OK, error);
    require(option_count == single.count && option_count > 1,
            "review must visit every option and report its count");
    require(single.saw_band2_full_72 && single.saw_band2_pair_72,
            "C ABI must expose full and pair variants at the same size");
    require(strcmp(magfit_engine_version(), "magfit-core/0.3.0-grid-pixel-review") == 0,
            "review engine version must be stable");

    {
        const int32_t bands[] = {2, 3};
        Collected multi = {0};
        size_t multi_count = 0;
        const MagfitStatusC multi_status = magfit_review_bands_i32(
            square_xy, 4, bands, 2, &policy, collect_option, &multi,
            &multi_count, error, sizeof(error));
        require(multi_status == MAGFIT_STATUS_OK, error);
        require(multi_count == multi.count && multi.band_counts[2] == single.count,
                "multi-band review must preserve the band-2 option set");
        require(multi.saw_band3 && multi.band_counts[3] > 0,
                "multi-band review must expose band-3 options");
        observed_band3_count = multi.band_counts[3];
    }

    {
        const int32_t invalid_xy[] = {0, 0, 10, 10, 0, 10, 10, 0};
        Collected invalid = {0};
        const MagfitStatusC invalid_status = magfit_review_band_i32(
            invalid_xy, 4, 2, NULL, 0, 2, &policy, collect_option, &invalid,
            &option_count, error, sizeof(error));
        require(invalid_status == MAGFIT_STATUS_INVALID_ARGUMENT,
                "self-intersection must be reported as invalid input");
        require(error[0] != '\0', "invalid input must include an error message");
    }

    printf("all magfit C ABI review tests passed; band2_options=%zu "
           "band3_options=%zu full72=%d pair72=%d\n",
           single.count, observed_band3_count,
           single.saw_band2_full_72, single.saw_band2_pair_72);
    return EXIT_SUCCESS;
}
