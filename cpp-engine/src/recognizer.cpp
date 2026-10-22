#include "recognizer.hpp"
#include <cmath>
#include <algorithm>
#include <vector>

namespace airdoodle {

// Computes polygon signed area using Shoelace formula
static double polygonArea(const std::vector<Point>& points) {
    if (points.size() < 3) return 0.0;
    double area = 0.0;
    size_t n = points.size();
    for (size_t i = 0; i < n; ++i) {
        size_t j = (i + 1) % n;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }
    return std::abs(area) / 2.0;
}

// Distance from point to 4 edges of an axis-aligned bounding box
static double distanceToRectEdges(const Point& p, const BoundingBox& b) {
    Point tl{b.x, b.y};
    Point tr{b.x + b.width, b.y};
    Point br{b.x + b.width, b.y + b.height};
    Point bl{b.x, b.y + b.height};

    double d1 = pointToSegmentDistance(p, tl, tr);
    double d2 = pointToSegmentDistance(p, tr, br);
    double d3 = pointToSegmentDistance(p, br, bl);
    double d4 = pointToSegmentDistance(p, bl, tl);

    return std::min({d1, d2, d3, d4});
}

// Distance from point to 3 edges of a triangle
static double distanceToTriangleEdges(const Point& p, const std::vector<Point>& tri) {
    if (tri.size() < 3) return 1e9;
    double d1 = pointToSegmentDistance(p, tri[0], tri[1]);
    double d2 = pointToSegmentDistance(p, tri[1], tri[2]);
    double d3 = pointToSegmentDistance(p, tri[2], tri[0]);
    return std::min({d1, d2, d3});
}

RecognizedShape recognizeStroke(const std::vector<Point>& points) {
    RecognizedShape shape;
    shape.type = "unknown";

    if (points.size() < 2) {
        return shape;
    }

    const BoundingBox bounds = calculateBounds(points);
    const Point start = points.front();
    const Point end = points.back();
    const double directDist = distance(start, end);
    const double diag = std::hypot(bounds.width, bounds.height);

    if (diag < 10.0) {
        return shape; // Insignificant movement
    }

    // Compute total trajectory path length
    double totalPathLength = 0.0;
    for (size_t i = 1; i < points.size(); ++i) {
        totalPathLength += distance(points[i], points[i - 1]);
    }

    if (totalPathLength < 10.0) {
        return shape;
    }

    const bool isClosed = (directDist / std::max(diag, 1.0) < 0.28) || (directDist < 40.0);

    // =========================================================================
    // 1. Line detection:
    // Straight path (totalPathLength vs directDist < 1.15), spans the bounds, and is NOT closed.
    // =========================================================================
    if (!isClosed && directDist > 20.0 && (totalPathLength / directDist) < 1.16 && (directDist / diag) > 0.82) {
        shape.type = "line";
        shape.x1 = start.x;
        shape.y1 = start.y;
        shape.x2 = end.x;
        shape.y2 = end.y;
        return shape;
    }

    // For 2D shapes (Circle, Rectangle, Triangle), stroke must be closed!
    if (!isClosed) {
        return shape;
    }

    const double centerX = bounds.x + bounds.width / 2.0;
    const double centerY = bounds.y + bounds.height / 2.0;
    const double expectedRadius = (bounds.width + bounds.height) / 4.0;
    const double maxDim = std::max(bounds.width, bounds.height);
    const double minDim = std::min(bounds.width, bounds.height);
    const double aspectDiff = maxDim > 0.0 ? (maxDim - minDim) / maxDim : 1.0;

    // Compute radial distances from centroid
    double sumDist = 0.0;
    double minR = 1e9, maxR = 0.0;
    for (const auto& p : points) {
        double d = std::hypot(p.x - centerX, p.y - centerY);
        sumDist += d;
        if (d < minR) minR = d;
        if (d > maxR) maxR = d;
    }
    const double meanRadius = points.empty() ? 0.0 : sumDist / points.size();

    double sumSqDiff = 0.0;
    for (const auto& p : points) {
        double d = std::hypot(p.x - centerX, p.y - centerY);
        sumSqDiff += (d - meanRadius) * (d - meanRadius);
    }
    const double stdDevRadius = points.empty() ? 0.0 : std::sqrt(sumSqDiff / points.size());
    const double radialCV = meanRadius > 0.0 ? (stdDevRadius / meanRadius) : 1.0;
    const double radialRatio = minR > 0.0 ? (maxR / minR) : 2.0;

    // Compute circularity via Shoelace area vs perimeter
    const double area = polygonArea(points);
    const double bboxArea = bounds.width * bounds.height;
    const double fillRatio = bboxArea > 0.0 ? (area / bboxArea) : 0.0;
    const double circularity = totalPathLength > 0.0 ? (4.0 * 3.141592653589793 * area) / (totalPathLength * totalPathLength) : 0.0;

    // =========================================================================
    // 2. Circle detection:
    // Radial distances are remarkably constant (CV < 0.10, max/min ratio < 1.25),
    // balanced aspect ratio (< 0.22), circularity > 0.70.
    // (A square has max/min ratio >= 1.414, so it will not match here).
    // =========================================================================
    if (points.size() >= 8 && aspectDiff <= 0.22 && radialCV < 0.10 && radialRatio < 1.25 && circularity > 0.70) {
        shape.type = "circle";
        shape.cx = centerX;
        shape.cy = centerY;
        shape.r = expectedRadius;
        return shape;
    }

    // =========================================================================
    // 3. Triangle detection:
    // Closed shape with 3 dominant peaks / apex vertex profile.
    // Fill ratio is typically ~0.5 (between 0.30 and 0.68).
    // =========================================================================
    if (bounds.width > 20.0 && bounds.height > 20.0 && points.size() >= 4 && fillRatio <= 0.70) {
        int upperPoints = 0;
        int lowerPoints = 0;
        for (const auto& p : points) {
            if (p.y < bounds.y + bounds.height * 0.35) upperPoints++;
            if (p.y > bounds.y + bounds.height * 0.65) lowerPoints++;
        }

        std::vector<Point> candidateTri;
        if (upperPoints <= 2 && lowerPoints >= 2) {
            // Apex Up
            candidateTri = {
                {centerX, bounds.y},
                {bounds.x + bounds.width, bounds.y + bounds.height},
                {bounds.x, bounds.y + bounds.height}
            };
        } else if (lowerPoints <= 2 && upperPoints >= 2) {
            // Apex Down
            candidateTri = {
                {bounds.x, bounds.y},
                {bounds.x + bounds.width, bounds.y},
                {centerX, bounds.y + bounds.height}
            };
        }

        if (!candidateTri.empty()) {
            double totalTriDist = 0.0;
            for (const auto& p : points) {
                totalTriDist += distanceToTriangleEdges(p, candidateTri);
            }
            double avgTriDist = totalTriDist / points.size();

            if ((avgTriDist / diag) < 0.10) {
                shape.type = "triangle";
                shape.trianglePoints = candidateTri;
                return shape;
            }
        }
    }

    // =========================================================================
    // 4. Rectangle detection:
    // Closed shape covering all 4 quadrants of the bounding box and hugging the perimeter.
    // =========================================================================
    if (bounds.width > 20.0 && bounds.height > 20.0) {
        bool hasTopLeft = false, hasTopRight = false, hasBottomRight = false, hasBottomLeft = false;
        const double marginX = bounds.width * 0.38;
        const double marginY = bounds.height * 0.38;
        for (const auto& p : points) {
            if (p.x <= bounds.x + marginX && p.y <= bounds.y + marginY) hasTopLeft = true;
            if (p.x >= bounds.x + bounds.width - marginX && p.y <= bounds.y + marginY) hasTopRight = true;
            if (p.x >= bounds.x + bounds.width - marginX && p.y >= bounds.y + bounds.height - marginY) hasBottomRight = true;
            if (p.x <= bounds.x + marginX && p.y >= bounds.y + bounds.height - marginY) hasBottomLeft = true;
        }

        if (hasTopLeft && hasTopRight && hasBottomRight && hasBottomLeft) {
            double totalRectDist = 0.0;
            for (const auto& p : points) {
                totalRectDist += distanceToRectEdges(p, bounds);
            }
            double avgRectDist = totalRectDist / points.size();

            // High geometric fit to rectangle boundary
            if ((avgRectDist / diag) < 0.10) {
                shape.type = "rectangle";
                shape.x = bounds.x;
                shape.y = bounds.y;
                shape.width = bounds.width;
                shape.height = bounds.height;
                return shape;
            }
        }
    }

    // If ambiguous, return unknown rather than guessing
    shape.type = "unknown";
    return shape;
}

} // namespace airdoodle
