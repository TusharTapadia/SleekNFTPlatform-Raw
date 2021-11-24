const SleekToken = artifacts.require("SleekToken");

module.exports = function (deployer) {
  deployer.deploy(SleekToken);
};