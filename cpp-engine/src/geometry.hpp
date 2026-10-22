#pragma once

#include <vector>
#include <string>
#include <cmath>

namespace airdoodle {

struct Point {
    double x{0.0};
    double y{0.0};
};

struct BoundingBox {
    double x{0.0};
    double y{0.0};
    double width{0.0};
    double height{0.0};
};

// Euclidean distance between two points
double distance(const Point& a, const Point& b);

// Distance from point p to segment [v, w]
double pointToSegmentDistance(const Point& p, const Point& v, const Point& w);

// Check if two line segments (p1-q1) and (p2-q2) intersect
bool segmentsIntersect(const Point& p1, const Point& q1, const Point& p2, const Point& q2);

// Affine Transformations
Point translatePoint(const Point& p, double dx, double dy);
Point rotatePoint(const Point& p, const Point& center, double degrees);
Point scalePoint(const Point& p, const Point& origin, double sx, double sy);

// Bounding box from points
BoundingBox calculateBounds(const std::vector<Point>& points);

// Hit testing
bool pointInRect(const Point& p, const BoundingBox& rect);
bool pointInCircle(const Point& p, const Point& center, double radius);
bool pointInTriangle(const Point& p, const Point& a, const Point& b, const Point& c);

} // namespace airdoodle
