#include "onemo/engine.hpp"

#include <fstream>
#include <iostream>
#include <iterator>
#include <stdexcept>
#include <string>

int main(int argc, char** argv) {
  try {
    if (argc > 2) {
      std::cerr << "usage: onemo-magnetic-cli [request.json]\n";
      return 2;
    }
    std::string request;
    if (argc == 2) {
      std::ifstream input(argv[1], std::ios::binary);
      if (!input) throw std::runtime_error("cannot open request file");
      request.assign(std::istreambuf_iterator<char>(input), std::istreambuf_iterator<char>());
    } else {
      request.assign(std::istreambuf_iterator<char>(std::cin), std::istreambuf_iterator<char>());
    }
    const std::string result = onemo::magnetic::solve_json(request);
    std::cout.write(result.data(), static_cast<std::streamsize>(result.size()));
    std::cout.put('\n');
    return result.find("\"status\":\"ok\"") != std::string::npos ? 0 : 1;
  } catch (const std::exception& error) {
    std::cerr << error.what() << '\n';
    return 2;
  }
}
