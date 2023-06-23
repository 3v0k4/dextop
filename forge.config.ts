import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerDMG } from "@electron-forge/maker-dmg";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { WebpackPlugin } from "@electron-forge/plugin-webpack";

import { mainConfig } from "./webpack.main.config";
import { rendererConfig } from "./webpack.renderer.config";

const config: ForgeConfig = {
  publishers: [
    {
      name: "@electron-forge/publisher-github",
      config: {
        repository: {
          owner: "3v0k4",
          name: "dextop",
        },
        prerelease: false,
        draft: false,
      },
    },
  ],
  packagerConfig: {
    icon: "src/images/icon",
    asar: true,
    osxSign: {},
    osxNotarize: {
      tool: "notarytool",
      appleId: process.env["APPLE_ID"]!,
      appleIdPassword: process.env["APPLE_PASSWORD"]!,
      teamId: process.env["APPLE_TEAM_ID"]!,
    },
  },
  rebuildConfig: {},
  makers: [
    // Windows
    new MakerSquirrel({
      iconUrl: "https://dextop.odone.io/images/icon.ico",
      setupIcon: "src/images/icon.ico",
    }),

    // Any platform
    new MakerZIP({}, ["darwin"]),

    // macOS
    new MakerDMG({
      icon: "src/images/icon.icns",
    }),

    // RedHat-based Linux distributions
    new MakerRpm({
      options: {
        icon: "src/images/icon.png",
      },
    }),

    // Debian-based Linux distributions
    new MakerDeb({
      options: {
        icon: "src/images/icon.png",
      },
    }),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: "./src/index.html",
            js: "./src/renderer.ts",
            name: "main_window",
            preload: {
              js: "./src/preload.ts",
            },
          },
        ],
      },
    }),
  ],
};

export default config;
