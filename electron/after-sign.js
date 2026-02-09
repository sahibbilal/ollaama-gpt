// Dummy afterSign hook to prevent electron-builder from trying to sign
// This file is intentionally empty - we don't want to sign the app

exports.default = async function(context) {
  // Do nothing - signing is disabled
  return;
};
