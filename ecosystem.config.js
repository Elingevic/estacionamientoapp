module.exports = {
  apps: [
    {
      name: "estacionamiento",
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
