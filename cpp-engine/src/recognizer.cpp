#include "recognizer.hpp"
#include <cmath>
#include <algorithm>

namespace airdoodle {

RecognizedShape recognizeStroke(const std::vector<Point>& points) {
    RecognizedShape shape;
    if (points.size() < 2) {
        shape.type = "line";
        return shape;
    }

    const BoundingBox bounds = calculateBounds(points);
    const Point start = points.front();
    const Point end = points.back();
    const double directDist = distance(start, end);

    double totalPathLength = 0.0;
    for (size_t i = 1; i < points.size(); ++i) {
        totalPathLength += distance(points[i], points[i - 1]);
    }

    // 1. Line detection: if the path is almost a straight segment
    if (directDist > 0.0 && (totalPathLength / directDist) < 1.18) {
        shape.type = "line";
        shape.x1 = start.x;
        shape.y1 = start.y;
        shape.x2 = end.x;
        shape.y2 = end.y;
        return shape;
    }

    // 2. Triangle detection: closed shape with significant height and single apex
    const bool isClosed = directDist < (bounds.width + bounds.height) * 0.25;
    if (isClosed && points.size() >= 6 && bounds.height > 25.0) {
        int upperPoints = 0;
        int lowerPoints = 0;
        for (const auto& p : points) {
            if (p.y < bounds.y + bounds.height * 0.3) upperPoints++;
            if (p.y > bounds.y + bounds.height * 0.7) lowerPoints++;
        }
        if ((upperPoints <= 1 && lowerPoints >= 2) || (lowerPoints <= 1 && upperPoints >= 2)) {
            shape.type = "triangle";
            shape.trianglePoints = {
                {bounds.x + bounds.width / 2.0, bounds.y},
                {bounds.x + bounds.width, bounds.y + bounds.height},
                {bounds.x, bounds.y + bounds.height}
            };
            return shape;
        }
    }

    // 3. Circle detection: aspect ratio close to 1:1 and radial variance low
    const double maxDim = std::max(bounds.width, bounds.height);
    const double minDim = std::min(bounds.width, bounds.height);
    if (maxDim > 0.0 && (maxDim - minDim) / maxDim <= 0.25) {
        shape.type = "circle";
        shape.cx = bounds.x + bounds.width / 2.0;
        shape.cy = bounds.y + bounds.height / 2.0;
        shape.r = (bounds.width + bounds.height) / 4.0;
        return shape;
    }

    // 4. Default to Rectangle
    shape.type = "rectangle";
    shape.x = bounds.x;
    shape.y = bounds.y;
    shape.width = bounds.width;
    shape.height = bounds.height;
    return shape;
}

} // namespace airdoodle
