cmake_minimum_required(VERSION 3.16)
project(VectorDB LANGUAGES CXX VERSION 1.0.0)

add_executable(db main.cpp)

# Require C++17 standard
target_compile_features(db PRIVATE cxx_std_17)

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

