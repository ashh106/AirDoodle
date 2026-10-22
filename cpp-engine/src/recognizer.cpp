#include "recognizer.hpp"
#include <cmath>
#include <algorithm>
#include <vector>

namespace airdoodle {

RecognizedShape recognizeStroke(const std::vector<Point>& points) {
    RecognizedShape shape;
    if (points.size() < 2) {
        shape.type = "unknown";
        return shape;
    }

    const BoundingBox bounds = calculateBounds(points);
    const Point start = points.front();
    const Point end = points.back();
    const double directDist = distance(start, end);

    // Compute total trajectory path length
    double totalPathLength = 0.0;
    for (size_t i = 1; i < points.size(); ++i) {
        totalPathLength += distance(points[i], points[i - 1]);
    }

    if (totalPathLength < 5.0) {
        shape.type = "unknown";
        return shape;
    }

    const double perimeterEstimate = 2.0 * (bounds.width + bounds.height);
    const bool isClosed = directDist < (bounds.width + bounds.height) * 0.28 || directDist < 45.0;

    // 1. Line detection:
    // If the path length is very close to the Euclidean distance between start and end (straight trajectory),
    // and endpoints are not closed together.
    if (directDist > 15.0 && (totalPathLength / directDist) < 1.18 && !isClosed) {
        shape.type = "line";
        shape.x1 = start.x;
        shape.y1 = start.y;
        shape.x2 = end.x;
        shape.y2 = end.y;
        return shape;
    }

    // Centroid of bounding box
    const double centerX = bounds.x + bounds.width / 2.0;
    const double centerY = bounds.y + bounds.height / 2.0;
    const double expectedRadius = (bounds.width + bounds.height) / 4.0;

    // Compute radial distances and variance from centroid
    double sumDist = 0.0;
    double sumSqDiff = 0.0;
    for (const auto& p : points) {
        double d = std::hypot(p.x - centerX, p.y - centerY);
        sumDist += d;
    }
    const double meanRadius = points.empty() ? 0.0 : sumDist / points.size();
    for (const auto& p : points) {
        double d = std::hypot(p.x - centerX, p.y - centerY);
        sumSqDiff += (d - meanRadius) * (d - meanRadius);
    }
    const double stdDevRadius = points.empty() ? 0.0 : std::sqrt(sumSqDiff / points.size());
    const double radialCoefficientOfVariation = meanRadius > 0.0 ? (stdDevRadius / meanRadius) : 1.0;

    // 2. Circle detection:
    // Stroke must be relatively closed, aspect ratio balanced, and have low radial variance from center.
    const double maxDim = std::max(bounds.width, bounds.height);
    const double minDim = std::min(bounds.width, bounds.height);
    const double aspectDiff = maxDim > 0.0 ? (maxDim - minDim) / maxDim : 1.0;

    if (isClosed && points.size() >= 8 && aspectDiff <= 0.28 && radialCoefficientOfVariation < 0.16) {
        shape.type = "circle";
        shape.cx = centerX;
        shape.cy = centerY;
        shape.r = expectedRadius;
        return shape;
    }

    // 3. Rectangle detection:
    // Closed shape covering 4 bounding box quadrants
    if (isClosed && bounds.width > 15.0 && bounds.height > 15.0) {
        bool hasTopLeft = false, hasTopRight = false, hasBottomRight = false, hasBottomLeft = false;
        const double marginX = bounds.width * 0.45;
        const double marginY = bounds.height * 0.45;
        for (const auto& p : points) {
            if (p.x <= bounds.x + marginX && p.y <= bounds.y + marginY) hasTopLeft = true;
            if (p.x >= bounds.x + bounds.width - marginX && p.y <= bounds.y + marginY) hasTopRight = true;
            if (p.x >= bounds.x + bounds.width - marginX && p.y >= bounds.y + bounds.height - marginY) hasBottomRight = true;
            if (p.x <= bounds.x + marginX && p.y >= bounds.y + bounds.height - marginY) hasBottomLeft = true;
        }

        if (hasTopLeft && hasTopRight && hasBottomRight && hasBottomLeft) {
            shape.type = "rectangle";
            shape.x = bounds.x;
            shape.y = bounds.y;
            shape.width = bounds.width;
            shape.height = bounds.height;
            return shape;
        }
    }

    // 4. Triangle detection:
    // Closed shape with 3 dominant corners / apex profile
    if (isClosed && points.size() >= 4 && bounds.height > 20.0 && bounds.width > 20.0) {
        int upperPoints = 0;
        int lowerPoints = 0;
        for (const auto& p : points) {
            if (p.y < bounds.y + bounds.height * 0.35) upperPoints++;
            if (p.y > bounds.y + bounds.height * 0.65) lowerPoints++;
        }

        if ((upperPoints <= 2 && lowerPoints >= 2) || (lowerPoints <= 2 && upperPoints >= 2)) {
            shape.type = "triangle";
            if (upperPoints <= lowerPoints) {
                // Apex up
                shape.trianglePoints = {
                    {centerX, bounds.y},
                    {bounds.x + bounds.width, bounds.y + bounds.height},
                    {bounds.x, bounds.y + bounds.height}
                };
            } else {
                // Apex down
                shape.trianglePoints = {
                    {bounds.x, bounds.y},
                    {bounds.x + bounds.width, bounds.y},
                    {centerX, bounds.y + bounds.height}
                };
            }
            return shape;
        }
    }

    // If ambiguous, return unknown rather than forcing a circle or rectangle
    shape.type = "unknown";
    return shape;
}

} // namespace airdoodle

