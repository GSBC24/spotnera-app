export function canPresentInstallPrompt({
  available,
  installed,
  hasConsentChoice,
  consentDialogVisible,
  authDialogVisible,
}) {
  return available && !installed && hasConsentChoice &&
    !consentDialogVisible && !authDialogVisible;
}
