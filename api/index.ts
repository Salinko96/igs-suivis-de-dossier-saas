// Vercel Serverless Entry Point
// This file adapts the Express application for Vercel's serverless environment.
import { createApp } from "../server/_core/app";

const app = createApp();

// Vercel expects the default export to be the request handler
export default app;
