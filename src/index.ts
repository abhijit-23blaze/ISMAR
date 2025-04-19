// src/index.ts

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from 'url'; // <-- Import fileURLToPath

// Define types locally (Unchanged)
// ... (interfaces Resource, ResourceContent, PromptMessage, enum LoggingLevel) ...
interface Resource { uri: string; name: string; description: string; mimeType: string; }
interface ResourceContent { uri: string; mimeType: string; text: string; }
interface PromptMessage { role: string; content: { type: string; text: string; }; }
enum LoggingLevel { Debug = "debug", Info = "info", Warning = "warning", Error = "error" }


// --- Type Definitions (Unchanged) ---
// ... (FrameDataSchema, FrameData, etc.) ...
const JointNameSchema = z.string();
const RelativeDistanceMatrixSchema = z.record(JointNameSchema, z.record(JointNameSchema, z.number()));
const FrameDataSchema = z.object({
    timestamp: z.string().datetime({ offset: true }).or(z.number()),
    relative_distance_matrix: RelativeDistanceMatrixSchema.optional(),
    matrix_size: z.number().int().nonnegative(),
    available_joints: z.array(JointNameSchema),
    player_height: z.number().nonnegative(),
    game_state: z.string().nullable(),
});
type FrameData = z.infer<typeof FrameDataSchema>;
type RelativeDistanceMatrix = z.infer<typeof RelativeDistanceMatrixSchema>;
type IdealPosesData = { [poseName: string]: FrameData; };
type PoseAnalysisResult = { accuracy: number; feedback: string[]; mainDeviations: string[]; };
type PaceAnalysisResult = { paceFeedback: string; benefits: string[]; potentialHarms: string[]; };

// --- Configuration & Data Loading ---

// --- FIX for __dirname ---
// Get the directory name of the current module file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// --- End FIX ---

const IDEAL_POSES_PATH = path.join(__dirname, 'ideal_poses.json'); // Use the calculated __dirname
const MEDICAL_INFO_PATH = path.join(__dirname, 'yoga_medical_info.json'); // Use the calculated __dirname
const CURRENT_FRAMES_PATH = path.join(__dirname, 'current_frames.json'); // Use the calculated __dirname

let idealPoses: IdealPosesData = {};
let medicalInfo: any = { poses: [] };
let loadedFrames: FrameData[] = [];

async function loadData() {
     try {
        const idealData = await fs.readFile(IDEAL_POSES_PATH, 'utf-8');
        idealPoses = JSON.parse(idealData);
        console.error("Ideal poses loaded.");
        const medData = await fs.readFile(MEDICAL_INFO_PATH, 'utf-8');
        medicalInfo = JSON.parse(medData);
        console.error("Medical info loaded.");
        const framesData = await fs.readFile(CURRENT_FRAMES_PATH, 'utf-8');
        const parsedFrames = JSON.parse(framesData);
        if (Array.isArray(parsedFrames)) {
            loadedFrames = parsedFrames
                .map(frame => FrameDataSchema.parse(frame))
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
             console.error(`${loadedFrames.length} current frames loaded and sorted.`);
        } else { throw new Error("current_frames.json is not a valid JSON array."); }
    } catch (error) {
        console.error("Error loading data files:", error);
        loadedFrames = [];
    }
}

