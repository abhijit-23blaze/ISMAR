declare module "@modelcontextprotocol/sdk" {
    export interface Resource {
        uri: string;
        name: string;
        description: string;
        mimeType: string;
    }

    export interface ResourceContent {
        uri: string;
        mimeType: string;
        text: string;
    }

    export interface PromptMessage {
        role: string;
        content: {
            type: string;
            text: string;
        };
    }

    export enum LoggingLevel {
        Debug = "debug",
        Info = "info",
        Warning = "warning",
        Error = "error"
    }
} 