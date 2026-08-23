cmake_minimum_required(VERSION 3.20)
project(onemo_magnetic_engine VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(onemo_magnetic STATIC
  src/engine.cpp
  src/c_api.cpp
)
target_include_directories(onemo_magnetic PUBLIC include)
target_compile_definitions(onemo_magnetic PRIVATE ONEMO_MAGNETIC_BUILD)
set_target_properties(onemo_magnetic PROPERTIES POSITION_INDEPENDENT_CODE ON)

if(MSVC)
  target_compile_options(onemo_magnetic PRIVATE /W4 /permissive-)
else()
  target_compile_options(onemo_magnetic PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wshadow)
endif()

add_executable(onemo-magnetic-cli src/cli.cpp)
target_link_libraries(onemo-magnetic-cli PRIVATE onemo_magnetic)

add_executable(onemo-magnetic-tests tests/test_engine.cpp)
target_link_libraries(onemo-magnetic-tests PRIVATE onemo_magnetic)

enable_testing()
add_test(NAME onemo-magnetic-tests COMMAND onemo-magnetic-tests)