// --- Core Analysis Logic (Unchanged) ---
// ... (calculatePoseDeviation function as before) ...
function calculatePoseDeviation(playerFrame: FrameData, idealFrame: FrameData): PoseAnalysisResult { /* ... implementation as before ... */
     if (!playerFrame.relative_distance_matrix || !idealFrame.relative_distance_matrix || playerFrame.available_joints.length === 0) { return { accuracy: 0, feedback: ["Not enough data to analyze pose."], mainDeviations: [] }; }
    const playerMatrix = playerFrame.relative_distance_matrix; const idealMatrix = idealFrame.relative_distance_matrix;
    const playerJoints = new Set(playerFrame.available_joints); const idealJoints = new Set(idealFrame.available_joints);
    let totalDeviation = 0; let comparisons = 0; const deviations: { pair: string, diff: number }[] = [];
    for (const j1 of playerFrame.available_joints) { if (!idealJoints.has(j1)) continue;
        for (const j2 of playerFrame.available_joints) { if (j1 === j2) continue; if (!idealJoints.has(j2)) continue;
            const key1 = j1 < j2 ? j1 : j2; const key2 = j1 < j2 ? j2 : j1;
            const playerDist = playerMatrix[key1]?.[key2] ?? playerMatrix[key2]?.[key1]; const idealDist = idealMatrix[key1]?.[key2] ?? idealMatrix[key2]?.[key1];
            if (playerDist !== undefined && idealDist !== undefined && idealDist > 0) {
                const diff = Math.abs(playerDist - idealDist); const deviationPercentage = (diff / idealDist) * 100;
                totalDeviation += deviationPercentage; deviations.push({ pair: `${key1}-${key2}`, diff: deviationPercentage }); comparisons++;
            }
        }
    }
    if (comparisons === 0) { return { accuracy: 0, feedback: ["Could not compare any joint pairs."], mainDeviations: [] }; }
    const averageDeviation = totalDeviation / comparisons; const accuracy = Math.max(0, Math.min(100, 100 - averageDeviation));
    deviations.sort((a, b) => b.diff - a.diff); const topDeviations = deviations.slice(0, 3);
    const feedback: string[] = []; const mainDeviationDescriptions: string[] = [];
    if (accuracy < 70) feedback.push("Focus on the overall form and alignment."); else if (accuracy < 90) feedback.push("Good alignment! Minor adjustments needed."); else feedback.push("Excellent form! Maintain this stability.");
    topDeviations.forEach(dev => { const [joint1, joint2] = dev.pair.split('-'); const instruction = `Check the distance between your ${joint1.replace(/_/g, ' ')} and ${joint2.replace(/_/g, ' ')}.`; feedback.push(instruction); mainDeviationDescriptions.push(`${joint1}-${joint2}`); });
     if (Math.abs(playerFrame.player_height - idealFrame.player_height) > 0.1) { feedback.push(`Note: Your height (${playerFrame.player_height.toFixed(2)}m) differs from the ideal model (${idealFrame.player_height.toFixed(2)}m), which may slightly affect comparison.`); }
    return { accuracy: Math.round(accuracy), feedback: feedback.slice(0, 3), mainDeviations: mainDeviationDescriptions };
}


// Add type definitions for tool parameters
interface ListFramesParams {
    cursor?: string;
}

interface ReadFrameParams {
    uri: string;
}

interface GenerateReportParams {
    // No parameters needed for this tool
}

// --- MCP Server Setup ---
const server = new McpServer({
    name: "vr-yoga-analyzer",
    version: "1.0.0",
    capabilities: {
        resources: {},
        tools: {},
    },
});


// --- Register Tools ---
server.tool("list-frames", "List available yoga pose frames", {
    cursor: z.string().optional().describe("Pagination cursor")
}, async ({ cursor }: ListFramesParams) => {
    try {
        //console.log("Handling resources/list request");
        const resources = loadedFrames.map((frame) => ({
            uri: `frame://${frame.timestamp}`,
            name: `Frame @ ${new Date(frame.timestamp).toLocaleTimeString()}`,
            description: `Yoga pose data captured at ${frame.timestamp} (${frame.game_state || 'Unknown State'})`,
            mimeType: "application/json"
        }));

        const pageSize = 50;
        const startIndex = cursor ? parseInt(cursor, 10) : 0;
        const paginatedResources = resources.slice(startIndex, startIndex + pageSize);
        const nextCursor = (startIndex + pageSize < resources.length) ? String(startIndex + pageSize) : undefined;

        return {
            content: [{
                type: "text",
                text: JSON.stringify({ resources: paginatedResources, nextCursor }, null, 2)
            }]
        };
    } catch (error: unknown) {
        console.error("Error in list-frames:", error);
        throw new Error(`Failed to list frames: ${error instanceof Error ? error.message : String(error)}`);
    }
});

server.tool("read-frame", "Read a specific yoga pose frame", {
    uri: z.string().describe("Frame URI to read")
}, async ({ uri }: ReadFrameParams) => {
    try {
        //console.log(`Handling resources/read request for URI: ${uri}`);
        if (!uri.startsWith("frame://")) {
            throw new Error(`Unsupported resource URI scheme: ${uri}`);
        }

        const timestampStr = uri.substring("frame://".length);
        const frameTimestamp: string | number = isNaN(Number(timestampStr)) ? timestampStr : Number(timestampStr);
        const frame = loadedFrames.find(f => f.timestamp === frameTimestamp || f.timestamp === timestampStr);

        if (!frame) {
            throw new Error(`Resource not found: ${uri}`);
        }

        return {
            content: [{
                type: "text",
                text: JSON.stringify(frame, null, 2)
            }]
        };
    } catch (error: unknown) {
        console.error("Error in read-frame:", error);
        throw new Error(`Failed to read frame: ${error instanceof Error ? error.message : String(error)}`);
    }
});

