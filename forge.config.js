module.exports = {
 publishers: [
   {
     name: '@electron-forge/publisher-github',
     config: {
       repository: {
         owner: '3v0k4',
         name: 'dextop'
       },
       prerelease: false,
       draft: false,
     }
   }
 ],
  packagerConfig: {
    asar: true,
    osxSign: {},
    osxNotarize: {
      tool: 'notarytool',
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    }
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {},
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
  ],
};
