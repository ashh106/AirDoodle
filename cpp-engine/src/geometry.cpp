#include "geometry.hpp"
#include <algorithm>
#include <limits>

namespace airdoodle {

constexpr double PI = 3.14159265358979323846;

double distance(const Point& a, const Point& b) {
    return std::hypot(a.x - b.x, a.y - b.y);
}

double pointToSegmentDistance(const Point& p, const Point& v, const Point& w) {
    const double l2 = (w.x - v.x) * (w.x - v.x) + (w.y - v.y) * (w.y - v.y);
    if (l2 == 0.0) return distance(p, v);
    const double t = std::max(0.0, std::min(1.0, ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2));
    const Point projection{v.x + t * (w.x - v.x), v.y + t * (w.y - v.y)};
    return distance(p, projection);
}

static int orientation(const Point& p, const Point& q, const Point& r) {
    const double val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
    if (std::abs(val) < 1e-9) return 0; // colinear
    return (val > 0.0) ? 1 : 2; // clock or counterclock wise
}

static bool onSegment(const Point& p, const Point& q, const Point& r) {
    return q.x <= std::max(p.x, r.x) && q.x >= std::min(p.x, r.x) &&
           q.y <= std::max(p.y, r.y) && q.y >= std::min(p.y, r.y);
}

bool segmentsIntersect(const Point& p1, const Point& q1, const Point& p2, const Point& q2) {
    const int o1 = orientation(p1, q1, p2);
    const int o2 = orientation(p1, q1, q2);
    const int o3 = orientation(p2, q2, p1);
    const int o4 = orientation(p2, q2, q1);

    // General case
    if (o1 != o2 && o3 != o4) return true;

    // Special Cases
    if (o1 == 0 && onSegment(p1, p2, q1)) return true;
    if (o2 == 0 && onSegment(p1, q2, q1)) return true;
    if (o3 == 0 && onSegment(p2, p1, q2)) return true;
    if (o4 == 0 && onSegment(p2, q1, q2)) return true;

    return false;
}

Point translatePoint(const Point& p, double dx, double dy) {
    return {p.x + dx, p.y + dy};
}

Point rotatePoint(const Point& p, const Point& center, double degrees) {
    const double radians = degrees * PI / 180.0;
    const double cosA = std::cos(radians);
    const double sinA = std::sin(radians);
    const double dx = p.x - center.x;
    const double dy = p.y - center.y;
    return {
        center.x + dx * cosA - dy * sinA,
        center.y + dx * sinA + dy * cosA
    };
}

Point scalePoint(const Point& p, const Point& origin, double sx, double sy) {
    return {
        origin.x + (p.x - origin.x) * sx,
        origin.y + (p.y - origin.y) * sy
    };
}

BoundingBox calculateBounds(const std::vector<Point>& points) {
    if (points.empty()) return {0, 0, 0, 0};

    double minX = std::numeric_limits<double>::infinity();
    double maxX = -std::numeric_limits<double>::infinity();
    double minY = std::numeric_limits<double>::infinity();
    double maxY = -std::numeric_limits<double>::infinity();

    for (const auto& p : points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    }

    return {minX, minY, maxX - minX, maxY - minY};
}

bool pointInRect(const Point& p, const BoundingBox& rect) {
    return p.x >= rect.x && p.x <= rect.x + rect.width &&
           p.y >= rect.y && p.y <= rect.y + rect.height;
}

bool pointInCircle(const Point& p, const Point& center, double radius) {
    return distance(p, center) <= radius;
}

static double sign(const Point& p1, const Point& p2, const Point& p3) {
    return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
}

bool pointInTriangle(const Point& pt, const Point& v1, const Point& v2, const Point& v3) {
    const double d1 = sign(pt, v1, v2);
    const double d2 = sign(pt, v2, v3);
    const double d3 = sign(pt, v3, v1);

    const bool has_neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
    const bool has_pos = (d1 > 0) || (d2 > 0) || (d3 > 0);

    return !(has_neg && has_pos);
}

} // namespace airdoodle
