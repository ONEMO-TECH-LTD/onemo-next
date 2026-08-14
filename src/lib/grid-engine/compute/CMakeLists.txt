cmake_minimum_required(VERSION 3.20)
project(onemo_grid_engine_track2 LANGUAGES CXX)

enable_testing()

set(BOOST_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/dependencies/boost")
set(BOOST_HEADER_DIRS
  "${BOOST_ROOT}/libs/assert/include"
  "${BOOST_ROOT}/libs/config/include"
  "${BOOST_ROOT}/libs/core/include"
  "${BOOST_ROOT}/libs/integer/include"
  "${BOOST_ROOT}/libs/mpl/include"
  "${BOOST_ROOT}/libs/multiprecision/include"
  "${BOOST_ROOT}/libs/preprocessor/include"
  "${BOOST_ROOT}/libs/static_assert/include"
  "${BOOST_ROOT}/libs/throw_exception/include"
  "${BOOST_ROOT}/libs/type_traits/include"
)

add_subdirectory(package track2-package)
target_include_directories(onemo_magnetic SYSTEM PUBLIC ${BOOST_HEADER_DIRS})

if(EMSCRIPTEN)
  add_executable(onemo-magnetic-wasm wasm-entry.cpp)
  target_link_libraries(onemo-magnetic-wasm PRIVATE onemo_magnetic)
  target_link_options(onemo-magnetic-wasm PRIVATE
    "--no-entry"
    "-sMODULARIZE=1"
    "-sEXPORT_ES6=1"
    "-sENVIRONMENT=web,worker,node"
    "-sALLOW_MEMORY_GROWTH=1"
    "-sFILESYSTEM=0"
    "-sEXPORTED_FUNCTIONS=['_onemo_magnetic_solve_json','_onemo_magnetic_free','_onemo_magnetic_version','_malloc','_free']"
    "-sEXPORTED_RUNTIME_METHODS=['HEAPU8']"
  )
  set_target_properties(onemo-magnetic-wasm PROPERTIES
    OUTPUT_NAME "onemo-magnetic"
    SUFFIX ".mjs"
  )
endif()
