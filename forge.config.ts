import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { WebpackPlugin } from "@electron-forge/plugin-webpack";

import { mainConfig } from "./webpack.main.config";
import { rendererConfig } from "./webpack.renderer.config";

const appleId = process.env["APPLE_ID"];
const appleIdPassword = process.env["APPLE_PASSWORD"];
const teamId = process.env["APPLE_TEAM_ID"];
const credentials = appleId && appleIdPassword && teamId;
const publish = process.env["GITHUB_TOKEN"];

const config: ForgeConfig = {
  publishers: publish
    ? [
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
      ]
    : [],
  packagerConfig: {
    icon: "src/images/icon",
    asar: true,
    ...(credentials ? { osxSign: {} } : {}),
    ...(credentials
      ? {
          osxNotarize: {
            appleId,
            appleIdPassword,
            teamId,
          },
        }
      : {}),
  },
  rebuildConfig: {},
  makers: [
    // Windows
    new MakerSquirrel({
      iconUrl: "https://getdextop.com/images/icon.ico",
      setupIcon: "src/images/icon.ico",
      authors: "Riccardo Odone",
    }),

    // macOS
    {
      name: "@electron-forge/maker-dmg",
      config: {
        icon: "src/images/icon.icns",
      },
    },

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
