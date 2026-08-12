em++ -O3 -flto -std=c++20 \
  -Iinclude src/magfit.cpp src/magfit_c.cpp \
  -sMODULARIZE=1 -sEXPORT_ES6=1 \
  -sENVIRONMENT=web,worker \
  -sEXPORTED_FUNCTIONS='[
    "_magfit_engine_version",
    "_magfit_default_policy",
    "_magfit_solve_band_i32",
    "_malloc",
    "_free"
  ]' \
  -o magfit.js
