import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// Keep colours sRGB/BT.709 so the rendered teal matches the live app.
Config.setColorSpace("bt709");
// three.js / @remotion/three needs a real GL backend in headless Chromium.
Config.setChromiumOpenGlRenderer("angle");
