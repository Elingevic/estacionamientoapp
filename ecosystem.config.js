module.exports = {
  apps: [
    {
      name: "sude-parking-web",
      script: "npm",
      args: "start",
      cwd: "./",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
