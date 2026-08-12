cmake_minimum_required(VERSION 3.20)
project(magfit_grid_pixel_proposal VERSION 0.3.0 LANGUAGES C CXX)

option(MAGFIT_BUILD_C_API "Build the stable C/Wasm boundary" ON)
option(MAGFIT_BUILD_TESTS "Build acceptance tests" ON)
option(MAGFIT_BUILD_BENCHMARKS "Build local microbenchmark" OFF)

add_library(magfit STATIC src/magfit.cpp)
add_library(magfit::magfit ALIAS magfit)
target_include_directories(magfit PUBLIC include)
target_compile_features(magfit PUBLIC cxx_std_20)
target_compile_options(magfit PRIVATE
    $<$<CXX_COMPILER_ID:GNU,Clang,AppleClang>:-Wall;-Wextra;-Wpedantic;-Werror>)
set_target_properties(magfit PROPERTIES POSITION_INDEPENDENT_CODE ON)

if(MAGFIT_BUILD_C_API)
    add_library(magfit_c STATIC src/magfit_c.cpp)
    add_library(magfit::c_api ALIAS magfit_c)
    target_link_libraries(magfit_c PUBLIC magfit)
    target_include_directories(magfit_c PUBLIC include)
    target_compile_features(magfit_c PUBLIC cxx_std_20)
    target_compile_options(magfit_c PRIVATE
        $<$<CXX_COMPILER_ID:GNU,Clang,AppleClang>:-Wall;-Wextra;-Wpedantic;-Werror>)
    set_target_properties(magfit_c PROPERTIES POSITION_INDEPENDENT_CODE ON)
endif()

if(MAGFIT_BUILD_TESTS)
    enable_testing()

    add_executable(magfit_tests tests/test_magfit.cpp)
    target_link_libraries(magfit_tests PRIVATE magfit)
    target_compile_features(magfit_tests PRIVATE cxx_std_20)
    target_compile_options(magfit_tests PRIVATE
        $<$<CXX_COMPILER_ID:GNU,Clang,AppleClang>:-Wall;-Wextra;-Wpedantic;-Werror>)
    add_test(NAME magfit_tests COMMAND magfit_tests)

    if(MAGFIT_BUILD_C_API)
        add_executable(magfit_c_tests tests/test_magfit_c.c)
        target_link_libraries(magfit_c_tests PRIVATE magfit_c)
        target_compile_options(magfit_c_tests PRIVATE
            $<$<C_COMPILER_ID:GNU,Clang,AppleClang>:-Wall;-Wextra;-Wpedantic;-Werror>)
        add_test(NAME magfit_c_tests COMMAND magfit_c_tests)
    endif()
endif()

if(MAGFIT_BUILD_BENCHMARKS)
    add_executable(magfit_bench bench/bench_magfit.cpp)
    target_link_libraries(magfit_bench PRIVATE magfit)
    target_compile_features(magfit_bench PRIVATE cxx_std_20)
    target_compile_options(magfit_bench PRIVATE
        $<$<CXX_COMPILER_ID:GNU,Clang,AppleClang>:-O3;-Wall;-Wextra;-Wpedantic;-Werror>)
endif()
