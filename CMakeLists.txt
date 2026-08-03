cmake_minimum_required(VERSION 3.16)
project(VectorDB LANGUAGES CXX VERSION 1.0.0)

# Require C++17 standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(db
    main.cpp
    distance.cpp
    brute_force.cpp
    kd_tree.cpp
    hnsw.cpp
)

# Include current directory for httplib.h
target_include_directories(db PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})

# Compiler warning flags (without -Werror)
if(MSVC)
    target_compile_options(db PRIVATE /W4)
else()
    target_compile_options(db PRIVATE -Wall -Wextra -Wpedantic)
endif()

# Platform-specific dependencies
if(WIN32)
    target_link_libraries(db PRIVATE ws2_32)
else()
    find_package(Threads REQUIRED)
    target_link_libraries(db PRIVATE Threads::Threads)
endif()

# =====================================================================
#  UNIT TESTING SUPPORT (GoogleTest + CTest)
# =====================================================================

include(FetchContent)
FetchContent_Declare(
  googletest
  URL https://github.com/google/googletest/archive/refs/tags/v1.14.0.zip
)
# For Windows MSVC runtime settings compatibility
set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(googletest)

enable_testing()

add_executable(unit_tests
    tests/test_distance.cpp
    tests/test_bruteforce.cpp
    tests/test_kdtree.cpp
    tests/test_hnsw.cpp
    tests/test_edgecases.cpp
    tests/test_concurrency.cpp
    tests/test_v1_api.cpp
    distance.cpp
    brute_force.cpp
    kd_tree.cpp
    hnsw.cpp
)

target_include_directories(unit_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})

if(MSVC)
    target_compile_options(unit_tests PRIVATE /W4)
else()
    target_compile_options(unit_tests PRIVATE -Wall -Wextra)
endif()

if(WIN32)
    target_link_libraries(unit_tests PRIVATE gtest_main ws2_32)
else()
    find_package(Threads REQUIRED)
    target_link_libraries(unit_tests PRIVATE gtest_main Threads::Threads)
endif()

include(GoogleTest)
gtest_discover_tests(unit_tests)
