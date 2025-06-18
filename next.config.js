module.exports = {
  webpack: cfg => {
    cfg.experiments = {
      asyncWebAssembly: true,
      layers: true
    };
    return cfg;
  }
};