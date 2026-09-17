const { createHash, timingSafeEqual } = require("node:crypto");

function sshHostVerifier(expectedFingerprint) {
  if (!expectedFingerprint) {
    return undefined;
  }

  const expected = String(expectedFingerprint).trim();
  if (!/^SHA256:[A-Za-z0-9+/]{43}$/.test(expected)) {
    throw new Error("JMU_SSH_HOST_FINGERPRINT deve estar no formato SHA256:<base64>.");
  }

  return (key) => {
    const actual = `SHA256:${createHash("sha256").update(key).digest("base64").replace(/=+$/, "")}`;
    return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  };
}

module.exports = { sshHostVerifier };
