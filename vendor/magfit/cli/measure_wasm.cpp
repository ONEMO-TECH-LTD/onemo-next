// WASM boundary — the same measurement the CLI prints, exported as one C function so the
// measurement door can call it in any JavaScript runtime. It reuses the CLI's own request
// parsing and serialisation by including the translation unit: ONE implementation, two
// transports. No geometry, no policy, no defaults live here.

#define MEASURE_CLI_NO_MAIN 1
#include "measure_cli.cpp"

#include <cstdlib>
#include <cstring>

extern "C" {

/** JSON request in → JSON measurement out. Caller frees the result with magfit_free(). */
const char* magfit_measure_json(const char* request_json) {
    const std::string out = measure_to_json(request_json ? request_json : "");
    char* copy = static_cast<char*>(std::malloc(out.size() + 1));
    if (copy == nullptr) return nullptr;
    std::memcpy(copy, out.c_str(), out.size() + 1);
    return copy;
}

void magfit_free(const char* pointer) {
    std::free(const_cast<char*>(pointer));
}

}  // extern "C"
