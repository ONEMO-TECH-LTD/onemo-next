#pragma once

#include <stddef.h>

#if defined(_WIN32) && defined(ONEMO_MAGNETIC_SHARED)
  #if defined(ONEMO_MAGNETIC_BUILD)
    #define ONEMO_MAGNETIC_API __declspec(dllexport)
  #else
    #define ONEMO_MAGNETIC_API __declspec(dllimport)
  #endif
#else
  #define ONEMO_MAGNETIC_API
#endif

#ifdef __cplusplus
extern "C" {
#endif

/*
 * Executes one complete cold solve. The returned UTF-8 buffer is always a
 * canonical result or error JSON document and is not NUL-terminated by
 * contract. Release it with onemo_magnetic_free().
 */
ONEMO_MAGNETIC_API char* onemo_magnetic_solve_json(
    const char* request_utf8,
    size_t request_size,
    size_t* result_size);

ONEMO_MAGNETIC_API void onemo_magnetic_free(void* buffer);

ONEMO_MAGNETIC_API const char* onemo_magnetic_version(void);

#ifdef __cplusplus
}
#endif
