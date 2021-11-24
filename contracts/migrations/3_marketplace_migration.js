const SleekMarketplace = artifacts.require("SleekMarketplace");

module.exports = function (deployer) {
  deployer.deploy(SleekMarketplace);
};