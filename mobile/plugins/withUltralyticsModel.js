const fs = require("node:fs");
const path = require("node:path");
const { IOSConfig, WarningAggregator, withXcodeProject } = require("expo/config-plugins");

const DEFAULT_MODEL = "assets/models/best.mlpackage";

module.exports = function withUltralyticsModel(config, options = {}) {
  const modelPath = options.modelPath || DEFAULT_MODEL;

  return withXcodeProject(config, (projectConfig) => {
    const absoluteModelPath = path.resolve(projectConfig.modRequest.projectRoot, modelPath);
    if (!fs.existsSync(absoluteModelPath)) {
      WarningAggregator.addWarningIOS(
        "withUltralyticsModel",
        `Modelo Core ML não encontrado em ${modelPath}. Execute scripts/setup-ios-ultralytics.sh no Mac antes de abrir o Xcode.`,
      );
      return projectConfig;
    }

    const project = projectConfig.modResults;
    const relativeModelPath = path.relative(projectConfig.modRequest.platformProjectRoot, absoluteModelPath);
    IOSConfig.XcodeUtils.ensureGroupRecursively(project, "Resources");
    IOSConfig.XcodeUtils.addResourceFileToGroup({
      filepath: relativeModelPath,
      groupName: "Resources",
      project,
      isBuildFile: true,
      verbose: true,
    });
    return projectConfig;
  });
};