server.tool("generate-session-report", "Generates a comprehensive report analyzing the entire yoga session based on stored frame data.", {}, async (_params: GenerateReportParams) => {
    try {
        //console.log(`Generating session report for ${loadedFrames.length} frames.`);
        if (loadedFrames.length === 0) {
            return {
                content: [{
                    type: "text",
                    text: "No frames available for analysis."
                }]
            };
        }

        // --- Aggregate Analysis ---
        let totalDurationSeconds = 0;
        const poseStats: { [poseName: string]: { 
            count: number; 
            countAnalyzed: number;
            countMissingJoints: number;
            totalAccuracy: number; 
            duration: number; 
            deviations: { [devPair: string]: number };
            startTime: number;
            endTime: number;
        } } = {};
        
        const allPerformedPoses = new Set<string>();
        const allBenefits = new Set<string>();
        let totalCalories = 0;
        const poseSequence: { pose: string; startTime: number; endTime: number }[] = [];
        let currentPose: { pose: string; startTime: number } | null = null;

        for (let i = 0; i < loadedFrames.length; i++) {
            const currentFrame = loadedFrames[i];
            const previousFrame = i > 0 ? loadedFrames[i - 1] : null;
            let durationSeconds = 0;

            if (previousFrame) {
                durationSeconds = (new Date(currentFrame.timestamp).getTime() - new Date(previousFrame.timestamp).getTime()) / 1000;
            } else if (loadedFrames.length === 1) {
                durationSeconds = 5;
            }

            totalDurationSeconds += durationSeconds;
            const gameState = currentFrame.game_state;

            // Track pose sequence
            if (gameState && gameState !== "Relaxed") {
                if (!currentPose || currentPose.pose !== gameState) {
                    if (currentPose) {
                        poseSequence.push({
                            pose: currentPose.pose,
                            startTime: currentPose.startTime,
                            endTime: new Date(currentFrame.timestamp).getTime()
                        });
                    }
                    currentPose = {
                        pose: gameState,
                        startTime: new Date(currentFrame.timestamp).getTime()
                    };
                }
            } else if (currentPose) {
                poseSequence.push({
                    pose: currentPose.pose,
                    startTime: currentPose.startTime,
                    endTime: new Date(currentFrame.timestamp).getTime()
                });
                currentPose = null;
            }

            if (gameState && gameState !== "Relaxed") {
                allPerformedPoses.add(gameState);
                if (!poseStats[gameState]) {
                    poseStats[gameState] = { 
                        count: 0, 
                        countAnalyzed: 0,
                        countMissingJoints: 0,
                        totalAccuracy: 0, 
                        duration: 0, 
                        deviations: {},
                        startTime: new Date(currentFrame.timestamp).getTime(),
                        endTime: new Date(currentFrame.timestamp).getTime()
                    };
                }
                
                poseStats[gameState].count++;
                poseStats[gameState].duration += durationSeconds;
                poseStats[gameState].endTime = new Date(currentFrame.timestamp).getTime();
                
                const poseInfo = medicalInfo.poses.find((p: any) => p.name === gameState);
                if (poseInfo) {
                    (poseInfo.benefits || []).forEach((b: string) => allBenefits.add(b));
                    totalCalories += (poseInfo.calories_per_minute / 60) * durationSeconds;
                }

                // Only analyze if we have joint data
                if (currentFrame.relative_distance_matrix && Object.keys(currentFrame.relative_distance_matrix).length > 0) {
                    const idealPose = idealPoses[gameState];
                    if (idealPose) {
                        const analysis = calculatePoseDeviation(currentFrame, idealPose);
                        poseStats[gameState].countAnalyzed++;
                        poseStats[gameState].totalAccuracy += analysis.accuracy;
                        analysis.mainDeviations.forEach(devPair => {
                            poseStats[gameState].deviations[devPair] = (poseStats[gameState].deviations[devPair] || 0) + 1;
                        });
                    }
                } else {
                    poseStats[gameState].countMissingJoints++;
                }
            } else {
                const poseInfo = medicalInfo.poses.find((p: any) => p.name === "Relaxed");
                if (poseInfo && durationSeconds > 0) {
                    totalCalories += (poseInfo.calories_per_minute / 60) * durationSeconds;
                }
            }
        }

        // Add the last pose if it exists
        if (currentPose) {
            poseSequence.push({
                pose: currentPose.pose,
                startTime: currentPose.startTime,
                endTime: new Date(loadedFrames[loadedFrames.length - 1].timestamp).getTime()
            });
        }

        // --- Format the Report ---
        let report = `Yoga Session Report\n=====================\n\n`;
        report += `Total Session Duration: ${Math.round(totalDurationSeconds / 60)} minutes ${Math.round(totalDurationSeconds % 60)} seconds\n`;
        report += `Estimated Calories Burned: ${totalCalories.toFixed(1)} kcal\n\n`;

        // Session Flow
        report += `Session Flow:\n------------\n`;
        poseSequence.forEach((pose, index) => {
            const duration = (pose.endTime - pose.startTime) / 1000;
            report += `${index + 1}. ${pose.pose} (${Math.round(duration)} seconds)\n`;
        });
        report += `\n`;

        // Pose Analysis
        report += `Pose Analysis:\n--------------\n`;
        const overallAccuracyScores: number[] = [];
        const allDeviations: { [devPair: string]: number } = {};

        if (Object.keys(poseStats).length > 0) {
            for (const poseName in poseStats) {
                const stats = poseStats[poseName];
                const avgAccuracy = stats.countAnalyzed > 0 ? Math.round(stats.totalAccuracy / stats.countAnalyzed) : 0;
                if (stats.countAnalyzed > 0) {
                    overallAccuracyScores.push(avgAccuracy);
                }

                report += `* ${poseName}:\n`;
                report += `  - Duration: ${Math.round(stats.duration)} seconds\n`;
                report += `  - Frames Captured: ${stats.count}\n`;
                report += `  - Frames Analyzed: ${stats.countAnalyzed}\n`;
                
                if (stats.countMissingJoints > 0) {
                    report += `  - Frames with Missing Joint Data: ${stats.countMissingJoints}\n`;
                }

                if (stats.countAnalyzed > 0) {
                    report += `  - Average Accuracy: ${avgAccuracy}%\n`;
                    const sortedDevs = Object.entries(stats.deviations).sort(([, countA], [, countB]) => countB - countA);
                    if (sortedDevs.length > 0) {
                        report += `  - Common Adjustment Needed: Distance between ${sortedDevs[0][0].replace('-', ' and ').replace(/_/g, ' ')}\n`;
                        sortedDevs.forEach(([pair, count]) => {
                            allDeviations[pair] = (allDeviations[pair] || 0) + count;
                        });
                    }
                } else {
                    report += `  - Accuracy: N/A (No frames with joint data available)\n`;
                }
                report += `\n`;
            }

            if (overallAccuracyScores.length > 0) {
                const overallAvgAccuracy = Math.round(overallAccuracyScores.reduce((a, b) => a + b, 0) / overallAccuracyScores.length);
                report += `Overall Average Pose Accuracy (Analyzed Poses): ${overallAvgAccuracy}%\n\n`;
            }

            const sortedAllDevs = Object.entries(allDeviations).sort(([, countA], [, countB]) => countB - countA);
            if (sortedAllDevs.length > 0) {
                report += `Key Areas for Improvement Across Session:\n---------------------------------------\n`;
                sortedAllDevs.slice(0, 3).forEach(([pair, count]) => {
                    report += `- Focus on the distance between ${pair.replace('-', ' and ').replace(/_/g, ' ')}\n`;
                });
                report += `\n`;
            }
        } else {
            report += "No poses were analyzed for accuracy.\n\n";
        }

        // Benefits
        report += `Potential Benefits from Poses Practiced:\n----------------------------------------\n`;
        if (allBenefits.size > 0) {
            Array.from(allBenefits).slice(0, 5).forEach(benefit => {
                report += `- ${benefit}\n`;
            });
        } else {
            report += "- General well-being and mindfulness.\n";
        }

        report += `\nRemember to listen to your body and consult a professional if needed.`;
        return {
            content: [{
                type: "text",
                text: report
            }]
        };
    } catch (error: unknown) {
        console.error("Error in generate-session-report:", error);
        throw new Error(`Failed to generate session report: ${error instanceof Error ? error.message : String(error)}`);
    }
});


// --- Server execution ---
async function main() {
    try {
        await loadData();
        if (loadedFrames.length === 0) {
            console.error("Warning: No current frames were loaded. Server might not function as expected.");
        }

        const transport = new StdioServerTransport();
        console.error("Attempting to connect MCP server via stdio...");
        
        await server.connect(transport);
        console.error("Yoga Analyzer MCP Server connected and running on stdio.");
    } catch (error: unknown) {
        console.error("Failed to connect MCP server:", error);
        process.exit(1);
    }
}

main().catch((error: unknown) => {
    console.error("Fatal error in main execution:", error);
    process.exit(1);
});