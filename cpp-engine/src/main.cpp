#include "geometry.hpp"
#include "recognizer.hpp"
#include <iostream>
#include <string>
#include <sstream>
#include <vector>
#include <regex>

using namespace airdoodle;

// Helper to extract a string field from simple flat JSON
static std::string extractField(const std::string& json, const std::string& key) {
    std::regex pattern("\"" + key + "\"\\s*:\\s*\"([^\"]*)\"");
    std::smatch match;
    if (std::regex_search(json, match, pattern) && match.size() > 1) {
        return match[1].str();
    }
    return "";
}

// Helper to extract points array: [{"x": 10, "y": 20}, ...]
static std::vector<Point> extractPoints(const std::string& json) {
    std::vector<Point> points;
    std::regex ptPattern(R"(\{\s*"x"\s*:\s*(-?[\d.]+)\s*,\s*"y"\s*:\s*(-?[\d.]+)\s*\})");
    auto words_begin = std::sregex_iterator(json.begin(), json.end(), ptPattern);
    auto words_end = std::sregex_iterator();

    for (std::sregex_iterator i = words_begin; i != words_end; ++i) {
        std::smatch match = *i;
        if (match.size() >= 3) {
            double x = std::stod(match[1].str());
            double y = std::stod(match[2].str());
            points.push_back({x, y});
        }
    }
    return points;
}

int main() {
    // Diagnostic logging goes strictly to stderr
    std::cerr << "[AirDoodle C++ Geometry Engine] Subprocess initialized and listening on stdin." << std::endl;

    std::string line;
    while (std::getline(std::cin, line)) {
        if (line.empty()) continue;

        const std::string id = extractField(line, "id");
        const std::string action = extractField(line, "action");

        if (action == "ping") {
            std::cout << "{\"id\":\"" << id << "\",\"success\":true,\"result\":{\"status\":\"ok\",\"version\":\"C++17 Engine 1.0\"}}\n" << std::flush;
            continue;
        }

        if (action == "recognize") {
            const auto points = extractPoints(line);
            if (points.size() < 2) {
                std::cout << "{\"id\":\"" << id << "\",\"success\":false,\"error\":\"Insufficient points for recognition\"}\n" << std::flush;
                continue;
            }

            const auto shape = recognizeStroke(points);
            std::ostringstream ss;
            ss << "{\"id\":\"" << id << "\",\"success\":true,\"result\":{";
            ss << "\"type\":\"" << shape.type << "\",";
            ss << "\"geometry\":{";

            if (shape.type == "line") {
                ss << "\"x1\":" << shape.x1 << ",\"y1\":" << shape.y1 << ",\"x2\":" << shape.x2 << ",\"y2\":" << shape.y2;
            } else if (shape.type == "circle") {
                ss << "\"cx\":" << shape.cx << ",\"cy\":" << shape.cy << ",\"r\":" << shape.r;
            } else if (shape.type == "triangle") {
                ss << "\"points\":[[";
                ss << shape.trianglePoints[0].x << "," << shape.trianglePoints[0].y << "],[";
                ss << shape.trianglePoints[1].x << "," << shape.trianglePoints[1].y << "],[";
                ss << shape.trianglePoints[2].x << "," << shape.trianglePoints[2].y << "]]";
            } else { // rectangle
                ss << "\"x\":" << shape.x << ",\"y\":" << shape.y << ",\"width\":" << shape.width << ",\"height\":" << shape.height;
            }
            ss << "}}}\n";
            std::cout << ss.str() << std::flush;
            continue;
        }

        if (action == "bounds") {
            const auto points = extractPoints(line);
            const auto bounds = calculateBounds(points);
            std::cout << "{\"id\":\"" << id << "\",\"success\":true,\"result\":{\"x\":" << bounds.x << ",\"y\":" << bounds.y << ",\"width\":" << bounds.width << ",\"height\":" << bounds.height << "}}\n" << std::flush;
            continue;
        }

        if (action == "distance") {
            const auto points = extractPoints(line);
            if (points.size() >= 3) {
                double dist = pointToSegmentDistance(points[0], points[1], points[2]);
                std::cout << "{\"id\":\"" << id << "\",\"success\":true,\"result\":{\"distance\":" << dist << "}}\n" << std::flush;
            } else {
                std::cout << "{\"id\":\"" << id << "\",\"success\":false,\"error\":\"Expected 3 points: target point and 2 segment endpoints\"}\n" << std::flush;
            }
            continue;
        }

        if (action == "intersect") {
            const auto points = extractPoints(line);
            if (points.size() >= 4) {
                bool inter = segmentsIntersect(points[0], points[1], points[2], points[3]);
                std::cout << "{\"id\":\"" << id << "\",\"success\":true,\"result\":{\"intersects\":" << (inter ? "true" : "false") << "}}\n" << std::flush;
            } else {
                std::cout << "{\"id\":\"" << id << "\",\"success\":false,\"error\":\"Expected 4 points: 2 for segment A, 2 for segment B\"}\n" << std::flush;
            }
            continue;
        }

        // Unknown action fallback
        std::cout << "{\"id\":\"" << id << "\",\"success\":false,\"error\":\"Unknown action: " << action << "\"}\n" << std::flush;
    }

    std::cerr << "[AirDoodle C++ Geometry Engine] Standard input EOF encountered. Exiting cleanly." << std::endl;
    return 0;
}
