cmake_minimum_required(VERSION 3.10)
project(AirDoodleGeometryEngine CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(include src)

add_executable(airdoodle-geometry
    src/main.cpp
    src/geometry.cpp
    src/recognizer.cpp
)

enable_testing()
add_executable(test_geometry
    tests/test_geometry.cpp
    src/geometry.cpp
    src/recognizer.cpp
)
add_test(NAME RunGeometryTests COMMAND test_geometry)
