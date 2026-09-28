import { SPOTNERA_APP_URL } from "../business-url.js";

const LOGO_URL = `${SPOTNERA_APP_URL}/icons/spotnera-icon-192.png`;

export function escapeContactHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function informationRow(label, value) {
  return `<tr><td valign="top" style="padding:0 12px 12px 0;color:#a9b6b0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;white-space:nowrap">${escapeContactHtml(label)}</td><td valign="top" style="padding:0 0 12px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;overflow-wrap:anywhere">${escapeContactHtml(value)}</td></tr>`;
}

function detailCard(label, value) {
  const safeValue = escapeContactHtml(value).replace(/\r?\n/g, "<br>");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background-color:#1b2420;border:1px solid #35473d;border-radius:14px;margin-bottom:12px"><tr><td style="padding:20px"><p style="margin:0 0 10px;color:#72f0cc;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;line-height:18px">${escapeContactHtml(label)}</p><p style="margin:0;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;overflow-wrap:anywhere">${safeValue}</p></td></tr></table>`;
}

export function internalContactHtml({ label, rows, message, details, heading, replyHint = true }) {
  const safeLabel = escapeContactHtml(label);
  const safeHeading = escapeContactHtml(heading ?? (label === "SUPPORT" ? "New support message" : "New Premium inquiry"));
  const content = details?.length ? details.map(([key, value]) => detailCard(key, value)).join("")
    : detailCard("MESSAGE", message);
  const footer = `${replyHint ? "Reply to this email to contact the sender.<br>" : ""}© 2026 Spotnera`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Spotnera ${safeLabel}</title></head><body style="margin:0;padding:0;background-color:#080b0a;color:#ffffff;font-family:Arial,Helvetica,sans-serif"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#080b0a" style="border-collapse:collapse;background-color:#080b0a"><tr><td align="center" style="padding:20px 12px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:600px;border-collapse:collapse;background-color:#111715;border:1px solid #30413a;border-radius:18px;overflow:hidden"><tr><td style="padding:20px 24px;background-color:#151b1a;border-bottom:1px solid #30413a"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="48" valign="middle"><img src="${LOGO_URL}" width="48" height="48" alt="Spotnera" style="display:block;width:48px;height:48px;border:0;outline:none;text-decoration:none"></td><td valign="middle" style="padding-left:12px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;line-height:28px">Spotnera<span style="color:#72f0cc;font-size:12px;vertical-align:top">™</span></td></tr></table></td></tr><tr><td style="padding:28px 24px 12px"><p style="margin:0 0 8px;color:#72f0cc;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:1px;line-height:18px">${safeLabel}</p><h1 style="margin:0 0 22px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:25px;font-weight:700;line-height:32px">${safeHeading}</h1><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse">${rows.map(([key, value]) => informationRow(key, value)).join("")}</table>${content}</td></tr><tr><td style="padding:20px 24px 24px;color:#a9b6b0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;text-align:center">${footer}</td></tr></table></td></tr></table></body></html>`;
}
