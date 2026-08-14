#include "onemo/c_api.h"

#include "onemo/engine.hpp"

#include <cstdlib>
#include <cstring>
#include <string>
#include <string_view>

extern "C" {

char* onemo_magnetic_solve_json(
    const char* request_utf8,
    size_t request_size,
    size_t* result_size) {
  if (result_size == nullptr) return nullptr;
  const std::string_view request = request_utf8 == nullptr
      ? std::string_view()
      : std::string_view(request_utf8, request_size);
  const std::string result = onemo::magnetic::solve_json(request);
  char* buffer = static_cast<char*>(std::malloc(result.size()));
  if (buffer == nullptr && !result.empty()) {
    *result_size = 0;
    return nullptr;
  }
  if (!result.empty()) std::memcpy(buffer, result.data(), result.size());
  *result_size = result.size();
  return buffer;
}

void onemo_magnetic_free(void* buffer) {
  std::free(buffer);
}

const char* onemo_magnetic_version(void) {
  return "1.0.0";
}

}  // extern "C"
