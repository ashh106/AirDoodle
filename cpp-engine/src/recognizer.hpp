#pragma once

#include "geometry.hpp"
#include <string>
#include <vector>

namespace airdoodle {

struct RecognizedShape {
    std::string type; // "line", "rectangle", "circle", "triangle"
    // Geometry values
    double x1{0.0}, y1{0.0}, x2{0.0}, y2{0.0}; // for line
    double x{0.0}, y{0.0}, width{0.0}, height{0.0}; // for rectangle
    double cx{0.0}, cy{0.0}, r{0.0}; // for circle
    std::vector<Point> trianglePoints; // for triangle
};

RecognizedShape recognizeStroke(const std::vector<Point>& points);

} // namespace airdoodle
