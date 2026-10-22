#include "geometry.hpp"
#include "recognizer.hpp"
#include <iostream>
#include <cassert>

using namespace airdoodle;

void testDistance() {
    Point a{0, 0};
    Point b{3, 4};
    assert(std::abs(distance(a, b) - 5.0) < 1e-6);

    // Distance to segment
    Point p{1, 1};
    Point v{0, 0};
    Point w{2, 0};
    assert(std::abs(pointToSegmentDistance(p, v, w) - 1.0) < 1e-6);
    std::cout << "[PASS] testDistance" << std::endl;
}

void testIntersection() {
    Point a1{0, 0}, a2{4, 4};
    Point b1{0, 4}, b2{4, 0};
    assert(segmentsIntersect(a1, a2, b1, b2) == true);

    Point c1{0, 0}, c2{1, 1};
    Point d1{2, 2}, d2{3, 3};
    assert(segmentsIntersect(c1, c2, d1, d2) == false);
    std::cout << "[PASS] testIntersection" << std::endl;
}

void testTransforms() {
    Point p{10, 10};
    Point shifted = translatePoint(p, 5, -2);
    assert(shifted.x == 15 && shifted.y == 8);

    Point center{0, 0};
    Point rotated = rotatePoint(Point{10, 0}, center, 90.0);
    assert(std::abs(rotated.x - 0.0) < 1e-5 && std::abs(rotated.y - 10.0) < 1e-5);
    std::cout << "[PASS] testTransforms" << std::endl;
}

void testRecognition() {
    std::vector<Point> linePoints = {{10, 10}, {50, 10}, {100, 10}};
    auto lineShape = recognizeStroke(linePoints);
    assert(lineShape.type == "line");

    std::vector<Point> rectPoints = {
        {10, 10}, {100, 10}, {100, 50}, {10, 50}, {10, 12}
    };
    auto rectShape = recognizeStroke(rectPoints);
    assert(rectShape.type == "rectangle");
    std::cout << "[PASS] testRecognition" << std::endl;
}

int main() {
    std::cout << "Running AirDoodle C++ Geometry Engine Tests..." << std::endl;
    testDistance();
    testIntersection();
    testTransforms();
    testRecognition();
    std::cout << "All C++ Geometry Unit Tests Passed Successfully!" << std::endl;
    return 0;
}
