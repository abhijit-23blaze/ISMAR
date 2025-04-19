# ISMAR MCP: Medical Context Pose Analyzer

A Model Context Protocol (MCP) server for analyzing 3D vector joint data to detect and provide feedback on yoga poses, exercise form, and posture.

## Overview

This project provides a medical context analyzer for 3D vector joints that:

- Detects and tracks body postures and joint positions
- Analyzes yoga poses against ideal reference poses
- Provides feedback on pose accuracy and suggested corrections
- Generates comprehensive session reports with medical insights
- Calculates calories burned and exercise benefits

## Features

- **Real-time Pose Analysis**: Compares user poses against ideal reference poses
- **Medical Context**: Offers insights on health benefits and potential risks
- **Exercise Tracking**: Monitors pose transitions, pace, and exercise quality
- **Comprehensive Reports**: Generates detailed session summaries with metrics

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/ismar-mcp.git
cd ismar-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Usage

### Running the MCP Server

The server implements the Model Context Protocol and runs over standard I/O:

```bash
node build/index.js
```

Alternatively, use the binary directly if it's installed globally:

```bash
yoga-analyzer
```

### Available Tools

The MCP server provides the following tools:

1. **list-frames**: Lists available yoga pose frames with pagination
2. **read-frame**: Reads a specific yoga pose frame by URI
3. **generate-session-report**: Generates a comprehensive report analyzing the yoga session

### Data Files

The server requires the following data files:

- `ideal_poses.json`: Contains reference poses for various yoga positions
- `yoga_medical_info.json`: Medical information about each pose, benefits, and calorie burn rates
- `current_frames.json`: Current session frame data captured from the user

## Integration

This MCP server can be integrated with any MCP-compatible client, including:

- VR/AR applications
- Fitness tracking systems
- Telemedicine platforms
- Health monitoring applications

## Development

### Project Structure

- `src/index.ts`: Main server implementation
- `src/types.d.ts`: Type definitions
- `src/ideal_poses.json`: Reference pose data
- `src/yoga_medical_info.json`: Medical context information
- `src/current_frames.json`: Current session frame data

### Building from Source

```bash
npm run build
```

This will generate the built files in the `build` directory.

## License

ISC License

## Dependencies

- `@modelcontextprotocol/sdk`: Model Context Protocol SDK
- `zod`: Schema validation library
- TypeScript development environment 